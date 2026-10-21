-- =====================================================================
-- Generador de Torneos · NODO — categorías de jugador en la página pública
-- (requiere torneos_nodo_jugadores_categoria.sql)
-- · torneos_nodo_publico_categorias(): nombre y categoría actual de TODOS los jugadores con categoría asignada
--   (los "sin categoría" no salen). La usan la pestaña pública Categorías y el filtro "Categorías" de Estadísticas.
--   Sin login, solo lectura.
-- Idempotente: se puede volver a correr (reemplaza la versión anterior, que solo traía a quienes jugaron un torneo publicado).
-- =====================================================================

create or replace function public.torneos_nodo_publico_categorias()
returns table (nombre text, categoria text)
language sql stable security definer set search_path = public as $$
  select j.nombre, j.categoria
    from public.torneos_nodo_jugadores j
   where j.categoria is not null
   order by j.nombre
$$;

revoke all on function public.torneos_nodo_publico_categorias() from public;
grant execute on function public.torneos_nodo_publico_categorias() to anon, authenticated;

-- control: jugadores por categoría visibles en la página pública
select categoria, count(*) from public.torneos_nodo_publico_categorias() group by 1 order by 1;
