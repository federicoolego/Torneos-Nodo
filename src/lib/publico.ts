// Datos de la página pública (jugadores): solo torneos publicados, vía funciones de la base (sin login)

/**
 * Categorías de jugador en la página pública: pestaña "Categorías" y filtro "Categorías" de Estadísticas.
 * false = ocultas (el admin las sigue viendo y editando) · true = visibles para todos.
 */
export const MOSTRAR_CATEGORIAS_PUBLICAS = true

/**
 * Pestaña pública "Ascensos": las recategorizaciones (6ta → 7ma) de las tandas publicadas también se muestran.
 * false = solo los ascensos (las recategorizaciones siguen en el admin y en sus imágenes).
 */
export const MOSTRAR_RECATEGORIZACIONES_PUBLICAS = true

/** WhatsApp del club para las inscripciones (torneos publicados "solo info"): código de país + área + número, sin + ni espacios */
export const WHATSAPP_INSCRIPCIONES = '543407522292'

/** Link de WhatsApp para inscribirse, con el mensaje ya escrito ("Hola! Quiero inscribirme en el torneo …") */
export function linkInscripcion(torneo: string, fechas?: string): string {
  const texto = `Hola! Quiero inscribirme en el torneo ${torneo}${fechas ? ` (${fechas})` : ''}.`
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_INSCRIPCIONES}&text=${encodeURIComponent(texto)}`
}
import { supabase } from './supabase'
import { desdeFilas, type FilaInstancia, type FilaPareja, type FilaPartido, type FilaTorneo } from './almacen'
import type { Categoria, CategoriaTorneo, EstadoTorneo } from './torneo'
import { esAlcance, type Alcance } from './resultados'
import type { Victorias } from './puntos'

export interface ResumenPublico {
  id: string; nombre: string; categoria: CategoriaTorneo; fecha_inicio: string | null; fecha_fin: string | null; estado: EstadoTorneo
  inscripcion: number | null; premio: string; campeon: string | null; parejas: number
  /** publicado solo con la info del torneo: llega sin parejas ni jugadores (inscripción abierta). Requiere torneos_nodo_solo_info.sql */
  solo_info?: boolean
  /** jugadores inscriptos (para las estadísticas); llega vacío si no se corrió torneos_nodo_publico_estadisticas.sql */
  jugadores?: string[]
  /** parejas [jugador1, jugador2, hasta dónde llegó, partidos ganados por instancia] (compañero, instancia y ranking de puntos);
   *  la instancia requiere torneos_nodo_alcance.sql y las victorias, torneos_nodo_publico_puntos.sql */
  duplas?: [string, string, (Alcance | null)?, Victorias?][]
}

export async function listarPublicos(): Promise<ResumenPublico[]> {
  const { data, error } = await supabase.rpc('torneos_nodo_publicos')
  if (error) throw new Error(error.message)
  return ((data ?? []) as ResumenPublico[]).map((t) => ({ ...t, jugadores: (t.jugadores ?? []).filter((j) => j?.trim()), duplas: (t.duplas ?? []).map(([a, b, x, v]) => [a, b, esAlcance(x) ? x : null, v && typeof v === 'object' ? v : {}]) }))
}

/** Torneo publicado completo (null si no existe o no está publicado). Si está publicado "solo info", llega sin parejas ni partidos (soloInfo = true) */
export async function cargarPublico(id: string): Promise<Categoria | null> {
  const { data, error } = await supabase.rpc('torneos_nodo_publico', { p_id: id })
  if (error) throw new Error(error.message)
  if (!data) return null
  const d = data as { torneo: FilaTorneo & { actualizado: string }; parejas: FilaPareja[]; instancias: FilaInstancia[]; partidos: FilaPartido[] }
  return desdeFilas(d.torneo, d.parejas, d.instancias, d.partidos)
}

/**
 * Torneos publicados (no cancelados) con partidos entre esas fechas ('YYYY-MM-DD'), completos,
 * para el calendario. Requiere supabase/torneos_nodo_calendario.sql
 */
export async function cargarCalendario(desde: string, hasta: string): Promise<Categoria[]> {
  const { data, error } = await supabase.rpc('torneos_nodo_calendario', { p_desde: desde, p_hasta: hasta })
  if (error) throw new Error(error.message)
  type D = { torneo: FilaTorneo & { actualizado: string }; parejas: FilaPareja[]; instancias: FilaInstancia[]; partidos: FilaPartido[] }
  return ((data ?? []) as D[]).map((d) => desdeFilas(d.torneo, d.parejas, d.instancias, d.partidos))
}

/** Un cambio de categoría publicado */
export interface MovimientoPublico { nombre: string; anterior: string; nueva: string; tipo: 'ascenso' | 'recategorizacion' }
/** Tanda de ascensos publicada por el admin, con sus movimientos */
export interface TandaPublica { id: string; nombre: string; vigencia: string; aplicada: string | null; movimientos: MovimientoPublico[] }

/**
 * Tandas de ascensos y recategorizaciones publicadas, de la más nueva a la más vieja (pestaña Ascensos).
 * Requiere supabase/torneos_nodo_publico_ascensos.sql
 */
export async function ascensosPublicos(): Promise<TandaPublica[]> {
  const { data, error } = await supabase.rpc('torneos_nodo_publico_ascensos')
  if (error) throw new Error(error.message)
  return ((data ?? []) as TandaPublica[]).map((t) => ({ ...t, movimientos: t.movimientos ?? [] }))
}

/** Para buscar sin importar mayúsculas ni acentos */
export const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

/**
 * Categoría actual de los jugadores con categoría asignada (pestaña Categorías y filtro "Categorías" de las estadísticas).
 * Requiere supabase/torneos_nodo_publico_categorias.sql
 */
export async function categoriasPublicas(): Promise<{ nombre: string; categoria: string | null }[]> {
  const { data, error } = await supabase.rpc('torneos_nodo_publico_categorias')
  if (error) throw new Error(error.message)
  return (data ?? []) as { nombre: string; categoria: string | null }[]
}
