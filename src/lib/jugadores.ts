// Padrón de jugadores (ABM del admin). En la base los nombres van en MAYÚSCULAS.
import { supabase, T } from './supabase'
import { mayusculas } from './torneo'

export interface JugadorPadron { id: string; nombre: string; torneos: number }

const chequear = (r: { error: { message: string; code?: string } | null }) => {
  if (!r.error) return
  if (r.error.code === '23505') throw new Error('Ya existe un jugador con ese nombre.')
  if (r.error.code === '23503') throw new Error('No se puede eliminar: el jugador participó de algún torneo.')
  throw new Error(r.error.message)
}

/** Jugadores con la cantidad de torneos en los que participó */
export async function listarPadron(): Promise<JugadorPadron[]> {
  const jugadores: { id: string; nombre: string }[] = []
  for (let desde = 0; ; desde += 1000) {
    const r = await supabase.from(T.jugadores).select('id, nombre').order('nombre').range(desde, desde + 999)
    chequear(r)
    jugadores.push(...((r.data ?? []) as { id: string; nombre: string }[]))
    if ((r.data ?? []).length < 1000) break
  }
  const torneos = new Map<string, Set<string>>()
  for (let desde = 0; ; desde += 1000) {
    const r = await supabase.from(T.parejas).select('torneo_id, jugador1_id, jugador2_id').order('id').range(desde, desde + 999)
    chequear(r)
    for (const p of (r.data ?? []) as { torneo_id: string; jugador1_id: string | null; jugador2_id: string | null }[]) {
      for (const j of [p.jugador1_id, p.jugador2_id]) if (j) torneos.set(j, (torneos.get(j) ?? new Set()).add(p.torneo_id))
    }
    if ((r.data ?? []).length < 1000) break
  }
  return jugadores.map((j) => ({ ...j, torneos: torneos.get(j.id)?.size ?? 0 }))
}

export async function agregarJugador(nombre: string) {
  chequear(await supabase.from(T.jugadores).insert({ nombre: mayusculas(nombre) }))
}

/** Renombra (la base actualiza el nombre en todas sus parejas) */
export async function renombrarJugador(id: string, nombre: string) {
  chequear(await supabase.from(T.jugadores).update({ nombre: mayusculas(nombre) }).eq('id', id))
}

/** Solo si no jugó ningún torneo (si jugó, la base lo impide) */
export async function eliminarJugador(id: string) {
  chequear(await supabase.from(T.jugadores).delete().eq('id', id))
}

/** Las parejas de "origen" pasan a "destino" y "origen" se elimina */
export async function unificarJugadores(origen: string, destino: string) {
  const { error } = await supabase.rpc('torneos_nodo_jugadores_unificar', { p_origen: origen, p_destino: destino })
  if (error) throw new Error(error.message)
}
