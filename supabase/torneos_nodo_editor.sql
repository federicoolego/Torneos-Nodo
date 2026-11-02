-- =====================================================================
-- Generador de Torneos · NODO — rol "Editor"
--
-- El Editor puede SOLO:
--   · inscribir y editar parejas de torneos que ya existen
--   · cargar resultados de partidos (y los desempates que eso implica)
-- No puede: crear / borrar / publicar torneos, tocar zonas, playoff, horarios,
-- quitar parejas, ni tocar el padrón de jugadores, categorías, ascensos, etc.
--
-- Cómo está hecho:
--   · Los editores van en una tabla APARTE (torneos_nodo_editores). Las políticas
--     originales ("_acceso": acceso total para los de torneos_nodo_usuarios) no se tocan,
--     así que seguir siendo admin = estar en torneos_nodo_usuarios, y correr de nuevo
--     los otros .sql nunca le da más permisos al Editor.
--   · Las políticas del Editor se SUMAN a las del admin y solo permiten lo de arriba.
--   · Unos triggers fijan las columnas que el Editor no puede cambiar (aunque llame
--     a la API directamente sin pasar por la web).
--
-- Idempotente: se puede volver a correr.
-- Requiere haber corrido antes los .sql base (torneos_nodo.sql, _jugadores, _fechas, _publico…).
-- =====================================================================

-- ------------------------------------------------------------ editores habilitados
create table if not exists public.torneos_nodo_editores (
  email  text primary key,
  creado timestamptz not null default now()
);
alter table public.torneos_nodo_editores enable row level security;
-- sin políticas: solo se administra desde el SQL Editor

create or replace function public.torneos_nodo_es_editor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.torneos_nodo_editores e
    where e.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;
revoke all on function public.torneos_nodo_es_editor() from public, anon;
grant execute on function public.torneos_nodo_es_editor() to authenticated;

-- rol de quien está logueado: 'admin' | 'editor' | null (la app lo usa al entrar)
create or replace function public.torneos_nodo_rol()
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when public.torneos_nodo_es_usuario() then 'admin'
    when public.torneos_nodo_es_editor()  then 'editor'
    else null
  end
$$;
revoke all on function public.torneos_nodo_rol() from public, anon;
grant execute on function public.torneos_nodo_rol() to authenticated;

-- ------------------------------------------------------------ políticas del Editor
-- (las políticas son permisivas: se suman a las del admin)

-- leer: lo necesario para ver torneos, parejas, partidos y el padrón
do $$
declare t text;
begin
  foreach t in array array['torneos_nodo_torneos','torneos_nodo_instancias','torneos_nodo_parejas','torneos_nodo_partidos','torneos_nodo_jugadores'] loop
    execute format('drop policy if exists %I on public.%I', t || '_editor_leer', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.torneos_nodo_es_editor())', t || '_editor_leer', t);
  end loop;
end $$;

-- torneos: solo actualizar (estado, campeón y desempates los calcula la app al cargar resultados).
-- El insert existe porque la app guarda con "upsert", pero el trigger de abajo impide crear torneos nuevos.
drop policy if exists torneos_nodo_torneos_editor_escribir on public.torneos_nodo_torneos;
create policy torneos_nodo_torneos_editor_escribir on public.torneos_nodo_torneos for insert to authenticated
  with check (public.torneos_nodo_es_editor());
drop policy if exists torneos_nodo_torneos_editor_actualizar on public.torneos_nodo_torneos;
create policy torneos_nodo_torneos_editor_actualizar on public.torneos_nodo_torneos for update to authenticated
  using (public.torneos_nodo_es_editor()) with check (public.torneos_nodo_es_editor());

-- parejas: inscribir y editar (NO borrar)
drop policy if exists torneos_nodo_parejas_editor_insertar on public.torneos_nodo_parejas;
create policy torneos_nodo_parejas_editor_insertar on public.torneos_nodo_parejas for insert to authenticated
  with check (public.torneos_nodo_es_editor());
drop policy if exists torneos_nodo_parejas_editor_actualizar on public.torneos_nodo_parejas;
create policy torneos_nodo_parejas_editor_actualizar on public.torneos_nodo_parejas for update to authenticated
  using (public.torneos_nodo_es_editor()) with check (public.torneos_nodo_es_editor());

-- partidos: cargar resultados (crear la fila, actualizarla) y borrar solo filas sin horario
-- (pasa cuando se borra un resultado de un partido que no tenía día ni hora)
drop policy if exists torneos_nodo_partidos_editor_insertar on public.torneos_nodo_partidos;
create policy torneos_nodo_partidos_editor_insertar on public.torneos_nodo_partidos for insert to authenticated
  with check (public.torneos_nodo_es_editor());
drop policy if exists torneos_nodo_partidos_editor_actualizar on public.torneos_nodo_partidos;
create policy torneos_nodo_partidos_editor_actualizar on public.torneos_nodo_partidos for update to authenticated
  using (public.torneos_nodo_es_editor()) with check (public.torneos_nodo_es_editor());
drop policy if exists torneos_nodo_partidos_editor_borrar on public.torneos_nodo_partidos;
create policy torneos_nodo_partidos_editor_borrar on public.torneos_nodo_partidos for delete to authenticated
  using (public.torneos_nodo_es_editor() and fecha is null and hora is null and sede is null and cancha is null);

-- jugadores: al inscribir una pareja con un jugador nuevo, el trigger del padrón lo da de alta.
-- Solo alta: no puede renombrar, cambiar categoría ni borrar.
drop policy if exists torneos_nodo_jugadores_editor_alta on public.torneos_nodo_jugadores;
create policy torneos_nodo_jugadores_editor_alta on public.torneos_nodo_jugadores for insert to authenticated
  with check (public.torneos_nodo_es_editor());

-- ------------------------------------------------------------ columnas que el Editor no puede cambiar
-- Con el rol Editor, estos triggers pisan el valor nuevo con el que ya estaba.
-- Para el admin (y para el SQL Editor de Supabase) no hacen nada.

-- torneos: no crear torneos nuevos; al actualizar solo se aceptan estado, campeón, desempates y actualizado
create or replace function public.torneos_nodo_editor_torneos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.torneos_nodo_es_editor() then return new; end if;
  if tg_op = 'INSERT' then
    -- el upsert de la app entra por acá aunque el torneo exista: se deja pasar solo si ya existe
    if not exists (select 1 from public.torneos_nodo_torneos where id = new.id) then
      raise exception 'El rol Editor no puede crear torneos.' using errcode = '42501';
    end if;
    return new;
  end if;
  new := jsonb_populate_record(old, (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(to_jsonb(new)) as x(k, v)
    where k in ('estado', 'campeon', 'desempates', 'actualizado')
  ));
  return new;
end $$;

drop trigger if exists torneos_nodo_editor_torneos on public.torneos_nodo_torneos;
create trigger torneos_nodo_editor_torneos before insert or update on public.torneos_nodo_torneos
  for each row execute function public.torneos_nodo_editor_torneos();

-- parejas: las nuevas entran sin zona; al actualizar no se mueven de zona, ni de torneo, ni de orden
create or replace function public.torneos_nodo_editor_parejas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.torneos_nodo_es_editor() then return new; end if;
  if tg_op = 'INSERT' then
    new.zona := null;
    new.posicion := null;
    return new;
  end if;
  new := jsonb_populate_record(new, (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(to_jsonb(old)) as x(k, v)
    where k in ('torneo_id', 'orden', 'zona', 'posicion')
  ));
  return new;
end $$;

drop trigger if exists torneos_nodo_editor_parejas on public.torneos_nodo_parejas;
create trigger torneos_nodo_editor_parejas before insert or update on public.torneos_nodo_parejas
  for each row execute function public.torneos_nodo_editor_parejas();

-- partidos: no se cambian día, hora, sede ni cancha (reprogramar es del admin)
create or replace function public.torneos_nodo_editor_partidos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.torneos_nodo_es_editor() then return new; end if;
  if tg_op = 'INSERT' then
    new.fecha := null;
    new.hora := null;
    new.sede := null;
    new.cancha := null;
    return new;
  end if;
  new := jsonb_populate_record(new, (
    select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    from jsonb_each(to_jsonb(old)) as x(k, v)
    where k in ('fecha', 'hora', 'sede', 'cancha')
  ));
  return new;
end $$;

drop trigger if exists torneos_nodo_editor_partidos on public.torneos_nodo_partidos;
create trigger torneos_nodo_editor_partidos before insert or update on public.torneos_nodo_partidos
  for each row execute function public.torneos_nodo_editor_partidos();

-- ------------------------------------------------------------ usuario Editor
-- 1) Authentication → Users → Add user → Create new user
--    Email: nodo.editor@generador.nodo.com.ar · contraseña a elección · tildar "Auto Confirm User"
--    (en el login de la app se entra con usuario NODO y esa contraseña: la app prueba primero
--     con el admin y, si la contraseña no es la del admin, con el editor)
-- 2) Habilitarlo:
insert into public.torneos_nodo_editores (email)
values ('nodo.editor@generador.nodo.com.ar')
on conflict do nothing;
