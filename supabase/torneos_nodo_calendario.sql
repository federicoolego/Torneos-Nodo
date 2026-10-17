-- ============================================================================
-- Calendario público de partidos (página de jugadores, pestaña "Calendario")
--
-- Solo agrega UNA función de lectura. No crea ni modifica tablas, columnas,
-- triggers ni datos: se puede correr con torneos en juego.
--
-- Devuelve los torneos PUBLICADOS y NO CANCELADOS que tienen al menos un partido
-- con fecha entre p_desde y p_hasta, con el mismo formato que torneos_nodo_publico(id)
-- (torneo completo: la app calcula los cruces y los nombres de cada partido).
-- Se puede volver a correr sin problema (create or replace).
-- ============================================================================

create or replace function public.torneos_nodo_calendario(p_desde date, p_hasta date)
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
    'torneo', json_build_object(
      'id', t.id, 'nombre', t.nombre, 'categoria', t.categoria, 'premio', t.premio, 'fecha_inicio', t.fecha_inicio, 'fecha_fin', t.fecha_fin,
      'inscripcion', t.inscripcion, 'observacion', t.observacion, 'cant_zonas', t.cant_zonas, 'cuadro', t.cuadro,
      'desempates', t.desempates, 'estado', t.estado, 'campeon', t.campeon, 'actualizado', t.actualizado),
    'instancias', coalesce((select json_agg(json_build_object('torneo_id', i.torneo_id, 'instancia', i.instancia, 'formato', i.formato))
                            from public.torneos_nodo_instancias i where i.torneo_id = t.id), '[]'::json),
    -- sin "horario" (nota interna del organizador)
    'parejas', coalesce((select json_agg(json_build_object('id', p.id, 'torneo_id', p.torneo_id, 'orden', p.orden, 'jugador1', p.jugador1,
                                                           'jugador2', p.jugador2, 'horario', '', 'zona', p.zona, 'posicion', p.posicion))
                         from public.torneos_nodo_parejas p where p.torneo_id = t.id), '[]'::json),
    'partidos', coalesce((select json_agg(json_build_object('torneo_id', m.torneo_id, 'clave', m.clave, 'instancia', m.instancia, 'fecha', m.fecha,
                                                            'hora', m.hora, 'sede', m.sede, 'pareja_a', m.pareja_a, 'pareja_b', m.pareja_b,
                                                            'sets', m.sets, 'wo', m.wo, 'resultado', m.resultado, 'ganador', m.ganador))
                          from public.torneos_nodo_partidos m where m.torneo_id = t.id), '[]'::json)
  ) order by t.fecha_inicio nulls last, t.nombre), '[]'::json)
  from public.torneos_nodo_torneos t
  where t.publicado
    and t.estado is distinct from 'cancelado'
    -- rango acotado (máx. ~6 meses) para que nadie pida toda la base de una
    and p_hasta >= p_desde and p_hasta - p_desde <= 190
    and exists (select 1 from public.torneos_nodo_partidos m
                where m.torneo_id = t.id and m.fecha between p_desde and p_hasta)
$$;

revoke all on function public.torneos_nodo_calendario(date, date) from public;
grant execute on function public.torneos_nodo_calendario(date, date) to anon, authenticated;

-- control: torneos que entrarían en el calendario de la semana pasada al mes próximo
select (x->'torneo'->>'nombre') as torneo, (x->'torneo'->>'estado') as estado, json_array_length(x->'partidos') as partidos
from json_array_elements(public.torneos_nodo_calendario(current_date - 7, current_date + 35)) x;
