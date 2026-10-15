-- =====================================================================
-- Generador de Torneos · NODO — categoría del torneo (Damas / Caballeros / Mixto)
-- · torneos_nodo_torneos.categoria (obligatoria, por defecto 'Damas')
-- · la primera vez que se corre: los torneos existentes quedan en 'Damas' y el de Suma 10 Caballeros en 'Caballeros'
--   (después, la categoría se edita desde la app: volver a correr este script no la pisa)
-- · las dos funciones de la página pública pasan a devolver la categoría
-- Requiere torneos_nodo_publico.sql. Idempotente.
-- =====================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'torneos_nodo_torneos' and column_name = 'categoria') then
    alter table public.torneos_nodo_torneos add column categoria text not null default 'Damas';
    -- sin tocar la fecha de "actualizado" de los torneos
    alter table public.torneos_nodo_torneos disable trigger torneos_nodo_torneos_upd;
    update public.torneos_nodo_torneos
       set categoria = 'Caballeros'
     where nombre ilike '%caballeros%'
        or (nombre ilike '%suma%10%' and nombre not ilike '%damas%');
    alter table public.torneos_nodo_torneos enable trigger torneos_nodo_torneos_upd;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'torneos_nodo_torneos_categoria_chk') then
    alter table public.torneos_nodo_torneos
      add constraint torneos_nodo_torneos_categoria_chk check (categoria in ('Damas', 'Caballeros', 'Mixto'));
  end if;
end $$;

-- ------------------------------------------------------------ página pública: ahora con categoría
create or replace function public.torneos_nodo_publicos()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(x order by x.fecha_inicio desc nulls last), '[]'::json)
  from (
    select t.id, t.nombre, t.categoria, t.fecha_inicio, t.fecha_fin, t.estado, t.inscripcion, t.premio, t.campeon,
           (select count(*) from public.torneos_nodo_parejas p where p.torneo_id = t.id) as parejas
    from public.torneos_nodo_torneos t
    where t.publicado
  ) x
$$;

create or replace function public.torneos_nodo_publico(p_id uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
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
  )
  from public.torneos_nodo_torneos t
  where t.id = p_id and t.publicado
$$;

revoke all on function public.torneos_nodo_publicos() from public;
revoke all on function public.torneos_nodo_publico(uuid) from public;
grant execute on function public.torneos_nodo_publicos() to anon, authenticated;
grant execute on function public.torneos_nodo_publico(uuid) to anon, authenticated;

-- control: cómo quedaron los torneos
select nombre, categoria, fecha_inicio from public.torneos_nodo_torneos order by fecha_inicio desc nulls last;
