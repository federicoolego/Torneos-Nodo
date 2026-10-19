-- =====================================================================
-- Generador de Torneos · NODO — "Armar fecha" (zonas y horarios automáticos)
-- Correr UNA vez en el SQL Editor, ANTES de subir la versión nueva de la app.
-- Solo AGREGA cosas: no borra ni modifica torneos, parejas, partidos ni resultados.
-- Idempotente: se puede volver a correr sin perder datos.
-- =====================================================================

-- ------------------------------------------------------------ disponibilidad de cada pareja
-- { "dias": { "2026-10-16": [{"desde":"19:00","hasta":""}], "2026-10-17": [] },
--   "zona": ["2026-10-16"], "preferencia": "temprano" }
-- null = sin cargar (se toma como sin restricciones)
alter table public.torneos_nodo_parejas add column if not exists disponibilidad jsonb;

-- ------------------------------------------------------------ cancha de cada partido (1, 2, 3…)
alter table public.torneos_nodo_partidos add column if not exists cancha smallint;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'torneos_nodo_partidos_cancha_chk') then
    alter table public.torneos_nodo_partidos
      add constraint torneos_nodo_partidos_cancha_chk check (cancha is null or cancha between 1 and 20);
  end if;
end $$;

-- ------------------------------------------------------------ fechas (varios torneos que se juegan juntos)
create table if not exists public.torneos_nodo_jornadas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null default '',
  -- torneos de la fecha (si se elimina un torneo, la app lo ignora)
  torneos     uuid[] not null default '{}',
  -- canchas, horario de apertura por día, duración por instancia, descansos
  config      jsonb not null default '{}'::jsonb,
  -- última propuesta de horarios (partido → día, hora, cancha, fijo)
  plan        jsonb,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

drop trigger if exists torneos_nodo_jornadas_upd on public.torneos_nodo_jornadas;
create trigger torneos_nodo_jornadas_upd before update on public.torneos_nodo_jornadas
  for each row execute function public.torneos_nodo_set_actualizado();

alter table public.torneos_nodo_jornadas enable row level security;
drop policy if exists torneos_nodo_jornadas_acceso on public.torneos_nodo_jornadas;
create policy torneos_nodo_jornadas_acceso on public.torneos_nodo_jornadas for all to authenticated
  using (public.torneos_nodo_es_usuario()) with check (public.torneos_nodo_es_usuario());
revoke all on public.torneos_nodo_jornadas from anon;
grant select, insert, update, delete on public.torneos_nodo_jornadas to authenticated;

-- control
select
  (select count(*) from information_schema.columns where table_name = 'torneos_nodo_parejas' and column_name = 'disponibilidad') as col_disponibilidad,
  (select count(*) from information_schema.columns where table_name = 'torneos_nodo_partidos' and column_name = 'cancha') as col_cancha,
  (select count(*) from public.torneos_nodo_jornadas) as fechas;
