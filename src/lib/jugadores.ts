// Padrón de jugadores (ABM del admin). En la base los nombres van en MAYÚSCULAS.
import { supabase, T } from './supabase'
import { mayusculas } from './torneo'
import { esCategoriaJugador, type CategoriaJugador } from './categorias'

export interface JugadorPadron { id: string; nombre: string; torneos: number; categoria: CategoriaJugador | null }

/** Aviso cuando falta correr supabase/torneos_nodo_jugadores_categoria.sql */
export const FALTA_SQL_CATEGORIA = 'Falta la columna de categoría de los jugadores: corré supabase/torneos_nodo_jugadores_categoria.sql en la base.'
/** columna inexistente (no se corrió el SQL de categorías) */
const sinColumna = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /column .*categoria.* does not exist|'categoria' column/i.test(e.message))

const chequear = (r: { error: { message: string; code?: string } | null }) => {
  if (!r.error) return
  if (r.error.code === '23505') throw new Error('Ya existe un jugador con ese nombre.')
  if (r.error.code === '23503') throw new Error('No se puede eliminar: el jugador participó de algún torneo.')
  throw new Error(r.error.message)
}

/** Padrón con id, nombre y categoría. `conCategoria` es false si todavía no se corrió el SQL de categorías */
export async function listarBase(): Promise<{ jugadores: { id: string; nombre: string; categoria: CategoriaJugador | null }[]; conCategoria: boolean }> {
  const jugadores: { id: string; nombre: string; categoria: CategoriaJugador | null }[] = []
  let conCategoria = true
  for (let desde = 0; ; desde += 1000) {
    const leer = (cols: string) => supabase.from(T.jugadores).select(cols).order('nombre').range(desde, desde + 999)
    let r = await leer(conCategoria ? 'id, nombre, categoria' : 'id, nombre')
    if (conCategoria && sinColumna(r.error)) {
      conCategoria = false
      r = await leer('id, nombre')
    }
    chequear(r)
    const filas = (r.data ?? []) as unknown as { id: string; nombre: string; categoria?: string | null }[]
    jugadores.push(...filas.map((j) => ({ id: j.id, nombre: j.nombre, categoria: esCategoriaJugador(j.categoria) ? j.categoria : null })))
    if (filas.length < 1000) break
  }
  return { jugadores, conCategoria }
}

/** Jugadores con la cantidad de torneos en los que participó */
export async function listarPadron(): Promise<JugadorPadron[]> {
  return (await listarPadronCompleto()).jugadores
}

export async function listarPadronCompleto(): Promise<{ jugadores: JugadorPadron[]; conCategoria: boolean }> {
  const { jugadores, conCategoria } = await listarBase()
  const torneos = new Map<string, Set<string>>()
  for (let desde = 0; ; desde += 1000) {
    const r = await supabase.from(T.parejas).select('torneo_id, jugador1_id, jugador2_id').order('id').range(desde, desde + 999)
    chequear(r)
    for (const p of (r.data ?? []) as { torneo_id: string; jugador1_id: string | null; jugador2_id: string | null }[]) {
      for (const j of [p.jugador1_id, p.jugador2_id]) if (j) torneos.set(j, (torneos.get(j) ?? new Set()).add(p.torneo_id))
    }
    if ((r.data ?? []).length < 1000) break
  }
  return { jugadores: jugadores.map((j) => ({ ...j, torneos: torneos.get(j.id)?.size ?? 0 })), conCategoria }
}

export async function agregarJugador(nombre: string, categoria: CategoriaJugador | null = null) {
  chequear(await supabase.from(T.jugadores).insert(categoria ? { nombre: mayusculas(nombre), categoria } : { nombre: mayusculas(nombre) }))
}

/** Asigna o cambia la categoría (null = sin asignar) */
export async function asignarCategoria(id: string, categoria: CategoriaJugador | null) {
  const r = await supabase.from(T.jugadores).update({ categoria }).eq('id', id)
  if (sinColumna(r.error)) throw new Error(FALTA_SQL_CATEGORIA)
  chequear(r)
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
