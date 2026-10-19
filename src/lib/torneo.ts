// Lógica de zonas y playoff (modelo en memoria; se guarda en Supabase desde almacen.ts)

/** NODO tiene una sola sede: `sede` existe por compatibilidad con la base y no se carga. `cancha`: "1", "2", "3" (vacío = sin asignar) */
export interface Horario { fecha: string; hora: string; sede?: string; cancha?: string }

/** NODO: sede única con 3 canchas */
export const CANCHAS_NODO = 3

/** Franja horaria de un día ("HH:MM"). `desde` vacío = desde que abren las canchas · `hasta` vacío = hasta el cierre */
export interface Franja { desde: string; hasta: string }
/**
 * Días y horarios en que puede jugar una pareja (lo usa "Armar fecha").
 * · `dias[fecha]` ausente = puede todo el día · `[]` = no puede ese día · franjas = solo en esas franjas
 * · `zona`: días en que quieren jugar la zona (vacío = cualquiera de los días disponibles)
 * · `preferencia`: lo más temprano / lo más tarde posible (se intenta, no es obligatorio)
 */
export interface Disponibilidad {
  dias: Record<string, Franja[]>
  zona?: string[]
  preferencia?: '' | 'temprano' | 'tarde'
}

export interface Pareja {
  id: string
  /** "Juan Perez / Ricardo Lopez" (es lo que se muestra en zonas e imágenes) */
  nombre: string
  jugador1?: string
  jugador2?: string
  /** problemas de horario de la pareja, como los dijeron (vacío si no tiene) */
  horario?: string
  /** los mismos problemas de horario, cargados por día (para armar la fecha automática). undefined = sin cargar */
  disponibilidad?: Disponibilidad
}
/** Un lado de primera ronda del playoff: posición `pos` de la zona número `zona` (0 = A) */
export interface Slot { zona: number; pos: number }

/** Categoría del torneo (obligatoria; por defecto Damas) */
export type CategoriaTorneo = 'Damas' | 'Caballeros' | 'Mixto'
export const CATEGORIAS: CategoriaTorneo[] = ['Damas', 'Caballeros', 'Mixto']
export const CATEGORIA_DEFECTO: CategoriaTorneo = 'Damas'
export const esCategoriaTorneo = (v: unknown): v is CategoriaTorneo => CATEGORIAS.includes(v as CategoriaTorneo)

/** Un torneo: datos, parejas, zonas y playoff (el nombre puede incluir el nivel: "7ma - Primavera") */
export interface Categoria {
  id: string
  torneo: string
  /** Damas, Caballeros o Mixto */
  categoria: CategoriaTorneo
  /** YYYY-MM-DD */
  fechaInicio: string
  fechaFin: string
  /** texto libre: formato de partidos, reglas, etc. */
  observacion: string
  /** monto de inscripción por jugador, solo dígitos ("17000"); vacío = no se muestra */
  inscripcion: string
  /** texto libre del premio ("50% de lo recaudado"); vacío = no se muestra */
  premio: string
  parejas: Pareja[]
  /** ids de parejas por zona, en orden de posición (en zonas de 4: 1 vs 4 y 2 vs 3) */
  zonas: string[][]
  /** clave `${zona}-${partido}` */
  horariosZona: Record<string, Horario>
  /** primera ronda del playoff: [ladoA, ladoB] por partido (null = libre, el otro pasa directo) */
  cuadro: (Slot | null)[][] | null
  /** clave `${ronda}-${orden}` */
  horariosPlayoff: Record<string, Horario>
  /** formato de partido de cada instancia (zonas, octavos, cuartos…) */
  formatos: Record<Instancia, Formato>
  /** resultados de zona, misma clave que horariosZona */
  resultadosZona: Record<string, Resultado>
  /** resultados de playoff, misma clave que horariosPlayoff */
  resultadosPlayoff: Record<string, Resultado>
  /** orden definido a mano ante un empate total en una zona: zona → ids de pareja */
  desempates: Record<string, string[]>
  /** visible en la página pública (lo decide el admin; requiere zonas armadas) */
  publicado: boolean
  /** cancelado a mano por el admin (el resto de los estados se calcula solo) */
  cancelado: boolean
  actualizado: number
}

/** Estado del torneo: pendiente (sin resultados) → en curso (primer resultado) → finalizado (hay campeón); cancelado es manual */
export type EstadoTorneo = 'pendiente' | 'en_curso' | 'finalizado' | 'cancelado'
export const ESTADOS: { id: EstadoTorneo; nombre: string }[] = [
  { id: 'en_curso', nombre: 'En curso' },
  { id: 'pendiente', nombre: 'Pendiente' },
  { id: 'finalizado', nombre: 'Finalizado' },
  { id: 'cancelado', nombre: 'Cancelado' },
]
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const nombreEstado = (e: EstadoTorneo) => ESTADOS.find((x) => x.id === e)?.nombre ?? e

/** Zonas armadas: todas de 3 o 4 parejas y todas las parejas ubicadas una sola vez (mínimo para publicar) */
export function zonasArmadas(c: Pick<Categoria, 'zonas' | 'parejas'>): boolean {
  const ubicadas = new Set(c.zonas.flat())
  return c.zonas.length > 0 && c.zonas.every((z) => z.length === 3 || z.length === 4) &&
    c.parejas.every((p) => ubicadas.has(p.id)) && c.zonas.flat().length === ubicadas.size
}

// ------------------------------------------------------------------ formatos de partido

export type Formato = 'mejor_de_3' | 'mejor_de_3_stb' | 'americano_7' | 'americano_9'
export type Instancia = 'zonas' | '16avos' | 'octavos' | 'cuartos' | 'semifinal' | 'final'

export const FORMATOS: { id: Formato; nombre: string; corto: string }[] = [
  { id: 'mejor_de_3', nombre: 'Al mejor de 3 sets', corto: 'Mejor de 3 sets' },
  { id: 'mejor_de_3_stb', nombre: 'Al mejor de 3 sets, el 3ro super tiebreak a 11', corto: 'Mejor de 3 · 3ro super TB a 11' },
  { id: 'americano_7', nombre: 'Americano a 7 games', corto: 'Americano a 7' },
  { id: 'americano_9', nombre: 'Americano a 9 games', corto: 'Americano a 9' },
]
export const nombreFormato = (f: Formato) => FORMATOS.find((x) => x.id === f)?.nombre ?? f

export const INSTANCIAS: { id: Instancia; nombre: string }[] = [
  { id: 'zonas', nombre: 'Zonas' },
  { id: '16avos', nombre: '16avos' },
  { id: 'octavos', nombre: 'Octavos' },
  { id: 'cuartos', nombre: 'Cuartos' },
  { id: 'semifinal', nombre: 'Semifinal' },
  { id: 'final', nombre: 'Final' },
]
export const nombreInstancia = (i: Instancia) => INSTANCIAS.find((x) => x.id === i)?.nombre ?? i

/** Lo que más se juega: americano a 9 hasta cuartos; semi y final al mejor de 3 con super tiebreak */
export const FORMATOS_DEFECTO: Record<Instancia, Formato> = {
  zonas: 'americano_9', '16avos': 'americano_9', octavos: 'americano_9', cuartos: 'americano_9', semifinal: 'mejor_de_3_stb', final: 'mejor_de_3_stb',
}

/**
 * Resultado de un partido. `a` y `b` son las parejas que lo jugaron (en el orden del partido):
 * si después cambian (se corrigió un resultado anterior o las zonas), el resultado queda desactualizado.
 * `sets` = games de A y de B en cada set ([[6,4],[3,6],[10,8]]). `wo` = gana ese lado por walkover.
 */
export interface Resultado { a: string; b: string; sets: [number, number][]; wo?: 'a' | 'b' }

export const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** Completa campos que no existían en torneos guardados con versiones anteriores */
export function normalizar(c: Categoria): Categoria {
  // versiones anteriores tenían una "categoria" de texto libre (ej. "7ma Damas"): si no es una de las
  // tres categorías actuales, se suma al nombre del torneo y la categoría queda en la de por defecto
  const previa = (c as { categoria?: unknown }).categoria
  const legado = typeof previa === 'string' && previa.trim() && !esCategoriaTorneo(previa) ? previa.trim() : ''
  return {
    ...c,
    torneo: [c.torneo, legado].map((x) => x?.trim()).filter(Boolean).join(' - '),
    categoria: esCategoriaTorneo(previa) ? previa : CATEGORIA_DEFECTO,
    fechaInicio: c.fechaInicio ?? '', fechaFin: c.fechaFin ?? '', observacion: c.observacion ?? '', inscripcion: c.inscripcion ?? '', premio: c.premio ?? '',
    horariosZona: c.horariosZona ?? {}, horariosPlayoff: c.horariosPlayoff ?? {},
    formatos: { ...FORMATOS_DEFECTO, ...(c.formatos ?? {}) },
    resultadosZona: c.resultadosZona ?? {}, resultadosPlayoff: c.resultadosPlayoff ?? {}, desempates: c.desempates ?? {},
    publicado: c.publicado ?? false, cancelado: c.cancelado ?? false,
  }
}

/** "17000" → "$17.000" */
export const formatoPesos = (v: string) => (v ? `$${Number(v).toLocaleString('es-AR')}` : '')

export const MIN_PAREJAS = 6
export const MAX_PAREJAS = 24

/** UUID v4 (los ids se guardan en columnas uuid de la base) */
export function nuevoId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
export const esUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/**
 * Datos por defecto de los partidos que todavía no se jugaron (cuando las zonas ya están armadas):
 * · torneo de un solo día → todos los partidos con ese día
 * Devuelve el mismo objeto si no hay nada para completar (se puede llamar en cada cambio).
 */
export function precargarHorarios(c: Categoria): Categoria {
  const unDia = !!c.fechaInicio && c.fechaInicio === c.fechaFin
  const ubicadas = new Set(c.zonas.flat())
  const zonasArmadas = c.zonas.length > 0 && c.zonas.every((z) => z.length === 3 || z.length === 4) &&
    c.parejas.every((p) => ubicadas.has(p.id)) && c.zonas.flat().length === ubicadas.size
  if (!unDia || !zonasArmadas) return c

  const completar = (horarios: Record<string, Horario>, claves: string[], jugados: Record<string, unknown>) => {
    let out = horarios
    for (const k of claves) {
      if (jugados[k]) continue
      const h = horarios[k]
      const fecha = h?.fecha || (unDia ? c.fechaInicio : '')
      if (fecha === (h?.fecha ?? '')) continue
      if (out === horarios) out = { ...horarios }
      out[k] = { ...h, fecha, hora: h?.hora ?? '' }
    }
    return out
  }

  const clavesZona = c.zonas.flatMap((z, zi) => partidosDeZona(z, zi, () => '').map((p) => p.key))
  const clavesPlayoff = c.cuadro && erroresCuadro(c.cuadro, c.zonas).length === 0
    ? rondasPlayoff(c.cuadro).flat().filter((p) => !p.bye).map((p) => p.key)
    : []
  const hz = completar(c.horariosZona, clavesZona, c.resultadosZona)
  const hp = completar(c.horariosPlayoff, clavesPlayoff, c.resultadosPlayoff)
  return hz === c.horariosZona && hp === c.horariosPlayoff ? c : { ...c, horariosZona: hz, horariosPlayoff: hp }
}

/** Datos obligatorios del paso "Torneo": nombre, categoría y fechas (fin igual o posterior al inicio). Recién ahí se crea en la base */
export const datosCompletos = (c: Pick<Categoria, 'torneo' | 'categoria' | 'fechaInicio' | 'fechaFin'>) =>
  !!c.torneo.trim() && esCategoriaTorneo(c.categoria) && !!c.fechaInicio && !!c.fechaFin && c.fechaFin >= c.fechaInicio

export function nuevaCategoria(): Categoria {
  return {
    id: nuevoId(), torneo: '', categoria: CATEGORIA_DEFECTO, fechaInicio: '', fechaFin: '', observacion: '', inscripcion: '', premio: '', parejas: [], zonas: [],
    horariosZona: {}, cuadro: null, horariosPlayoff: {}, formatos: { ...FORMATOS_DEFECTO }, resultadosZona: {}, resultadosPlayoff: {}, desempates: {}, publicado: false, cancelado: false,
    actualizado: Date.now(),
  }
}

/** "JUaN  perez" → "Juan Perez" (también "maría-josé" → "María-José") */
export function nombrePropio(t: string): string {
  return t
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase('es'))
}

/** Como se guarda en la base: MAYÚSCULAS y espacios normalizados ("Massot  grego" → "MASSOT GREGO") */
export const mayusculas = (t: string) => t.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es')

/** Clave para comparar jugadores sin importar mayúsculas, tildes ni espacios */
export const claveJugador = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Misma pareja = mismos dos jugadores, en cualquier orden */
export const clavePareja = (j1: string, j2: string) => [claveJugador(j1), claveJugador(j2)].sort().join('|')

/** Jugadores de una pareja (las guardadas antes solo tenían `nombre`) */
export function jugadoresDe(p: Pareja): [string, string] {
  if (p.jugador1 !== undefined && p.jugador2 !== undefined) return [p.jugador1, p.jugador2]
  const [a = '', ...b] = p.nombre.split(' / ')
  return [a, b.join(' / ')]
}

/** "A / B; C / D" o una por línea */
export function parsearParejas(texto: string): string[] {
  return texto.split(/[\n;]+/).map((x) => x.replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim()).filter(Boolean)
}

// ------------------------------------------------------------------ zonas

/** Reparto por defecto: floor(n/3) zonas; las primeras quedan de 4 y el resto de 3 */
export function sugerirZonas(ids: string[], aleatorio: boolean): string[][] {
  const lista = [...ids]
  if (aleatorio) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
    }
  }
  const cant = Math.floor(lista.length / 3)
  if (cant < 1) return []
  const de4 = lista.length - 3 * cant
  const out: string[][] = []
  let k = 0
  for (let z = 0; z < cant; z++) {
    const tam = z < de4 ? 4 : 3
    out.push(lista.slice(k, k + tam))
    k += tam
  }
  return out
}

export interface PartidoZona { key: string; zona: number; numero: number; titulo: string; codigo: string; a: string; b: string }

/** Partidos de una zona. Zona de 3: todos contra todos. Zona de 4: 1v4, 2v3, ganadores y perdedores */
export function partidosDeZona(zona: string[], zi: number, nombre: (id: string) => string): PartidoZona[] {
  const n = (i: number) => nombre(zona[i])
  const p = (numero: number, titulo: string, codigo: string, a: string, b: string): PartidoZona =>
    ({ key: `${zi}-${numero}`, zona: zi, numero, titulo, codigo, a, b })
  if (zona.length === 3) {
    return [p(1, 'Partido 1', '1 v 2', n(0), n(1)), p(2, 'Partido 2', '1 v 3', n(0), n(2)), p(3, 'Partido 3', '2 v 3', n(1), n(2))]
  }
  if (zona.length === 4) {
    return [
      p(1, 'Partido 1', '1 v 4', n(0), n(3)),
      p(2, 'Partido 2', '2 v 3', n(1), n(2)),
      p(3, 'Ganadores', 'G v G', 'Ganador P1', 'Ganador P2'),
      p(4, 'Perdedores', 'P v P', 'Perdedor P1', 'Perdedor P2'),
    ]
  }
  return []
}

export const firmaZonas = (zonas: string[][]) => zonas.map((z) => z.length).join(',')

// ------------------------------------------------------------------ playoff

export interface Clasificado { key: string; zona: number; pos: number; label: string }

export const etiquetaSlot = (s: Slot) => `${s.pos}° Zona ${LETRAS[s.zona]}`

/** Clasifican 1° y 2° en zonas de 3; 1°, 2° y 3° en zonas de 4. Orden de siembra: 1°s, 2°s, 3°s */
export function clasificados(zonas: string[][]): Clasificado[] {
  const out: Clasificado[] = []
  for (const pos of [1, 2, 3]) {
    zonas.forEach((z, zi) => {
      const cupo = z.length === 4 ? 3 : 2
      if (pos <= cupo) out.push({ key: `${zi}:${pos}`, zona: zi, pos, label: etiquetaSlot({ zona: zi, pos }) })
    })
  }
  return out
}

export function tamCuadro(q: number) {
  let b = 2
  while (b < q) b *= 2
  return b
}

const FASES: Record<number, string> = { 2: 'Final', 4: 'Semifinal', 8: 'Cuartos', 16: 'Octavos', 32: '16avos' }
export const nombreFase = (tamRonda: number) => FASES[tamRonda] ?? `Ronda de ${tamRonda}`
const INSTANCIA_DE_TAM: Record<number, Instancia> = { 2: 'final', 4: 'semifinal', 8: 'cuartos', 16: 'octavos', 32: '16avos' }
/** Instancia de una ronda según cuántas parejas la juegan (8 → cuartos) */
export const instanciaDeTam = (tamRonda: number): Instancia => INSTANCIA_DE_TAM[tamRonda] ?? '16avos'
/** Instancia de la ronda `ronda` (1 = primera) de un cuadro de `partidosPrimera` partidos */
export const instanciaDeRonda = (partidosPrimera: number, ronda: number) => instanciaDeTam((partidosPrimera * 2) / 2 ** (ronda - 1))

/** Cuadro automático: siembra estándar y sin cruces de la misma zona en primera ronda */
export function cuadroAutomatico(zonas: string[][]): (Slot | null)[][] {
  const cl = clasificados(zonas)
  const q = cl.length
  const b = tamCuadro(q)
  let seeds = [1]
  while (seeds.length < b) {
    const n = seeds.length
    seeds = seeds.flatMap((s) => [s, 2 * n + 1 - s])
  }
  const slots: (Slot | null)[] = seeds.map((s) => (s <= q ? { zona: cl[s - 1].zona, pos: cl[s - 1].pos } : null))
  for (let j = 0; j < b / 2; j++) {
    const a = slots[2 * j], c = slots[2 * j + 1]
    if (a && c && a.zona === c.zona) {
      for (let k = 0; k < b / 2; k++) {
        const x = slots[2 * k + 1], y = slots[2 * k]
        if (k !== j && x && x.zona !== a.zona && (!y || y.zona !== c.zona)) {
          slots[2 * j + 1] = x
          slots[2 * k + 1] = c
          break
        }
      }
    }
  }
  const out: (Slot | null)[][] = []
  for (let j = 0; j < b / 2; j++) out.push([slots[2 * j], slots[2 * j + 1]])
  return out
}

export function erroresCuadro(cruces: (Slot | null | undefined)[][], zonas: string[][]): string[] {
  const cl = clasificados(zonas)
  const b = tamCuadro(cl.length)
  const err: string[] = []
  if (cruces.length !== b / 2) return [`El cuadro tiene que tener ${b / 2} partidos.`]
  // un lado sin elegir se guarda como { zona: -1, pos: -1 } (en JSON no existe undefined)
  const planos = cruces.flat().map((v) => (v && v.zona < 0 ? undefined : v))
  if (planos.some((v) => v === undefined)) err.push('Completá todos los lados.')
  const usados = new Map<string, number>()
  planos.forEach((v) => { if (v) usados.set(`${v.zona}:${v.pos}`, (usados.get(`${v.zona}:${v.pos}`) ?? 0) + 1) })
  const faltan = cl.filter((c) => !usados.has(c.key))
  if (faltan.length) err.push(`Falta ubicar: ${faltan.map((c) => c.label).join(', ')}.`)
  if ([...usados.values()].some((n) => n > 1)) err.push('Hay clasificados repetidos.')
  const libres = planos.filter((v) => v === null).length
  if (!planos.some((v) => v === undefined) && libres !== b - cl.length) err.push(`Tiene que haber exactamente ${b - cl.length} lado(s) libre(s).`)
  if (cruces.some(([a, c]) => a === null && c === null)) err.push('Un partido no puede tener los dos lados libres.')
  return err
}

export interface PartidoPlayoff {
  key: string
  ronda: number        // 1 = primera ronda
  orden: number        // 1..n dentro de la ronda
  fase: string         // Cuartos, Semifinal, Final…
  titulo: string       // "Cuartos 2", "Final"
  a: string
  b: string
  /** primera ronda con un lado libre: no se juega, el otro pasa directo */
  bye: boolean
}

/** Todas las rondas del cuadro, con lo que se sabe de cada lado ("1° Zona A", "Ganador Cuartos 2") */
export function rondasPlayoff(cuadro: (Slot | null)[][]): PartidoPlayoff[][] {
  const b = cuadro.length * 2
  const rondas: PartidoPlayoff[][] = []
  let tam = b
  let r = 1
  let previa: PartidoPlayoff[] = []
  while (tam >= 2) {
    const fase = nombreFase(tam)
    const lista: PartidoPlayoff[] = []
    for (let j = 1; j <= tam / 2; j++) {
      const titulo = tam === 2 ? fase : `${fase} ${j}`
      let a: string, bb: string, bye = false
      if (r === 1) {
        const [sa, sb] = cuadro[j - 1]
        a = sa ? etiquetaSlot(sa) : 'Libre'
        bb = sb ? etiquetaSlot(sb) : 'Libre'
        bye = !sa || !sb
      } else {
        const lado = (f: PartidoPlayoff) => (f.bye ? (f.a === 'Libre' ? f.b : f.a) : `Ganador ${f.titulo}`)
        a = lado(previa[2 * j - 2])
        bb = lado(previa[2 * j - 1])
      }
      lista.push({ key: `${r}-${j}`, ronda: r, orden: j, fase, titulo, a, b: bb, bye })
    }
    rondas.push(lista)
    previa = lista
    tam /= 2
    r++
  }
  return rondas
}

// ------------------------------------------------------------------ fechas

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const aFecha = (f: string) => new Date(`${f}T12:00:00`)
/** "Vie 26/09" */
export const diaCorto = (f: string) => {
  const d = aFecha(f)
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** "Viernes 26" */
export const diaLargo = (f: string) => { const d = aFecha(f); return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()}` }
/** "Vie 25/09 al Sáb 26/09" (o un solo día) */
export const rangoFechas = (ini: string, fin: string) =>
  !ini ? '' : !fin || fin === ini ? diaCorto(ini) : `${diaCorto(ini)} al ${diaCorto(fin)}`

/** "Vie 26/09 · 19:00 hs" */
export function textoHorario(h: Horario | undefined, corto = false): string {
  if (!h || (!h.fecha && !h.hora)) return corto ? 'A confirmar' : 'Día y horario a confirmar'
  const partes: string[] = []
  if (h.fecha) partes.push(diaCorto(h.fecha))
  if (h.hora) partes.push(corto ? h.hora : `${h.hora} hs`)
  return partes.join(' · ')
}
export const horarioCompleto = (h: Horario | undefined) => !!h?.fecha && !!h?.hora

const dos = (n: number) => String(n).padStart(2, '0')
/** Hoy en hora local ("YYYY-MM-DD"; toISOString da la fecha UTC, que después de las 21 ya es mañana) */
export const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` }
/** ¿Esa fecha (y hora, si está) ya pasó? Sin hora, cuenta como pasada solo si el día es anterior a hoy */
export function enPasado(fecha: string, hora?: string): boolean {
  if (!fecha) return false
  if (!hora) return fecha < hoyLocal()
  return new Date(`${fecha}T${hora}:00`).getTime() < Date.now()
}

/** Días entre dos fechas "YYYY-MM-DD", inclusive (máximo 14) */
export function diasEntre(desde: string, hasta: string): string[] {
  if (!desde) return []
  const out: string[] = []
  let f = desde
  const fin = hasta && hasta >= desde ? hasta : desde
  while (f <= fin && out.length < 14) {
    out.push(f)
    f = sumarMinutos(f, '12:00', 24 * 60).fecha
  }
  return out
}
/** 0 = domingo … 6 = sábado */
export const diaSemana = (f: string) => new Date(`${f}T12:00:00`).getDay()

/** Suma minutos a una fecha/hora local "YYYY-MM-DD" + "HH:MM" */
export function sumarMinutos(fecha: string, hora: string, min: number): { fecha: string; hora: string } {
  const d = new Date(`${fecha}T${hora}:00`)
  d.setMinutes(d.getMinutes() + min)
  const p = (n: number) => String(n).padStart(2, '0')
  return { fecha: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, hora: `${p(d.getHours())}:${p(d.getMinutes())}` }
}