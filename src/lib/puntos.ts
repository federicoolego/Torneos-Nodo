// Ranking por puntos (individual, por jugador): lo que suma cada torneo
import { INSTANCIAS, type Instancia } from './torneo'

/** Por jugar un torneo (no cancelado) */
export const PUNTOS_PARTICIPACION = 5

/** Por cada partido ganado en esa instancia (el W.O. cuenta como ganado; las parejas libres / bye no suman) */
export const PUNTOS_VICTORIA: Record<Instancia, number> = {
  zonas: 1,
  '16avos': 1,
  octavos: 2,
  cuartos: 4,
  semifinal: 6,
  final: 10,
}

/** Partidos ganados por instancia de una pareja en un torneo */
export type Victorias = Partial<Record<Instancia, number>>

const NOMBRE_CORTO: Record<Instancia, string> = { zonas: 'Zona', '16avos': '16avos', octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semi', final: 'Final' }

export interface LineaPuntos { concepto: string; cantidad: number; unitario: number; puntos: number }

/** Desglose de un torneo: participación + partidos ganados por instancia (solo las que suman) */
export function desglose(v: Victorias | null | undefined): LineaPuntos[] {
  const out: LineaPuntos[] = [{ concepto: 'Participación', cantidad: 1, unitario: PUNTOS_PARTICIPACION, puntos: PUNTOS_PARTICIPACION }]
  for (const { id } of INSTANCIAS) {
    const n = v?.[id] ?? 0
    if (n > 0) out.push({ concepto: NOMBRE_CORTO[id], cantidad: n, unitario: PUNTOS_VICTORIA[id], puntos: n * PUNTOS_VICTORIA[id] })
  }
  return out
}

/** Puntos de un jugador en un torneo */
export const puntosTorneo = (v: Victorias | null | undefined) => desglose(v).reduce((s, l) => s + l.puntos, 0)

/** "5 por torneo jugado; por partido ganado: Zonas 1 · 16avos 1 · Octavos 2 · …" (para la ayuda) */
export const textoReglas = () =>
  `${PUNTOS_PARTICIPACION} por torneo jugado; por partido ganado: ${INSTANCIAS.map((i) => `${i.nombre} ${PUNTOS_VICTORIA[i.id]}`).join(' · ')}`
