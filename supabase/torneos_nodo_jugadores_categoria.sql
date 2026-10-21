-- =====================================================================
-- Generador de Torneos · NODO — categoría de cada jugador del padrón
-- (requiere torneos_nodo_jugadores.sql y torneos_nodo_jugadores_abm.sql)
-- · torneos_nodo_jugadores.categoria: '5ta Damas' … '8va Damas', '3era Caballeros' … '8va Caballeros'
--   (null = sin asignar). La asigna el admin en la pestaña Categorías y se puede cambiar cuando quiera.
-- · unificar dos jugadores conserva la categoría del que queda (si no tenía, toma la del otro)
-- Idempotente: se puede volver a correr.
-- =====================================================================

alter table public.torneos_nodo_jugadores add column if not exists categoria text;

alter table public.torneos_nodo_jugadores drop constraint if exists torneos_nodo_jugadores_categoria_chk;
alter table public.torneos_nodo_jugadores add constraint torneos_nodo_jugadores_categoria_chk check (
  categoria is null or categoria in (
    '5ta Damas', '6ta Damas', '7ma Damas', '8va Damas',
    '3era Caballeros', '4ta Caballeros', '5ta Caballeros', '6ta Caballeros', '7ma Caballeros', '8va Caballeros'
  )
);

create index if not exists torneos_nodo_jugadores_categoria_idx on public.torneos_nodo_jugadores (categoria);

-- unificar: igual que antes, pero el que queda hereda la categoría si no tenía
create or replace function public.torneos_nodo_jugadores_unificar(p_origen uuid, p_destino uuid)
returns void language plpgsql as $$
declare v_nombre text;
begin
  if p_origen = p_destino then raise exception 'Elegí dos jugadores distintos'; end if;
  select nombre into v_nombre from public.torneos_nodo_jugadores where id = p_destino;
  if v_nombre is null then raise exception 'No existe el jugador destino'; end if;
  update public.torneos_nodo_jugadores d
     set categoria = o.categoria
    from public.torneos_nodo_jugadores o
   where d.id = p_destino and o.id = p_origen and d.categoria is null and o.categoria is not null;
  update public.torneos_nodo_parejas set jugador1 = v_nombre where jugador1_id = p_origen;
  update public.torneos_nodo_parejas set jugador2 = v_nombre where jugador2_id = p_origen;
  delete from public.torneos_nodo_jugadores where id = p_origen;
end $$;

revoke all on function public.torneos_nodo_jugadores_unificar(uuid, uuid) from public, anon;
grant execute on function public.torneos_nodo_jugadores_unificar(uuid, uuid) to authenticated;

-- control: jugadores por categoría
select coalesce(categoria, 'Sin asignar') as categoria, count(*) as jugadores
  from public.torneos_nodo_jugadores group by 1 order by 1;
