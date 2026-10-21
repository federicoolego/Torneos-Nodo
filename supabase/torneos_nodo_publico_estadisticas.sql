-- =====================================================================
-- Generador de Torneos · NODO — estadísticas en la página pública
-- · torneos_nodo_publicos() pasa a devolver también los jugadores de cada torneo
--   (para el ranking de campeones, participaciones y jugadores distintos)
-- · y las parejas de cada torneo [jugador1, jugador2] (para mostrar el compañero en el detalle de cada jugador)
-- · sigue devolviendo SOLO torneos publicados: los no publicados no llegan a la página pública
-- Requiere torneos_nodo_publico.sql y torneos_nodo_categoria.sql. Idempotente.
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
           coalesce((select json_agg(json_build_array(coalesce(p.jugador1, ''), coalesce(p.jugador2, '')) order by p.orden)
                     from public.torneos_nodo_parejas p where p.torneo_id = t.id), '[]'::json) as duplas
    from public.torneos_nodo_torneos t
    where t.publicado
  ) x
$$;

revoke all on function public.torneos_nodo_publicos() from public;
grant execute on function public.torneos_nodo_publicos() to anon, authenticated;

-- control: torneos publicados y cuántos jugadores devuelve cada uno
select x->>'nombre' as torneo, x->>'categoria' as categoria, json_array_length(x->'jugadores') as jugadores, json_array_length(x->'duplas') as parejas
from json_array_elements(public.torneos_nodo_publicos()) x;
