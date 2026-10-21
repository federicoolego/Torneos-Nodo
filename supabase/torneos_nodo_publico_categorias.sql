-- =====================================================================
-- Generador de Torneos · NODO — categorías de jugador en la página pública
-- (requiere torneos_nodo_jugadores_categoria.sql)
-- · torneos_nodo_publico_categorias(): nombre y categoría actual de los jugadores con categoría asignada
--   que jugaron algún torneo publicado (para el filtro "Categorías" de Estadísticas). Sin login.
-- Idempotente: se puede volver a correr.
-- =====================================================================

create or replace function public.torneos_nodo_publico_categorias()
returns table (nombre text, categoria text)
language sql stable security definer set search_path = public as $$
  select j.nombre, j.categoria
    from public.torneos_nodo_jugadores j
   where j.categoria is not null
     and exists (
       select 1 from public.torneos_nodo_parejas p
         join public.torneos_nodo_torneos t on t.id = p.torneo_id
        where t.publicado and (p.jugador1_id = j.id or p.jugador2_id = j.id)
     )
$$;

revoke all on function public.torneos_nodo_publico_categorias() from public;
grant execute on function public.torneos_nodo_publico_categorias() to anon, authenticated;

-- control: jugadores por categoría visibles en la página pública
select categoria, count(*) from public.torneos_nodo_publico_categorias() group by 1 order by 1;
