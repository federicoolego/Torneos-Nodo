-- =====================================================================
-- Generador de Torneos · NODO — ranking de puntos en la página pública
-- · torneos_nodo_publicos() devuelve las parejas como [jugador1, jugador2, instancia_max, victorias]
--   victorias = partidos ganados por instancia, ej. {"zonas": 2, "cuartos": 1} (de torneos_nodo_partidos.ganador)
-- · sigue devolviendo SOLO torneos publicados
-- Correr ANTES (o junto) de subir la versión de la app con el ranking público.
-- Requiere torneos_nodo_alcance.sql. Idempotente.
-- =====================================================================

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
           coalesce((select json_agg(json_build_array(
                              coalesce(p.jugador1, ''), coalesce(p.jugador2, ''), p.instancia_max,
                              coalesce((select json_object_agg(v.instancia, v.n)
                                        from (select pt.instancia, count(*) as n
                                              from public.torneos_nodo_partidos pt
                                              where pt.torneo_id = t.id and pt.ganador = p.id and pt.instancia is not null
                                              group by pt.instancia) v), '{}'::json)
                            ) order by p.orden)
                     from public.torneos_nodo_parejas p where p.torneo_id = t.id), '[]'::json) as duplas
    from public.torneos_nodo_torneos t
    where t.publicado
  ) x
$$;

revoke all on function public.torneos_nodo_publicos() from public;
grant execute on function public.torneos_nodo_publicos() to anon, authenticated;

-- control: partidos ganados por instancia en torneos publicados
select pt.instancia, count(*) as ganados
from public.torneos_nodo_partidos pt
join public.torneos_nodo_torneos t on t.id = pt.torneo_id
where t.publicado and pt.ganador is not null
group by pt.instancia order by 2 desc;
