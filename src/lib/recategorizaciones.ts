// Ascensos y recategorizaciones por "tanda" (pestaña Ascensos del admin).
// Una tanda en borrador no toca las categorías del padrón; al aplicarla se pasan todas juntas (RPC en la base).
import { supabase, T } from './supabase'
import { esCategoriaJugador, tipoMovimiento, type CategoriaJugador, type TipoMovimiento } from './categorias'

export type EstadoTanda = 'borrador' | 'aplicada'

export interface Tanda {
  id: string
  nombre: string
  /** AAAA-MM-DD */
  vigencia: string
  estado: EstadoTanda
  aplicada: string | null
  creado: string
  ascensos: number
  recategorizaciones: number
}

export interface Movimiento {
  id: string
  jugadorId: string | null
  /** nombre guardado (MAYÚSCULAS); si el jugador sigue en el padrón, el actual */
  nombre: string
  anterior: CategoriaJugador
  nueva: CategoriaJugador
  tipo: TipoMovimiento
  /** categoría que tiene hoy en el padrón (null: sin categoría o eliminado) */
  actual: CategoriaJugador | null
  /** el jugador sigue en el padrón */
  enPadron: boolean
}

/** Aviso cuando falta correr supabase/torneos_nodo_recategorizaciones.sql */
export const FALTA_SQL_RECAT = 'Faltan las tablas de ascensos: corré supabase/torneos_nodo_recategorizaciones.sql en la base.'
const sinTabla = (e: { code?: string; message: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|could not find the (table|function)/i.test(e.message))

const chequear = (r: { error: { message: string; code?: string } | null }) => {
  if (!r.error) return
  if (sinTabla(r.error)) throw new Error(FALTA_SQL_RECAT)
  if (r.error.code === '23505') throw new Error('Ese jugador ya está en esta tanda.')
  throw new Error(r.error.message)
}

/** Nombre sugerido para una tanda nueva: "Recategorización Octubre 2026" */
export function nombreSugerido(d = new Date()): string {
  const mes = d.toLocaleDateString('es-AR', { month: 'long' })
  return `Recategorización ${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`
}

/** Hoy en AAAA-MM-DD (hora local) */
export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 2026-11-01 → 01/11/2026 */
export const fechaCorta = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-'); return a && m && d ? `${d}/${m}/${a}` : iso }

/** Tandas de la más nueva a la más vieja, con la cantidad de ascensos y recategorizaciones */
export async function listarTandas(): Promise<Tanda[]> {
  const r = await supabase.from(T.recategorizaciones).select('id, nombre, vigencia, estado, aplicada, creado').order('vigencia', { ascending: false }).order('creado', { ascending: false })
  chequear(r)
  const tandas = (r.data ?? []) as Omit<Tanda, 'ascensos' | 'recategorizaciones'>[]
  const cuentas = new Map<string, { a: number; r: number }>()
  for (let desde = 0; ; desde += 1000) {
    const m = await supabase.from(T.recatMovimientos).select('recategorizacion_id, tipo').order('id').range(desde, desde + 999)
    chequear(m)
    for (const x of (m.data ?? []) as { recategorizacion_id: string; tipo: TipoMovimiento }[]) {
      const c = cuentas.get(x.recategorizacion_id) ?? { a: 0, r: 0 }
      if (x.tipo === 'ascenso') c.a++; else c.r++
      cuentas.set(x.recategorizacion_id, c)
    }
    if ((m.data ?? []).length < 1000) break
  }
  return tandas.map((t) => ({ ...t, ascensos: cuentas.get(t.id)?.a ?? 0, recategorizaciones: cuentas.get(t.id)?.r ?? 0 }))
}

export async function crearTanda(nombre: string, vigencia: string): Promise<string> {
  const r = await supabase.from(T.recategorizaciones).insert({ nombre: nombre.trim(), vigencia }).select('id').single()
  chequear(r)
  return (r.data as { id: string }).id
}

export async function editarTanda(id: string, nombre: string, vigencia: string) {
  chequear(await supabase.from(T.recategorizaciones).update({ nombre: nombre.trim(), vigencia }).eq('id', id))
}

/** Borra la tanda y sus movimientos. Si estaba aplicada, las categorías de los jugadores quedan como están */
export async function eliminarTanda(id: string) {
  chequear(await supabase.from(T.recategorizaciones).delete().eq('id', id))
}

export async function leerTanda(id: string): Promise<{ tanda: Omit<Tanda, 'ascensos' | 'recategorizaciones'>; movimientos: Movimiento[] }> {
  const t = await supabase.from(T.recategorizaciones).select('id, nombre, vigencia, estado, aplicada, creado').eq('id', id).single()
  chequear(t)
  const m = await supabase.from(T.recatMovimientos)
    .select(`id, jugador_id, nombre, categoria_anterior, categoria_nueva, jugador:${T.jugadores}(nombre, categoria)`)
    .eq('recategorizacion_id', id)
  chequear(m)
  type Fila = { id: string; jugador_id: string | null; nombre: string; categoria_anterior: string; categoria_nueva: string; jugador: { nombre: string; categoria: string | null } | null }
  const movimientos = ((m.data ?? []) as unknown as Fila[])
    .filter((f) => esCategoriaJugador(f.categoria_anterior) && esCategoriaJugador(f.categoria_nueva))
    .map((f): Movimiento => {
      const anterior = f.categoria_anterior as CategoriaJugador, nueva = f.categoria_nueva as CategoriaJugador
      return {
        id: f.id, jugadorId: f.jugador_id, nombre: f.jugador?.nombre ?? f.nombre, anterior, nueva, tipo: tipoMovimiento(anterior, nueva),
        actual: esCategoriaJugador(f.jugador?.categoria) ? f.jugador!.categoria as CategoriaJugador : null, enPadron: !!f.jugador,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { tanda: t.data as Omit<Tanda, 'ascensos' | 'recategorizaciones'>, movimientos }
}

export async function agregarMovimiento(tandaId: string, j: { id: string; nombre: string; categoria: CategoriaJugador }, nueva: CategoriaJugador) {
  chequear(await supabase.from(T.recatMovimientos).insert({
    recategorizacion_id: tandaId, jugador_id: j.id, nombre: j.nombre, categoria_anterior: j.categoria, categoria_nueva: nueva,
  }))
}

export async function cambiarMovimiento(id: string, cambios: { nueva?: CategoriaJugador; anterior?: CategoriaJugador }) {
  const datos: Record<string, string> = {}
  if (cambios.nueva) datos.categoria_nueva = cambios.nueva
  if (cambios.anterior) datos.categoria_anterior = cambios.anterior
  chequear(await supabase.from(T.recatMovimientos).update(datos).eq('id', id))
}

export async function quitarMovimiento(id: string) {
  chequear(await supabase.from(T.recatMovimientos).delete().eq('id', id))
}

/** Pasa las categorías nuevas al padrón. Devuelve cuántos jugadores se actualizaron */
export async function aplicarTanda(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('torneos_nodo_recategorizacion_aplicar', { p_id: id })
  chequear({ error })
  return Number(data ?? 0)
}

/** Devuelve a los jugadores a la categoría anterior y la tanda vuelve a borrador */
export async function revertirTanda(id: string): Promise<number> {
  const { data, error } = await supabase.rpc('torneos_nodo_recategorizacion_revertir', { p_id: id })
  chequear({ error })
  return Number(data ?? 0)
}
