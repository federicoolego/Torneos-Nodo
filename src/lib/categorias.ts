// Categorías de jugador de NODO y validación de parejas según el torneo (Suma N o categoría fija)
import type { CategoriaTorneo } from './torneo'

export const CATEGORIAS_JUGADOR = [
  '5ta Damas', '6ta Damas', '7ma Damas', '8va Damas',
  '3era Caballeros', '4ta Caballeros', '5ta Caballeros', '6ta Caballeros', '7ma Caballeros', '8va Caballeros',
] as const
export type CategoriaJugador = (typeof CATEGORIAS_JUGADOR)[number]
export type Rama = 'Damas' | 'Caballeros'

export const esCategoriaJugador = (v: unknown): v is CategoriaJugador => CATEGORIAS_JUGADOR.includes(v as CategoriaJugador)
/** 7ma Damas → 7 */
export const nivel = (c: CategoriaJugador) => parseInt(c, 10)
export const rama = (c: CategoriaJugador): Rama => (c.endsWith('Damas') ? 'Damas' : 'Caballeros')
/** 7ma Caballeros → "7ma C" (para listas compactas) */
export const corta = (c: CategoriaJugador) => `${c.split(' ')[0]} ${rama(c)[0]}`

const NOMBRE_NIVEL: Record<number, string> = { 1: '1ra', 2: '2da', 3: '3era', 4: '4ta', 5: '5ta', 6: '6ta', 7: '7ma', 8: '8va', 9: '9na' }

/** Qué exige el torneo, leído del nombre: "Suma 15 Damas" → suma 15 · "7ma Caballeros - Primavera" → categoría 7 */
export type Regla = { tipo: 'suma'; n: number } | { tipo: 'nivel'; n: number }

export function reglaDelTorneo(nombre: string): Regla | null {
  const s = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const suma = s.match(/\bsuma\s*(\d{1,2})\b/)
  if (suma) return { tipo: 'suma', n: Number(suma[1]) }
  const cat = s.match(/\b([1-9])\s*(?:era|ra|da|ta|ma|va|na|°|º)(?![a-z])/)
  if (cat) return { tipo: 'nivel', n: Number(cat[1]) }
  return null
}

/** Explicación de la regla, para mostrar al inscribir */
export function textoRegla(regla: Regla | null, categoria: CategoriaTorneo): string {
  const quienes = categoria === 'Mixto' ? 'una dama y un caballero' : `jugadores de ${categoria}`
  if (!regla) return `No se detectó “Suma N” ni categoría (ej. “7ma”) en el nombre del torneo: solo se valida que sean ${quienes}.`
  if (regla.tipo === 'suma') return `Suma ${regla.n}: ${quienes} cuyas categorías sumen ${regla.n} o más (ej. 7ma + 8va = 15).`
  const n = NOMBRE_NIVEL[regla.n] ?? `${regla.n}°`
  return `${n} ${categoria}: ${quienes} de ${n} o de una categoría menor (número más alto).`
}

/**
 * Tipo de torneo para agrupar en las estadísticas: "7ma Damas", "Suma 13 Caballeros"…
 * Si el nombre no lo dice, el propio nombre.
 */
export function tipoTorneo(nombre: string, categoria: CategoriaTorneo): string {
  const r = reglaDelTorneo(nombre)
  if (!r) return nombre.trim() || 'Sin nombre'
  return r.tipo === 'suma' ? `Suma ${r.n} ${categoria}` : `${NOMBRE_NIVEL[r.n] ?? `${r.n}°`} ${categoria}`
}

/** Orden de los tipos: por categoría (Damas, Caballeros, Mixto), primero las categorías fijas, después las sumas, de mejor a peor */
export function ordenarTipos(tipos: { tipo: string; categoria: CategoriaTorneo; nombre: string }[]): string[] {
  const ORDEN_CAT: Record<CategoriaTorneo, number> = { Damas: 0, Caballeros: 1, Mixto: 2 }
  const m = new Map<string, [number, number, number, string]>()
  for (const t of tipos) {
    const r = reglaDelTorneo(t.nombre)
    if (!m.has(t.tipo)) m.set(t.tipo, [ORDEN_CAT[t.categoria] ?? 3, r ? (r.tipo === 'nivel' ? 0 : 1) : 2, r?.n ?? 0, t.tipo])
  }
  return [...m.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3].localeCompare(b[3], 'es')).map((x) => x[3])
}

export interface Aptitud {
  /** ok: cumple · no: no cumple · incompleto: falta la categoría de algún jugador */
  estado: 'ok' | 'no' | 'incompleto'
  motivos: string[]
}

/** ¿La pareja puede inscribirse en el torneo? (los nombres son para los mensajes) */
export function aptitudPareja(
  regla: Regla | null, categoriaTorneo: CategoriaTorneo,
  j1: { nombre: string; categoria: CategoriaJugador | null }, j2: { nombre: string; categoria: CategoriaJugador | null },
): Aptitud {
  const sin = [j1, j2].filter((j) => !j.categoria)
  if (sin.length) return { estado: 'incompleto', motivos: sin.map((j) => `${j.nombre} no tiene categoría asignada`) }
  const a = j1.categoria!, b = j2.categoria!
  const motivos: string[] = []
  if (categoriaTorneo === 'Mixto') {
    if (rama(a) === rama(b)) motivos.push(`En Mixto va una dama y un caballero (los dos son de ${rama(a)})`)
  } else {
    for (const j of [j1, j2]) if (rama(j.categoria!) !== categoriaTorneo) motivos.push(`${j.nombre} es ${j.categoria}: el torneo es de ${categoriaTorneo}`)
  }
  if (regla?.tipo === 'suma') {
    const s = nivel(a) + nivel(b)
    if (s < regla.n) motivos.push(`Suman ${s} (${a.split(' ')[0]} + ${b.split(' ')[0]}): el mínimo para Suma ${regla.n} es ${regla.n}`)
  } else if (regla?.tipo === 'nivel') {
    for (const j of [j1, j2]) {
      if (nivel(j.categoria!) < regla.n) motivos.push(`${j.nombre} es ${j.categoria}: no puede jugar ${NOMBRE_NIVEL[regla.n] ?? regla.n} (es de una categoría mejor)`)
    }
  }
  return { estado: motivos.length ? 'no' : 'ok', motivos }
}
