-- =====================================================================
-- Generador de Torneos · NODO — ABM de jugadores (requiere torneos_nodo_jugadores.sql)
-- · renombrar un jugador actualiza su nombre en todas las parejas
-- · unificar: las parejas de un jugador pasan a otro y el primero se elimina
-- · eliminar: solo si no jugó ningún torneo (lo impide la FK de las parejas)
-- Idempotente: se puede volver a correr.
-- =====================================================================

-- al renombrar en el padrón, el nombre se actualiza en las parejas (que lo guardan como texto)
create or replace function public.torneos_nodo_jugadores_renombrar()
returns trigger language plpgsql as $$
begin
  update public.torneos_nodo_parejas set jugador1 = new.nombre where jugador1_id = new.id and jugador1 <> new.nombre;
  update public.torneos_nodo_parejas set jugador2 = new.nombre where jugador2_id = new.id and jugador2 <> new.nombre;
  return null;
end $$;

drop trigger if exists torneos_nodo_jugadores_renombrar on public.torneos_nodo_jugadores;
create trigger torneos_nodo_jugadores_renombrar after update of nombre on public.torneos_nodo_jugadores
  for each row execute function public.torneos_nodo_jugadores_renombrar();

-- unificar dos registros del mismo jugador: todo pasa a "destino" y "origen" se elimina
create or replace function public.torneos_nodo_jugadores_unificar(p_origen uuid, p_destino uuid)
returns void language plpgsql as $$
declare v_nombre text;
begin
  if p_origen = p_destino then raise exception 'Elegí dos jugadores distintos'; end if;
  select nombre into v_nombre from public.torneos_nodo_jugadores where id = p_destino;
  if v_nombre is null then raise exception 'No existe el jugador destino'; end if;
  update public.torneos_nodo_parejas set jugador1 = v_nombre where jugador1_id = p_origen;
  update public.torneos_nodo_parejas set jugador2 = v_nombre where jugador2_id = p_origen;
  delete from public.torneos_nodo_jugadores where id = p_origen;
end $$;

revoke all on function public.torneos_nodo_jugadores_unificar(uuid, uuid) from public, anon;
grant execute on function public.torneos_nodo_jugadores_unificar(uuid, uuid) to authenticated;
