// Datos de la página pública (jugadores): solo torneos publicados, vía funciones de la base (sin login)
import { supabase } from './supabase'
import { desdeFilas, type FilaInstancia, type FilaPareja, type FilaPartido, type FilaTorneo } from './almacen'
import type { Categoria, CategoriaTorneo, EstadoTorneo } from './torneo'
import { esAlcance, type Alcance } from './resultados'
import type { Victorias } from './puntos'

export interface ResumenPublico {
  id: string; nombre: string; categoria: CategoriaTorneo; fecha_inicio: string | null; fecha_fin: string | null; estado: EstadoTorneo
  inscripcion: number | null; premio: string; campeon: string | null; parejas: number
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

/** Torneo publicado completo (null si no existe o no está publicado) */
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

/** Para buscar sin importar mayúsculas ni acentos */
export const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
