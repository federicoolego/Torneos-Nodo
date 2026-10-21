-- =====================================================================
-- Generador de Torneos · NODO — hasta dónde llegó cada pareja
-- · torneos_nodo_parejas.instancia_max: máxima instancia de la pareja en el torneo
--   (zonas, 16avos, octavos, cuartos, semifinal, final = finalista, campeon). La calcula la app al guardar.
-- · cambiar solo instancia_max no "toca" al torneo (no cambia su fecha de actualización)
-- · torneos_nodo_publicos() devuelve las parejas como [jugador1, jugador2, instancia_max]
-- Correr ANTES de subir la versión nueva de la app. Requiere torneos_nodo_publico_estadisticas.sql. Idempotente.
-- Los torneos ya cargados se completan solos la primera vez que se abre el panel de organizadores.
-- =====================================================================

alter table public.torneos_nodo_parejas add column if not exists instancia_max text;
alter table public.torneos_nodo_parejas drop constraint if exists torneos_nodo_parejas_instancia_max_chk;
alter table public.torneos_nodo_parejas add constraint torneos_nodo_parejas_instancia_max_chk
  check (instancia_max is null or instancia_max in ('zonas','16avos','octavos','cuartos','semifinal','final','campeon'));

-- parejas: igual que antes, salvo que el único cambio sea instancia_max
create or replace function public.torneos_nodo_tocar_torneo_parejas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'instancia_max') = (to_jsonb(old) - 'instancia_max') then
    return null;
  end if;
  update public.torneos_nodo_torneos set actualizado = now()
  where id = coalesce(new.torneo_id, old.torneo_id);
  return null;
end $$;

drop trigger if exists torneos_nodo_parejas_toca on public.torneos_nodo_parejas;
create trigger torneos_nodo_parejas_toca after insert or update or delete on public.torneos_nodo_parejas
  for each row execute function public.torneos_nodo_tocar_torneo_parejas();

create or replace function public.torneos_nodo_publicos()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(x order by x.fecha_inicio desc nulls last), '[]'::json)
  from (
    select t.id, t.nombre, t.categoria, t.fecha_inicio, t.fecha_fin, t.estado, t.inscripcion, t.premio, t.campeon,
           (select count(*) from public.torneos_nodo_parejas p where p.torneo_id = t.id) as parejas,
           coalesce((select json_agg(j.nombre order by j.orden, j.n)
                     from (select p.orden, 1 as n, p.jugador1 as nombre from public.torneos_nodo_parejas p where p.torneo_id = t.id
                           union all
                           select p.orden, 2 as n, p.jugador2 from public.torneos_nodo_parejas p where p.torneo_id = t.id) j
                     where coalesce(trim(j.nombre), '') <> ''), '[]'::json) as jugadores,
           coalesce((select json_agg(json_build_array(coalesce(p.jugador1, ''), coalesce(p.jugador2, ''), p.instancia_max) order by p.orden)
                     from public.torneos_nodo_parejas p where p.torneo_id = t.id), '[]'::json) as duplas
    from public.torneos_nodo_torneos t
    where t.publicado
  ) x
$$;

revoke all on function public.torneos_nodo_publicos() from public;
grant execute on function public.torneos_nodo_publicos() to anon, authenticated;

-- control: parejas por instancia alcanzada (null = torneo todavía no abierto desde el panel con la versión nueva)
select coalesce(instancia_max, '(sin calcular)') as instancia, count(*) as parejas
from public.torneos_nodo_parejas group by 1 order by 2 desc;
