// Resultados: validación según el formato, tabla de cada zona y avance del playoff
import {
  INSTANCIAS, LETRAS, clasificados, erroresCuadro, etiquetaSlot, instanciaDeRonda, instanciaDeTam, partidosDeZona, rondasPlayoff, tamCuadro,
  type Categoria, type EstadoTorneo, type Formato, type Instancia, type Resultado,
} from './torneo'

// ------------------------------------------------------------------ validación

export const esAmericano = (f: Formato) => f === 'americano_7' || f === 'americano_9'
export const gamesAmericano = (f: Formato) => (f === 'americano_7' ? 7 : 9)
/** Cantidad de sets que se cargan como máximo */
export const setsMax = (f: Formato) => (esAmericano(f) ? 1 : 3)

export interface Evaluacion {
  ok: boolean
  error?: string
  ganador?: 'a' | 'b'
  setsA: number; setsB: number
  gamesA: number; gamesB: number
}

const entero = (n: number) => Number.isInteger(n) && n >= 0 && n <= 99
/** Set común: 6-0…6-4, 7-5 o 7-6 */
const setNormal = (x: number, y: number) => {
  const w = Math.max(x, y), l = Math.min(x, y)
  return (w === 6 && l <= 4) || (w === 7 && (l === 5 || l === 6))
}
/** Puntos del super tiebreak (3er set del formato "mejor_de_3_stb") */
export const SUPER_TB = 11
/** Super tiebreak a 11 con 2 de diferencia: 11-0…11-9; si llegan 10-10, se sigue hasta sacar 2 (12-10, 13-11…) */
const superTb = (x: number, y: number) => {
  const w = Math.max(x, y), l = Math.min(x, y)
  return w === SUPER_TB ? l <= SUPER_TB - 2 : w > SUPER_TB && w - l === 2
}

const sinResultado: Evaluacion = { ok: false, setsA: 0, setsB: 0, gamesA: 0, gamesB: 0 }

/** Valida un resultado contra el formato y calcula sets y games de cada lado */
export function evaluar(f: Formato, r: Pick<Resultado, 'sets' | 'wo'>): Evaluacion {
  if (r.wo) {
    // el W.O. cuenta como el resultado más amplio posible: 6-0 6-0 o N-0
    const g = esAmericano(f) ? gamesAmericano(f) : 12
    const s = esAmericano(f) ? 1 : 2
    return r.wo === 'a'
      ? { ok: true, ganador: 'a', setsA: s, setsB: 0, gamesA: g, gamesB: 0 }
      : { ok: true, ganador: 'b', setsA: 0, setsB: s, gamesA: 0, gamesB: g }
  }
  const sets = r.sets ?? []
  if (!sets.length) return { ...sinResultado, error: 'Cargá el resultado.' }
  if (sets.some(([x, y]) => !entero(x) || !entero(y))) return { ...sinResultado, error: 'Los games tienen que ser números enteros.' }

  if (esAmericano(f)) {
    const n = gamesAmericano(f)
    if (sets.length !== 1) return { ...sinResultado, error: 'El americano se juega a un solo set.' }
    const [x, y] = sets[0]
    if (Math.max(x, y) !== n || Math.min(x, y) > n - 1) return { ...sinResultado, error: `A ${n} games: el ganador llega a ${n} (por ejemplo ${n}-${n - 3} o ${n}-${n - 1}).` }
    return { ok: true, ganador: x > y ? 'a' : 'b', setsA: x > y ? 1 : 0, setsB: x > y ? 0 : 1, gamesA: x, gamesB: y }
  }

  if (sets.length < 2) return { ...sinResultado, error: 'Faltan sets.' }
  if (sets.length > 3) return { ...sinResultado, error: 'Son 3 sets como máximo.' }
  let sa = 0, sb = 0, ga = 0, gb = 0
  for (let i = 0; i < sets.length; i++) {
    const [x, y] = sets[i]
    if (sa === 2 || sb === 2) return { ...sinResultado, error: 'El partido ya estaba definido en 2 sets: sobra el 3ro.' }
    const stb = i === 2 && f === 'mejor_de_3_stb'
    if (stb ? !superTb(x, y) : !setNormal(x, y)) {
      return { ...sinResultado, error: stb ? `Super tiebreak inválido (${x}-${y}): es a ${SUPER_TB}, con 2 de diferencia (ej. ${SUPER_TB}-${SUPER_TB - 3} o ${SUPER_TB + 2}-${SUPER_TB}).` : `Set ${i + 1} inválido (${x}-${y}).` }
    }
    if (x > y) sa++; else sb++
    // el super tiebreak cuenta como un game para el que lo gana
    if (stb) { if (x > y) ga++; else gb++ } else { ga += x; gb += y }
  }
  if (sa < 2 && sb < 2) return { ...sinResultado, error: '1 set cada uno: falta el 3ro.' }
  return { ok: true, ganador: sa > sb ? 'a' : 'b', setsA: sa, setsB: sb, gamesA: ga, gamesB: gb }
}

/** "6-4 3-6 10-8" (desde el lado A) · "W.O." */
export function textoResultado(r: Resultado | undefined): string {
  if (!r) return ''
  if (r.wo) return 'W.O.'
  return r.sets.map(([x, y]) => `${x}-${y}`).join(' ')
}

// ------------------------------------------------------------------ partidos resueltos

/**
 * esperando: todavía no se sabe quién lo juega · pendiente: se puede cargar · jugado: resultado válido
 * desactualizado: el resultado es de otras parejas · invalido: no cumple el formato actual · libre: bye
 */
export type Estado = 'esperando' | 'pendiente' | 'jugado' | 'desactualizado' | 'invalido' | 'libre'

export interface Partido {
  /** clave de horarios y resultados (`${zona}-${n}` o `${ronda}-${orden}`) */
  key: string
  tipo: 'zona' | 'playoff'
  instancia: Instancia
  formato: Formato
  /** "Zona A · 1 v 4", "Cuartos 2" */
  titulo: string
  a: string | null
  b: string | null
  /** nombre de la pareja si ya se sabe; si no, "Ganador P1", "1° Zona A"… */
  etiquetaA: string
  etiquetaB: string
  resultado?: Resultado
  eval?: Evaluacion
  estado: Estado
  ganador: string | null
  perdedor: string | null
  bye: boolean
}

function armar(
  base: Omit<Partido, 'estado' | 'ganador' | 'perdedor' | 'eval' | 'resultado' | 'etiquetaA' | 'etiquetaB'> & { labelA: string; labelB: string },
  resultado: Resultado | undefined,
  nombre: (id: string) => string,
): Partido {
  const { labelA, labelB, ...p } = base
  const etiquetaA = p.a ? nombre(p.a) : labelA
  const etiquetaB = p.b ? nombre(p.b) : labelB
  const comun = { ...p, etiquetaA, etiquetaB, resultado }
  if (p.bye) {
    const pasa = p.a ?? p.b
    return { ...comun, estado: 'libre', ganador: pasa, perdedor: null }
  }
  if (!p.a || !p.b) return { ...comun, estado: resultado ? 'desactualizado' : 'esperando', ganador: null, perdedor: null }
  if (!resultado) return { ...comun, estado: 'pendiente', ganador: null, perdedor: null }
  if (resultado.a !== p.a || resultado.b !== p.b) return { ...comun, estado: 'desactualizado', ganador: null, perdedor: null }
  const ev = evaluar(p.formato, resultado)
  if (!ev.ok) return { ...comun, eval: ev, estado: 'invalido', ganador: null, perdedor: null }
  const g = ev.ganador === 'a' ? p.a : p.b
  return { ...comun, eval: ev, estado: 'jugado', ganador: g, perdedor: g === p.a ? p.b : p.a }
}

// ------------------------------------------------------------------ zonas

export interface FilaTabla { id: string; pj: number; pg: number; pp: number; sf: number; sc: number; gf: number; gc: number }

export interface TablaZona {
  /** ordenadas por posición (o provisoriamente, si la zona no terminó) */
  filas: FilaTabla[]
  /** id de la pareja en cada posición (índice 0 = 1°), null si todavía no se sabe */
  posiciones: (string | null)[]
  completa: boolean
  /** empate total sin definir: hay que ordenarlos a mano (sorteo) */
  empatados: string[]
  /** el orden de algunos puestos salió del desempate manual */
  desempateManual: boolean
}

export interface ZonaResuelta { zona: number; partidos: Partido[]; tabla: TablaZona }

function estadisticas(ids: string[], partidos: Partido[]): Map<string, FilaTabla> {
  const m = new Map(ids.map((id) => [id, { id, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, gf: 0, gc: 0 }]))
  for (const p of partidos) {
    if (p.estado !== 'jugado' || !p.eval || !p.a || !p.b) continue
    const fa = m.get(p.a), fb = m.get(p.b)
    if (!fa || !fb) continue
    const e = p.eval
    fa.pj++; fb.pj++
    if (e.ganador === 'a') { fa.pg++; fb.pp++ } else { fb.pg++; fa.pp++ }
    fa.sf += e.setsA; fa.sc += e.setsB; fa.gf += e.gamesA; fa.gc += e.gamesB
    fb.sf += e.setsB; fb.sc += e.setsA; fb.gf += e.gamesB; fb.gc += e.gamesA
  }
  return m
}

/** Zona de 3 (todos contra todos): partidos ganados → (empate de 2) resultado entre ellos →
 *  (empate de 3) dif. de sets, dif. de games, games a favor → resultado entre ellos → orden manual */
function ordenarTodosContraTodos(zona: string[], partidos: Partido[], filas: Map<string, FilaTabla>, manual: string[] | undefined) {
  const ganoEntre = (x: string, y: string) => partidos.find((p) => p.estado === 'jugado' && [p.a, p.b].includes(x) && [p.a, p.b].includes(y))?.ganador
  const clave = (f: FilaTabla) => [f.sf - f.sc, f.gf - f.gc, f.gf]
  const cmpClave = (x: FilaTabla, y: FilaTabla) => { const a = clave(x), b = clave(y); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0 }
  const lista = zona.map((id) => filas.get(id)!)
  const orden: FilaTabla[] = []
  const empatados: string[] = []
  let desempateManual = false
  const porPg = [...new Set(lista.map((f) => f.pg))].sort((a, b) => b - a)
  for (const pg of porPg) {
    let grupo = lista.filter((f) => f.pg === pg)
    if (grupo.length === 2) {
      const g = ganoEntre(grupo[0].id, grupo[1].id)
      if (g === grupo[1].id) grupo = [grupo[1], grupo[0]]
    } else if (grupo.length > 2) {
      grupo = [...grupo].sort(cmpClave)
      // sub-empates que quedan después de los desempates numéricos
      const res: FilaTabla[] = []
      let i = 0
      while (i < grupo.length) {
        let j = i + 1
        while (j < grupo.length && cmpClave(grupo[i], grupo[j]) === 0) j++
        const sub = grupo.slice(i, j)
        if (sub.length === 2) {
          const g = ganoEntre(sub[0].id, sub[1].id)
          res.push(...(g === sub[1].id ? [sub[1], sub[0]] : sub))
        } else if (sub.length > 2) {
          const ids = sub.map((f) => f.id)
          if (manual && ids.every((id) => manual.includes(id))) {
            res.push(...[...sub].sort((x, y) => manual.indexOf(x.id) - manual.indexOf(y.id)))
            desempateManual = true
          } else {
            res.push(...sub)
            empatados.push(...ids)
          }
        } else res.push(...sub)
        i = j
      }
      grupo = res
    }
    orden.push(...grupo)
  }
  return { orden, empatados, desempateManual }
}

export function resolverZona(cat: Categoria, zi: number, nombre: (id: string) => string): ZonaResuelta {
  const zona = cat.zonas[zi] ?? []
  const formato = cat.formatos.zonas
  const res = (k: string) => cat.resultadosZona[k]
  const plantilla = partidosDeZona(zona, zi, () => '')
  const base = (n: number, a: string | null, b: string | null, labelA: string, labelB: string) => {
    const t = plantilla.find((x) => x.numero === n)!
    return { key: t.key, tipo: 'zona' as const, instancia: 'zonas' as const, formato, titulo: `Zona ${LETRAS[zi]} · ${t.codigo}`, a, b, labelA, labelB, bye: false }
  }
  const partidos: Partido[] = []
  if (zona.length === 3) {
    const pares: [number, number][] = [[0, 1], [0, 2], [1, 2]]
    pares.forEach(([x, y], k) => partidos.push(armar(base(k + 1, zona[x], zona[y], '', ''), res(`${zi}-${k + 1}`), nombre)))
  } else if (zona.length === 4) {
    const p1 = armar(base(1, zona[0], zona[3], '', ''), res(`${zi}-1`), nombre)
    const p2 = armar(base(2, zona[1], zona[2], '', ''), res(`${zi}-2`), nombre)
    const p3 = armar(base(3, p1.ganador, p2.ganador, 'Ganador P1', 'Ganador P2'), res(`${zi}-3`), nombre)
    const p4 = armar(base(4, p1.perdedor, p2.perdedor, 'Perdedor P1', 'Perdedor P2'), res(`${zi}-4`), nombre)
    partidos.push(p1, p2, p3, p4)
  }

  const filas = estadisticas(zona, partidos)
  const completa = partidos.length > 0 && partidos.every((p) => p.estado === 'jugado')
  let tabla: TablaZona

  if (zona.length === 4) {
    // 1° y 2°: ganador y perdedor de Ganadores · 3° y 4°: ganador y perdedor de Perdedores
    const [, , p3, p4] = partidos
    const posiciones = [p3.ganador, p3.perdedor, p4.ganador, p4.perdedor]
    const conocidas = posiciones.filter((x): x is string => !!x)
    const resto = zona.filter((id) => !conocidas.includes(id))
      .map((id) => filas.get(id)!)
      .sort((x, y) => y.pg - x.pg || (y.sf - y.sc) - (x.sf - x.sc) || (y.gf - y.gc) - (x.gf - x.gc))
    const filasOrd = [0, 1, 2, 3].map((i) => (posiciones[i] ? filas.get(posiciones[i]!)! : null))
    let k = 0
    tabla = { filas: filasOrd.map((f) => f ?? resto[k++]), posiciones, completa, empatados: [], desempateManual: false }
  } else {
    const { orden, empatados, desempateManual } = ordenarTodosContraTodos(zona, partidos, filas, cat.desempates[String(zi)])
    const definido = completa && empatados.length === 0
    tabla = { filas: orden, posiciones: orden.map((f) => (definido ? f.id : null)), completa, empatados: completa ? empatados : [], desempateManual }
  }
  return { zona: zi, partidos, tabla }
}

// ------------------------------------------------------------------ playoff

export interface TorneoResuelto {
  zonas: ZonaResuelta[]
  /** null si el cuadro no está armado o es inválido */
  playoff: Partido[][] | null
  campeon: string | null
}

export function resolverTorneo(cat: Categoria): TorneoResuelto {
  const nombres = new Map(cat.parejas.map((p) => [p.id, p.nombre]))
  const nombre = (id: string) => nombres.get(id) ?? '—'
  const zonas = cat.zonas.map((_, zi) => resolverZona(cat, zi, nombre))
  if (!cat.cuadro || erroresCuadro(cat.cuadro, cat.zonas).length) return { zonas, playoff: null, campeon: null }

  const n1 = cat.cuadro.length
  const estructura = rondasPlayoff(cat.cuadro)
  const playoff: Partido[][] = []
  estructura.forEach((ronda, ri) => {
    const instancia = instanciaDeRonda(n1, ri + 1)
    const formato = cat.formatos[instancia]
    const lista = ronda.map((p) => {
      let a: string | null, b: string | null
      if (ri === 0) {
        const [sa, sb] = cat.cuadro![p.orden - 1]
        a = sa ? zonas[sa.zona]?.tabla.posiciones[sa.pos - 1] ?? null : null
        b = sb ? zonas[sb.zona]?.tabla.posiciones[sb.pos - 1] ?? null : null
        const labelA = sa ? etiquetaSlot(sa) : 'Libre', labelB = sb ? etiquetaSlot(sb) : 'Libre'
        return armar({ key: p.key, tipo: 'playoff', instancia, formato, titulo: p.titulo, a, b, labelA, labelB, bye: p.bye }, cat.resultadosPlayoff[p.key], nombre)
      }
      const previa = playoff[ri - 1]
      a = previa[2 * p.orden - 2].ganador
      b = previa[2 * p.orden - 1].ganador
      return armar({ key: p.key, tipo: 'playoff', instancia, formato, titulo: p.titulo, a, b, labelA: p.a, labelB: p.b, bye: false }, cat.resultadosPlayoff[p.key], nombre)
    })
    playoff.push(lista)
  })
  const final = playoff[playoff.length - 1]?.[0]
  return { zonas, playoff, campeon: final?.estado === 'jugado' ? final.ganador : null }
}

/** Máxima instancia a la que llegó una pareja ('final' = finalista; 'campeon' = ganó el torneo) */
export type Alcance = Instancia | 'campeon'
export const ALCANCES: Alcance[] = ['zonas', '16avos', 'octavos', 'cuartos', 'semifinal', 'final', 'campeon']
export const esAlcance = (v: unknown): v is Alcance => ALCANCES.includes(v as Alcance)
const NOMBRE_ALCANCE: Record<Alcance, string> = { zonas: 'Zonas', '16avos': '16avos', octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Finalista', campeon: 'Campeón' }
export const nombreAlcance = (a: Alcance) => NOMBRE_ALCANCE[a] ?? a

/**
 * Hasta dónde llegó cada pareja: zonas → instancia del playoff en la que aparece (con la pareja ya definida) → campeón.
 * Las parejas que todavía no están en una zona no figuran.
 */
export function alcances(cat: Categoria, resuelto: TorneoResuelto = resolverTorneo(cat)): Map<string, Alcance> {
  const m = new Map<string, Alcance>()
  for (const z of cat.zonas) for (const id of z) m.set(id, 'zonas')
  for (const ronda of resuelto.playoff ?? []) for (const p of ronda) for (const id of [p.a, p.b]) if (id) m.set(id, p.instancia)
  if (resuelto.campeon) m.set(resuelto.campeon, 'campeon')
  return m
}

/** ¿Hay resultados cargados en esa instancia? (para avisar antes de cambiar el formato) */
export function hayResultados(cat: Categoria, instancia: Instancia): boolean {
  if (instancia === 'zonas') return Object.keys(cat.resultadosZona).length > 0
  if (!cat.cuadro) return false
  const n1 = cat.cuadro.length
  return Object.keys(cat.resultadosPlayoff).some((k) => instanciaDeRonda(n1, Number(k.split('-')[0])) === instancia)
}

/** Instancias que se juegan: zonas + rondas del cuadro (o las que saldrían con las zonas actuales); sin zonas, todas */
export function instanciasDelTorneo(cat: Categoria): Instancia[] {
  const tam = cat.cuadro?.length ? cat.cuadro.length * 2 : cat.zonas.length ? tamCuadro(clasificados(cat.zonas).length) : 0
  if (!tam) return INSTANCIAS.map((i) => i.id)
  const out: Instancia[] = ['zonas']
  for (let t = tam; t >= 2; t /= 2) out.push(instanciaDeTam(t))
  return out
}

/** "Zonas: Americano a 9 games. Semifinal y Final: al mejor de 3 sets, el 3ro super tiebreak." (solo instancias que se juegan) */
export function textoFormatos(cat: Categoria, instancias: Instancia[]): string {
  const nombres: Record<Instancia, string> = { zonas: 'Zonas', '16avos': '16avos', octavos: 'Octavos', cuartos: 'Cuartos', semifinal: 'Semifinal', final: 'Final' }
  const grupos: { inst: Instancia[]; f: Formato }[] = []
  for (const i of instancias) {
    const f = cat.formatos[i]
    const ult = grupos[grupos.length - 1]
    if (ult && ult.f === f) ult.inst.push(i)
    else grupos.push({ inst: [i], f })
  }
  const desc: Record<Formato, string> = {
    mejor_de_3: 'al mejor de 3 sets', mejor_de_3_stb: `al mejor de 3 sets, el 3ro es super tiebreak a ${SUPER_TB}`, americano_7: 'americano a 7 games', americano_9: 'americano a 9 games',
  }
  return grupos.map((g) => {
    const ns = g.inst.map((i) => nombres[i])
    const lista = ns.length > 1 ? `${ns.slice(0, -1).join(', ')} y ${ns[ns.length - 1]}` : ns[0]
    const d = desc[g.f]
    return `${lista}: ${d}.`
  }).join(' ')
}

// ------------------------------------------------------------------ bloqueos por resultados cargados

/** ¿Hay algún resultado de playoff? (desde ahí no se tocan ni los cruces ni las zonas) */
export const playoffIniciado = (cat: Categoria) => Object.keys(cat.resultadosPlayoff).length > 0

/** Zonas que ya no se pueden modificar: las que tienen algún resultado (o todas, si arrancó el playoff) */
export function zonasBloqueadas(cat: Categoria): boolean[] {
  const todas = playoffIniciado(cat)
  return cat.zonas.map((_, zi) => todas || Object.keys(cat.resultadosZona).some((k) => k.startsWith(`${zi}-`)))
}

/** Claves de partido (horariosZona / horariosPlayoff) que ya tienen resultado: su horario no se reprograma */
export function clavesJugadas(cat: Categoria): { zona: Set<string>; playoff: Set<string> } {
  return { zona: new Set(Object.keys(cat.resultadosZona)), playoff: new Set(Object.keys(cat.resultadosPlayoff)) }
}

/** Estado del torneo según lo cargado: cancelado (manual) · finalizado (hay campeón) · en curso (algún resultado) · pendiente */
export function estadoTorneo(cat: Categoria, campeon?: string | null): EstadoTorneo {
  if (cat.cancelado) return 'cancelado'
  if ((campeon !== undefined ? campeon : resolverTorneo(cat).campeon)) return 'finalizado'
  if (Object.keys(cat.resultadosZona).length || Object.keys(cat.resultadosPlayoff).length) return 'en_curso'
  return 'pendiente'
}
