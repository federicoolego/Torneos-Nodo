-- =====================================================================
-- Generador de Torneos · NODO — ascensos y recategorizaciones (pestaña "Ascensos" del admin)
-- (requiere torneos_nodo.sql, torneos_nodo_jugadores.sql y torneos_nodo_jugadores_categoria.sql)
-- · torneos_nodo_recategorizaciones: una "tanda" por corte (cada 2 o 3 meses): nombre, vigencia y estado
--     borrador → se arman los cambios sin tocar las categorías de los jugadores
--     aplicada → las categorías nuevas ya están en torneos_nodo_jugadores (se puede revertir)
-- · torneos_nodo_recategorizaciones_movimientos: un jugador por fila, categoría anterior y nueva
--     tipo (calculado): 'ascenso' si baja el número (7ma → 6ta), 'recategorizacion' si sube (6ta → 7ma)
--     el nombre queda guardado: si el jugador se unifica o se elimina, el historial no se pierde
-- Idempotente: se puede volver a correr.
-- =====================================================================

create table if not exists public.torneos_nodo_recategorizaciones (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null check (btrim(nombre) <> ''),
  vigencia  date not null default current_date,
  estado    text not null default 'borrador' check (estado in ('borrador', 'aplicada')),
  aplicada  timestamptz,
  creado    timestamptz not null default now()
);

create table if not exists public.torneos_nodo_recategorizaciones_movimientos (
  id                  uuid primary key default gen_random_uuid(),
  recategorizacion_id uuid not null references public.torneos_nodo_recategorizaciones(id) on delete cascade,
  jugador_id          uuid references public.torneos_nodo_jugadores(id) on delete set null,
  nombre              text not null,
  categoria_anterior  text not null,
  categoria_nueva     text not null,
  tipo                text generated always as (
    case when substring(categoria_nueva from '^[0-9]+')::int < substring(categoria_anterior from '^[0-9]+')::int
         then 'ascenso' else 'recategorizacion' end
  ) stored,
  creado              timestamptz not null default now(),
  constraint torneos_nodo_recat_mov_jugador_uq unique (recategorizacion_id, jugador_id),
  constraint torneos_nodo_recat_mov_distinta_chk check (categoria_nueva <> categoria_anterior),
  constraint torneos_nodo_recat_mov_rama_chk check (split_part(categoria_nueva, ' ', 2) = split_part(categoria_anterior, ' ', 2)),
  constraint torneos_nodo_recat_mov_cat_chk check (
    categoria_anterior in ('5ta Damas', '6ta Damas', '7ma Damas', '8va Damas',
      '3era Caballeros', '4ta Caballeros', '5ta Caballeros', '6ta Caballeros', '7ma Caballeros', '8va Caballeros')
    and categoria_nueva in ('5ta Damas', '6ta Damas', '7ma Damas', '8va Damas',
      '3era Caballeros', '4ta Caballeros', '5ta Caballeros', '6ta Caballeros', '7ma Caballeros', '8va Caballeros')
  )
);

create index if not exists torneos_nodo_recat_mov_tanda_idx on public.torneos_nodo_recategorizaciones_movimientos (recategorizacion_id);
create index if not exists torneos_nodo_recat_mov_jugador_idx on public.torneos_nodo_recategorizaciones_movimientos (jugador_id);

-- los movimientos de una tanda aplicada no se tocan (salvo borrar la tanda entera)
create or replace function public.torneos_nodo_recat_mov_editable()
returns trigger language plpgsql as $$
declare v_estado text; v_id uuid;
begin
  -- se elimina o unifica el jugador (on delete set null): el historial queda con el nombre guardado
  if tg_op = 'UPDATE' and new.jugador_id is null and old.jugador_id is not null
     and (new.recategorizacion_id, new.nombre, new.categoria_anterior, new.categoria_nueva)
       = (old.recategorizacion_id, old.nombre, old.categoria_anterior, old.categoria_nueva) then
    return new;
  end if;
  v_id := coalesce(new.recategorizacion_id, old.recategorizacion_id);
  select estado into v_estado from public.torneos_nodo_recategorizaciones where id = v_id;
  -- al borrar la tanda (cascade) ya no existe: se deja pasar
  if v_estado = 'aplicada' then raise exception 'La tanda ya está aplicada: revertila para modificarla'; end if;
  return coalesce(new, old);
end $$;

drop trigger if exists torneos_nodo_recat_mov_editable on public.torneos_nodo_recategorizaciones_movimientos;
create trigger torneos_nodo_recat_mov_editable before insert or update or delete on public.torneos_nodo_recategorizaciones_movimientos
  for each row execute function public.torneos_nodo_recat_mov_editable();

-- seguridad: igual que el resto de las tablas
alter table public.torneos_nodo_recategorizaciones enable row level security;
alter table public.torneos_nodo_recategorizaciones_movimientos enable row level security;
drop policy if exists torneos_nodo_recategorizaciones_acceso on public.torneos_nodo_recategorizaciones;
create policy torneos_nodo_recategorizaciones_acceso on public.torneos_nodo_recategorizaciones for all to authenticated
  using (public.torneos_nodo_es_usuario()) with check (public.torneos_nodo_es_usuario());
drop policy if exists torneos_nodo_recat_mov_acceso on public.torneos_nodo_recategorizaciones_movimientos;
create policy torneos_nodo_recat_mov_acceso on public.torneos_nodo_recategorizaciones_movimientos for all to authenticated
  using (public.torneos_nodo_es_usuario()) with check (public.torneos_nodo_es_usuario());
revoke all on public.torneos_nodo_recategorizaciones, public.torneos_nodo_recategorizaciones_movimientos from anon;
grant select, insert, update, delete on public.torneos_nodo_recategorizaciones, public.torneos_nodo_recategorizaciones_movimientos to authenticated;

-- aplicar: pasa las categorías nuevas al padrón, todo junto. Si a algún jugador le cambiaron la
-- categoría por otro lado (ya no es la "anterior"), no aplica nada y avisa quiénes son.
create or replace function public.torneos_nodo_recategorizacion_aplicar(p_id uuid)
returns int language plpgsql as $$
declare v_estado text; v_conflictos text; v_n int;
begin
  if not public.torneos_nodo_es_usuario() then raise exception 'Sin permiso'; end if;
  select estado into v_estado from public.torneos_nodo_recategorizaciones where id = p_id for update;
  if v_estado is null then raise exception 'No existe la tanda'; end if;
  if v_estado = 'aplicada' then raise exception 'La tanda ya está aplicada'; end if;
  if not exists (select 1 from public.torneos_nodo_recategorizaciones_movimientos where recategorizacion_id = p_id) then
    raise exception 'La tanda no tiene cambios de categoría';
  end if;
  select string_agg(m.nombre || coalesce(' (hoy ' || j.categoria || ')', ' (sin categoría o eliminado)'), ', ' order by m.nombre)
    into v_conflictos
    from public.torneos_nodo_recategorizaciones_movimientos m
    left join public.torneos_nodo_jugadores j on j.id = m.jugador_id
   where m.recategorizacion_id = p_id and (j.id is null or j.categoria is distinct from m.categoria_anterior);
  if v_conflictos is not null then
    raise exception 'Estos jugadores ya no están en la categoría anterior: %. Corregilos antes de aplicar.', v_conflictos;
  end if;
  update public.torneos_nodo_jugadores j set categoria = m.categoria_nueva
    from public.torneos_nodo_recategorizaciones_movimientos m
   where m.recategorizacion_id = p_id and m.jugador_id = j.id;
  get diagnostics v_n = row_count;
  update public.torneos_nodo_recategorizaciones set estado = 'aplicada', aplicada = now() where id = p_id;
  return v_n;
end $$;

-- revertir: vuelve a la categoría anterior (solo a los que siguen en la nueva) y la tanda queda en borrador
create or replace function public.torneos_nodo_recategorizacion_revertir(p_id uuid)
returns int language plpgsql as $$
declare v_estado text; v_conflictos text; v_n int;
begin
  if not public.torneos_nodo_es_usuario() then raise exception 'Sin permiso'; end if;
  select estado into v_estado from public.torneos_nodo_recategorizaciones where id = p_id for update;
  if v_estado is null then raise exception 'No existe la tanda'; end if;
  if v_estado <> 'aplicada' then raise exception 'La tanda no está aplicada'; end if;
  select string_agg(m.nombre || coalesce(' (hoy ' || j.categoria || ')', ' (sin categoría o eliminado)'), ', ' order by m.nombre)
    into v_conflictos
    from public.torneos_nodo_recategorizaciones_movimientos m
    left join public.torneos_nodo_jugadores j on j.id = m.jugador_id
   where m.recategorizacion_id = p_id and (j.id is null or j.categoria is distinct from m.categoria_nueva);
  if v_conflictos is not null then
    raise exception 'Estos jugadores cambiaron de categoría después de aplicar: %. Revisalos en Categorías.', v_conflictos;
  end if;
  update public.torneos_nodo_jugadores j set categoria = m.categoria_anterior
    from public.torneos_nodo_recategorizaciones_movimientos m
   where m.recategorizacion_id = p_id and m.jugador_id = j.id;
  get diagnostics v_n = row_count;
  update public.torneos_nodo_recategorizaciones set estado = 'borrador', aplicada = null where id = p_id;
  return v_n;
end $$;

revoke all on function public.torneos_nodo_recategorizacion_aplicar(uuid) from public, anon;
revoke all on function public.torneos_nodo_recategorizacion_revertir(uuid) from public, anon;
grant execute on function public.torneos_nodo_recategorizacion_aplicar(uuid) to authenticated;
grant execute on function public.torneos_nodo_recategorizacion_revertir(uuid) to authenticated;

-- control: tandas y movimientos
select r.nombre, r.vigencia, r.estado,
       count(m.*) filter (where m.tipo = 'ascenso') as ascensos,
       count(m.*) filter (where m.tipo = 'recategorizacion') as recategorizaciones
  from public.torneos_nodo_recategorizaciones r
  left join public.torneos_nodo_recategorizaciones_movimientos m on m.recategorizacion_id = r.id
 group by r.id order by r.vigencia desc;
