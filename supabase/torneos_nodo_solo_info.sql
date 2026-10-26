-- =====================================================================
-- Generador de Torneos · NODO — publicar un torneo "solo info"
-- · torneos_nodo_torneos.solo_info: publicado mostrando solo los datos del torneo
--   (fechas, categoría, formato, inscripción, premio, observación) + link de inscripción por WhatsApp,
--   SIN parejas, zonas, partidos ni playoff. Lo usa el admin mientras arma el torneo.
-- · Se controla en la base (no solo en la app): las funciones públicas no devuelven parejas ni partidos
--   de esos torneos, y el calendario público no los incluye.
-- · Los torneos ya publicados quedan como estaban (solo_info = false: completos).
-- Correr ANTES de subir la versión nueva de la app. Requiere torneos_nodo_publico_puntos.sql y
-- torneos_nodo_calendario.sql. Idempotente: se puede volver a correr.
-- =====================================================================

alter table public.torneos_nodo_torneos add column if not exists solo_info boolean not null default false;

-- ------------------------------------------------------------ listado público (igual que torneos_nodo_publico_puntos.sql + solo_info)
create or replace function public.torneos_nodo_publicos()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(x order by x.fecha_inicio desc nulls last), '[]'::json)
  from (
    select t.id, t.nombre, t.categoria, t.fecha_inicio, t.fecha_fin, t.estado, t.inscripcion, t.premio, t.solo_info,
           case when t.solo_info then null else t.campeon end as campeon,
           case when t.solo_info then 0
                else (select count(*) from public.torneos_nodo_parejas p where p.torneo_id = t.id) end as parejas,
           case when t.solo_info then '[]'::json else
             coalesce((select json_agg(j.nombre order by j.orden, j.n)
                       from (select p.orden, 1 as n, p.jugador1 as nombre from public.torneos_nodo_parejas p where p.torneo_id = t.id
                             union all
                             select p.orden, 2 as n, p.jugador2 from public.torneos_nodo_parejas p where p.torneo_id = t.id) j
                       where coalesce(trim(j.nombre), '') <> ''), '[]'::json) end as jugadores,
           case when t.solo_info then '[]'::json else
             coalesce((select json_agg(json_build_array(
                                coalesce(p.jugador1, ''), coalesce(p.jugador2, ''), p.instancia_max,
                                coalesce((select json_object_agg(v.instancia, v.n)
                                          from (select pt.instancia, count(*) as n
                                                from public.torneos_nodo_partidos pt
                                                where pt.torneo_id = t.id and pt.ganador = p.id and pt.instancia is not null
                                                group by pt.instancia) v), '{}'::json)
                              ) order by p.orden)
                       from public.torneos_nodo_parejas p where p.torneo_id = t.id), '[]'::json) end as duplas
    from public.torneos_nodo_torneos t
    where t.publicado
  ) x
$$;

-- ------------------------------------------------------------ un torneo publicado (null si no existe o no está publicado)
-- "solo info": datos del torneo y formatos por instancia, sin zonas, cuadro, parejas ni partidos
create or replace function public.torneos_nodo_publico(p_id uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'torneo', json_build_object(
      'id', t.id, 'nombre', t.nombre, 'categoria', t.categoria, 'premio', t.premio, 'fecha_inicio', t.fecha_inicio, 'fecha_fin', t.fecha_fin,
      'inscripcion', t.inscripcion, 'observacion', t.observacion,
      'cant_zonas', case when t.solo_info then 0 else t.cant_zonas end,
      'cuadro', case when t.solo_info then null else t.cuadro end,
      'desempates', case when t.solo_info then '{}'::jsonb else t.desempates end,
      'estado', t.estado, 'campeon', case when t.solo_info then null else t.campeon end,
      'solo_info', t.solo_info, 'actualizado', t.actualizado),
    'instancias', coalesce((select json_agg(json_build_object('torneo_id', i.torneo_id, 'instancia', i.instancia, 'formato', i.formato))
                            from public.torneos_nodo_instancias i where i.torneo_id = t.id), '[]'::json),
    -- sin "horario" (nota interna del organizador)
    'parejas', case when t.solo_info then '[]'::json else
               coalesce((select json_agg(json_build_object('id', p.id, 'torneo_id', p.torneo_id, 'orden', p.orden, 'jugador1', p.jugador1,
                                                           'jugador2', p.jugador2, 'horario', '', 'zona', p.zona, 'posicion', p.posicion))
                         from public.torneos_nodo_parejas p where p.torneo_id = t.id), '[]'::json) end,
    'partidos', case when t.solo_info then '[]'::json else
                coalesce((select json_agg(json_build_object('torneo_id', m.torneo_id, 'clave', m.clave, 'instancia', m.instancia, 'fecha', m.fecha,
                                                            'hora', m.hora, 'sede', m.sede, 'pareja_a', m.pareja_a, 'pareja_b', m.pareja_b,
                                                            'sets', m.sets, 'wo', m.wo, 'resultado', m.resultado, 'ganador', m.ganador))
                          from public.torneos_nodo_partidos m where m.torneo_id = t.id), '[]'::json) end
  )
  from public.torneos_nodo_torneos t
  where t.id = p_id and t.publicado
$$;

-- ------------------------------------------------------------ calendario público: sin los torneos "solo info"
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
    and not t.solo_info
    and t.estado is distinct from 'cancelado'
    -- rango acotado (máx. ~6 meses) para que nadie pida toda la base de una
    and p_hasta >= p_desde and p_hasta - p_desde <= 190
    and exists (select 1 from public.torneos_nodo_partidos m
                where m.torneo_id = t.id and m.fecha between p_desde and p_hasta)
$$;

revoke all on function public.torneos_nodo_publicos() from public;
revoke all on function public.torneos_nodo_publico(uuid) from public;
revoke all on function public.torneos_nodo_calendario(date, date) from public;
grant execute on function public.torneos_nodo_publicos() to anon, authenticated;
grant execute on function public.torneos_nodo_publico(uuid) to anon, authenticated;
grant execute on function public.torneos_nodo_calendario(date, date) to anon, authenticated;

-- control: torneos publicados y cómo se ven
select nombre, fecha_inicio, estado, case when solo_info then 'solo info' else 'completo' end as publicacion
from public.torneos_nodo_torneos where publicado order by fecha_inicio nulls last;
