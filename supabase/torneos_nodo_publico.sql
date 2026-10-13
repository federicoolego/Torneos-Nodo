-- =====================================================================
-- Generador de Torneos · NODO — página pública de torneos
-- · publicado (lo decide el admin) · estado (lo calcula la app; "cancelado" es manual) · campeon
-- · dos funciones de solo lectura para la página pública (anon): solo torneos publicados
--   y solo los datos que se muestran (no expone el "problema de horario" de las parejas)
-- Idempotente: se puede volver a correr.
-- =====================================================================

alter table public.torneos_nodo_torneos add column if not exists publicado boolean not null default false;
alter table public.torneos_nodo_torneos add column if not exists estado text not null default 'pendiente';
alter table public.torneos_nodo_torneos add column if not exists campeon text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'torneos_nodo_torneos_estado_chk') then
    alter table public.torneos_nodo_torneos
      add constraint torneos_nodo_torneos_estado_chk check (estado in ('pendiente','en_curso','finalizado','cancelado'));
  end if;
end $$;

create index if not exists torneos_nodo_torneos_publicado_idx on public.torneos_nodo_torneos (publicado) where publicado;

-- ------------------------------------------------------------ listado público
create or replace function public.torneos_nodo_publicos()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(x order by x.fecha_inicio desc nulls last), '[]'::json)
  from (
    select t.id, t.nombre, t.fecha_inicio, t.fecha_fin, t.estado, t.inscripcion, t.premio, t.campeon,
           (select count(*) from public.torneos_nodo_parejas p where p.torneo_id = t.id) as parejas
    from public.torneos_nodo_torneos t
    where t.publicado
  ) x
$$;

-- ------------------------------------------------------------ un torneo publicado (null si no existe o no está publicado)
create or replace function public.torneos_nodo_publico(p_id uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'torneo', json_build_object(
      'id', t.id, 'nombre', t.nombre, 'premio', t.premio, 'fecha_inicio', t.fecha_inicio, 'fecha_fin', t.fecha_fin,
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
  )
  from public.torneos_nodo_torneos t
  where t.id = p_id and t.publicado
$$;

revoke all on function public.torneos_nodo_publicos() from public;
revoke all on function public.torneos_nodo_publico(uuid) from public;
grant execute on function public.torneos_nodo_publicos() to anon, authenticated;
grant execute on function public.torneos_nodo_publico(uuid) to anon, authenticated;
