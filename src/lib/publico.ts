// Datos de la página pública (jugadores): solo torneos publicados, vía funciones de la base (sin login)
import { supabase } from './supabase'
import { desdeFilas, type FilaInstancia, type FilaPareja, type FilaPartido, type FilaTorneo } from './almacen'
import type { Categoria, EstadoTorneo } from './torneo'

export interface ResumenPublico {
  id: string; nombre: string; fecha_inicio: string | null; fecha_fin: string | null; estado: EstadoTorneo
  inscripcion: number | null; premio: string; campeon: string | null; parejas: number
}

export async function listarPublicos(): Promise<ResumenPublico[]> {
  const { data, error } = await supabase.rpc('torneos_nodo_publicos')
  if (error) throw new Error(error.message)
  return (data ?? []) as ResumenPublico[]
}

/** Torneo publicado completo (null si no existe o no está publicado) */
export async function cargarPublico(id: string): Promise<Categoria | null> {
  const { data, error } = await supabase.rpc('torneos_nodo_publico', { p_id: id })
  if (error) throw new Error(error.message)
  if (!data) return null
  const d = data as { torneo: FilaTorneo & { actualizado: string }; parejas: FilaPareja[]; instancias: FilaInstancia[]; partidos: FilaPartido[] }
  return desdeFilas(d.torneo, d.parejas, d.instancias, d.partidos)
}

/** Para buscar sin importar mayúsculas ni acentos */
export const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
