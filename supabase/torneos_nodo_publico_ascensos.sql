-- =====================================================================
-- Generador de Torneos · NODO — ascensos en la página pública (pestaña "Ascensos" para jugadores)
-- (requiere torneos_nodo_recategorizaciones.sql)
-- · publicada: lo decide el admin, solo en tandas aplicadas (botón "Publicar" en el detalle de la tanda)
--     si la tanda se revierte (vuelve a borrador), se despublica sola
-- · torneos_nodo_publico_ascensos(): tandas publicadas con sus movimientos (nombre, categoría anterior y nueva, tipo),
--   de la más nueva a la más vieja. Sin login, solo lectura. Queda como historial aunque los jugadores
--   cambien de categoría después, se unifiquen o se eliminen del padrón.
-- Idempotente: se puede volver a correr.
-- =====================================================================

alter table public.torneos_nodo_recategorizaciones add column if not exists publicada boolean not null default false;
alter table public.torneos_nodo_recategorizaciones add column if not exists publicada_en timestamptz;

-- revertir (vuelve a borrador) o cualquier cambio que la saque de "aplicada": se despublica sola.
-- Va antes del chequeo para que torneos_nodo_recategorizacion_revertir() no falle.
create or replace function public.torneos_nodo_recat_publicada()
returns trigger language plpgsql as $$
begin
  if new.estado <> 'aplicada' then
    new.publicada := false;
  end if;
  if new.publicada and not old.publicada then new.publicada_en := now(); end if;
  if not new.publicada then new.publicada_en := null; end if;
  return new;
end $$;

drop trigger if exists torneos_nodo_recat_publicada on public.torneos_nodo_recategorizaciones;
create trigger torneos_nodo_recat_publicada before update on public.torneos_nodo_recategorizaciones
  for each row execute function public.torneos_nodo_recat_publicada();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'torneos_nodo_recat_publicada_chk') then
    alter table public.torneos_nodo_recategorizaciones
      add constraint torneos_nodo_recat_publicada_chk check (not publicada or estado = 'aplicada');
  end if;
end $$;

create index if not exists torneos_nodo_recat_publicada_idx on public.torneos_nodo_recategorizaciones (vigencia desc) where publicada;

-- ------------------------------------------------------------ historial público
create or replace function public.torneos_nodo_publico_ascensos()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(x order by x.vigencia desc, x.aplicada desc), '[]'::json)
  from (
    select r.id, r.nombre, r.vigencia, r.aplicada,
           coalesce((
             select json_agg(json_build_object(
                      -- el nombre actual si sigue en el padrón (por si lo corrigieron), si no el guardado
                      'nombre', coalesce(j.nombre, m.nombre),
                      'anterior', m.categoria_anterior,
                      'nueva', m.categoria_nueva,
                      'tipo', m.tipo) order by coalesce(j.nombre, m.nombre))
               from public.torneos_nodo_recategorizaciones_movimientos m
               left join public.torneos_nodo_jugadores j on j.id = m.jugador_id
              where m.recategorizacion_id = r.id
           ), '[]'::json) as movimientos
      from public.torneos_nodo_recategorizaciones r
     where r.publicada and r.estado = 'aplicada'
  ) x
$$;

revoke all on function public.torneos_nodo_publico_ascensos() from public;
grant execute on function public.torneos_nodo_publico_ascensos() to anon, authenticated;

-- control: tandas y si están publicadas
select nombre, vigencia, estado, publicada, publicada_en from public.torneos_nodo_recategorizaciones order by vigencia desc;
