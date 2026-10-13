-- =====================================================================
-- Generador de Torneos · NODO — padrón de jugadores
-- · torneos_nodo_jugadores: un registro por jugador, nombre en MAYÚSCULAS (único)
-- · las parejas guardan jugador1/jugador2 en mayúsculas + jugador1_id/jugador2_id
-- · un trigger normaliza los nombres y da de alta al jugador si no existe
-- · migra lo que ya está cargado
-- Idempotente: se puede volver a correr.
-- =====================================================================

-- mayúsculas sin depender del locale de la base (á→Á, ñ→Ñ…) y espacios normalizados
create or replace function public.torneos_nodo_mayus(t text)
returns text language sql immutable as $$
  select upper(translate(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), 'áéíóúüñàèìòùâêîôûç', 'ÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÇ'))
$$;

create table if not exists public.torneos_nodo_jugadores (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null unique check (nombre <> '' and nombre = public.torneos_nodo_mayus(nombre)),
  creado  timestamptz not null default now()
);

alter table public.torneos_nodo_parejas add column if not exists jugador1_id uuid references public.torneos_nodo_jugadores(id);
alter table public.torneos_nodo_parejas add column if not exists jugador2_id uuid references public.torneos_nodo_jugadores(id);
create index if not exists torneos_nodo_parejas_j1_idx on public.torneos_nodo_parejas (jugador1_id);
create index if not exists torneos_nodo_parejas_j2_idx on public.torneos_nodo_parejas (jugador2_id);

-- al guardar una pareja: nombres en mayúsculas, alta del jugador si no existe y vínculo por id
create or replace function public.torneos_nodo_parejas_jugadores()
returns trigger language plpgsql as $$
begin
  new.jugador1 := public.torneos_nodo_mayus(new.jugador1);
  new.jugador2 := public.torneos_nodo_mayus(new.jugador2);
  insert into public.torneos_nodo_jugadores (nombre)
    select x from unnest(array[new.jugador1, new.jugador2]) x where x <> ''
  on conflict (nombre) do nothing;
  select id into new.jugador1_id from public.torneos_nodo_jugadores where nombre = new.jugador1;
  select id into new.jugador2_id from public.torneos_nodo_jugadores where nombre = new.jugador2;
  return new;
end $$;

drop trigger if exists torneos_nodo_parejas_jugadores on public.torneos_nodo_parejas;
create trigger torneos_nodo_parejas_jugadores before insert or update of jugador1, jugador2 on public.torneos_nodo_parejas
  for each row execute function public.torneos_nodo_parejas_jugadores();

-- seguridad: igual que el resto de las tablas
alter table public.torneos_nodo_jugadores enable row level security;
drop policy if exists torneos_nodo_jugadores_acceso on public.torneos_nodo_jugadores;
create policy torneos_nodo_jugadores_acceso on public.torneos_nodo_jugadores for all to authenticated
  using (public.torneos_nodo_es_usuario()) with check (public.torneos_nodo_es_usuario());
revoke all on public.torneos_nodo_jugadores from anon;
grant select, insert, update, delete on public.torneos_nodo_jugadores to authenticated;

-- migración: pasa a mayúsculas lo ya cargado y arma el padrón (dispara el trigger)
update public.torneos_nodo_parejas set jugador1 = jugador1 where jugador1_id is null or jugador2_id is null;

-- control: jugadores registrados
select count(*) as jugadores from public.torneos_nodo_jugadores;
