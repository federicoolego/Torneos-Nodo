// "Armar fecha": zonas por disponibilidad y horarios automáticos de varios torneos que comparten canchas.
// Todo corre en el navegador. El motor propone; la administradora revisa, mueve, fija y aplica.
import {
  CANCHAS_NODO, claveJugador, cuadroAutomatico, diaCorto, diaSemana, diasEntre, erroresCuadro, jugadoresDe, partidosDeZona, rondasPlayoff,
  sugerirZonas, zonasArmadas, LETRAS, type Categoria, type Disponibilidad, type Horario, type Instancia, type Slot,
} from './torneo'
import { clavesJugadas } from './resultados'
import { aHora, aMinutos, puedeEnFranjas } from './disponibilidad'

// ------------------------------------------------------------------ configuración

export interface DiaFecha { fecha: string; desde: string; hasta: string }
export interface ConfigFecha {
  canchas: number
  /** días de la fecha con el horario de las canchas (desde la primera hora hasta que tiene que terminar el último partido) */
  dias: DiaFecha[]
  /** duración en minutos de cada partido, por instancia */
  duraciones: Record<Instancia, number>
  /** minutos libres entre dos partidos de una misma pareja o jugador */
  descanso: number
  /** minutos entre el último partido de una zona y el primer partido de playoff de sus clasificados */
  margenPlayoff: number
}

export const DURACIONES_DEFECTO: Record<Instancia, number> = { zonas: 45, '16avos': 45, octavos: 45, cuartos: 45, semifinal: 60, final: 60 }
export const PASO = 15

/** Horario habitual de NODO: viernes desde las 18, sábado desde las 10, domingo desde las 12 */
export function horarioDefecto(fecha: string): { desde: string; hasta: string } {
  const d = diaSemana(fecha)
  if (d === 6) return { desde: '10:00', hasta: '23:00' }
  if (d === 0) return { desde: '12:00', hasta: '22:00' }
  if (d === 5) return { desde: '18:00', hasta: '00:00' }
  return { desde: '18:00', hasta: '23:00' }
}

export function configDefecto(dias: string[]): ConfigFecha {
  return { canchas: CANCHAS_NODO, dias: dias.map((f) => ({ fecha: f, ...horarioDefecto(f) })), duraciones: { ...DURACIONES_DEFECTO }, descanso: 0, margenPlayoff: 0 }
}

/** Completa una config guardada (versiones anteriores, campos faltantes) y la ajusta a los días de los torneos */
export function ajustarConfig(c: Partial<ConfigFecha> | null | undefined, dias: string[]): ConfigFecha {
  const base = configDefecto(dias)
  const previos = new Map((c?.dias ?? []).map((d) => [d.fecha, d]))
  return {
    canchas: Math.min(Math.max(Number(c?.canchas) || base.canchas, 1), 8),
    dias: dias.map((f) => previos.get(f) ?? { fecha: f, ...horarioDefecto(f) }),
    duraciones: { ...base.duraciones, ...(c?.duraciones ?? {}) },
    descanso: Math.max(0, Number(c?.descanso) || 0),
    margenPlayoff: Math.max(0, Number(c?.margenPlayoff) || 0),
  }
}

/** Días de todos los torneos (de inicio a fin), ordenados */
export function diasDeTorneos(cats: Categoria[]): string[] {
  return [...new Set(cats.flatMap((c) => diasEntre(c.fechaInicio, c.fechaFin)))].sort()
}

/** Apertura y cierre del día en minutos (el cierre puede pasar la medianoche: 00:00 → 1440) */
export function ventana(d: DiaFecha): [number, number] {
  const a = aMinutos(d.desde) ?? 0
  let b = aMinutos(d.hasta) ?? 1440
  if (b <= a) b += 1440
  return [a, b]
}

// ------------------------------------------------------------------ partidos a programar

export interface Tarea {
  id: string              // `${torneoId}|Z|${key}` · `${torneoId}|P|${key}`
  torneoId: string
  tipo: 'zona' | 'playoff'
  key: string
  instancia: Instancia
  /** "Zona A · 1 v 4", "Cuartos 2", "Final" */
  titulo: string
  a: string
  b: string
  dur: number
  /** parejas que lo juegan (zona: las dos; ganadores/perdedores de zona de 4: las cuatro) */
  parejas: string[]
  /** las cuatro de una zona de 4 en ganadores/perdedores: se reparten entre los dos partidos (pueden ir a la misma hora) */
  grupo?: string
  /** playoff: parejas que podrían llegar (para preferir horarios en que puedan) */
  candidatas: string[]
  jugadores: string[]
  /** tiene que empezar después de que terminen estos (con ese margen en minutos) */
  preds: { id: string; gap: number }[]
  /** días en que se puede jugar (los del torneo que están en la fecha) */
  dias: string[]
  nivel: number
  jugado: boolean
  /** horario que ya tiene cargado en el torneo */
  actual?: Horario
}

export interface Asignacion { fecha: string; hora: string; cancha: number; fijo?: boolean }
export type Plan = Record<string, Asignacion>

export interface Contexto {
  tareas: Tarea[]
  porId: Map<string, Tarea>
  /** cuadro de playoff que se usa en cada torneo (el cargado o el automático) */
  cuadros: Record<string, (Slot | null)[][] | null>
  disp: Map<string, Disponibilidad | undefined>
  nombrePareja: Map<string, string>
  nombreTorneo: Map<string, string>
  torneoDePareja: Map<string, string>
  cfg: ConfigFecha
  /** torneos sin zonas armadas (no entran en la grilla) */
  sinZonas: Categoria[]
}

export const idTarea = (torneoId: string, tipo: 'zona' | 'playoff', key: string) => `${torneoId}|${tipo === 'zona' ? 'Z' : 'P'}|${key}`

export function armarContexto(cats: Categoria[], cfg: ConfigFecha): Contexto {
  const tareas: Tarea[] = []
  const cuadros: Record<string, (Slot | null)[][] | null> = {}
  const disp = new Map<string, Disponibilidad | undefined>()
  const nombrePareja = new Map<string, string>()
  const torneoDePareja = new Map<string, string>()
  const diasCfg = new Set(cfg.dias.map((d) => d.fecha))
  const sinZonas: Categoria[] = []
  const nombreTorneo = new Map(cats.map((c) => [c.id, c.torneo]))

  for (const c of cats) {
    for (const p of c.parejas) { disp.set(p.id, p.disponibilidad); nombrePareja.set(p.id, p.nombre); torneoDePareja.set(p.id, c.id) }
    if (!zonasArmadas(c)) { sinZonas.push(c); continue }
    const jugadoresDePareja = new Map(c.parejas.map((p) => [p.id, jugadoresDe(p).filter(Boolean).map(claveJugador)]))
    const jug = (ids: string[]) => [...new Set(ids.flatMap((id) => jugadoresDePareja.get(id) ?? []))]
    const dias = diasEntre(c.fechaInicio, c.fechaFin).filter((f) => diasCfg.has(f))
    const jugados = clavesJugadas(c)
    const nombre = (id: string) => c.parejas.find((p) => p.id === id)?.nombre ?? '—'
    const apellidos = (id: string) => nombre(id).split(' / ').map((j) => j.split(' ')[0]).join(' / ')
    const porZona: string[][] = []

    c.zonas.forEach((z, zi) => {
      const ps = partidosDeZona(z, zi, apellidos)
      const ids: string[] = []
      for (const p of ps) {
        const de4GP = z.length === 4 && p.numero >= 3
        const parejas = de4GP ? [...z] : z.length === 3 ? [[0, 1], [0, 2], [1, 2]][p.numero - 1].map((i) => z[i]) : (p.numero === 1 ? [z[0], z[3]] : [z[1], z[2]])
        const id = idTarea(c.id, 'zona', p.key)
        ids.push(id)
        tareas.push({
          id, torneoId: c.id, tipo: 'zona', key: p.key, instancia: 'zonas', titulo: `Zona ${LETRAS[zi]} · ${p.codigo}`, a: p.a, b: p.b,
          dur: cfg.duraciones.zonas, parejas, grupo: de4GP ? `${c.id}|${zi}` : undefined, candidatas: [], jugadores: jug(parejas),
          preds: de4GP ? [1, 2].map((n) => ({ id: idTarea(c.id, 'zona', `${zi}-${n}`), gap: cfg.descanso })) : [],
          dias, nivel: de4GP ? 1 : 0, jugado: jugados.zona.has(p.key), actual: c.horariosZona[p.key],
        })
      }
      porZona.push(ids)
    })

    const cuadro = c.cuadro && erroresCuadro(c.cuadro, c.zonas).length === 0 ? c.cuadro : cuadroAutomatico(c.zonas)
    cuadros[c.id] = cuadro
    const rondas = rondasPlayoff(cuadro)
    const partidosPrimera = cuadro.length
    // por cada partido: de qué partidos depende y quiénes podrían jugarlo
    const req = new Map<string, { preds: { id: string; gap: number }[]; cand: string[] }>()
    rondas.forEach((r, ri) => {
      for (const p of r) {
        let preds: { id: string; gap: number }[] = []
        let cand: string[] = []
        if (ri === 0) {
          for (const s of cuadro[p.orden - 1]) {
            if (!s) continue
            preds.push(...(porZona[s.zona] ?? []).map((id) => ({ id, gap: cfg.margenPlayoff })))
            cand.push(...(c.zonas[s.zona] ?? []))
          }
        } else {
          for (const f of [rondas[ri - 1][2 * p.orden - 2], rondas[ri - 1][2 * p.orden - 1]]) {
            const rf = req.get(f.key)!
            if (f.bye) preds.push(...rf.preds)
            else preds.push({ id: idTarea(c.id, 'playoff', f.key), gap: cfg.descanso })
            cand.push(...rf.cand)
          }
        }
        preds = preds.filter((x, i, l) => l.findIndex((y) => y.id === x.id) === i)
        cand = [...new Set(cand)]
        req.set(p.key, { preds, cand })
        if (p.bye) continue
        const instancia = instanciaPorTam(partidosPrimera * 2 / 2 ** ri)
        tareas.push({
          id: idTarea(c.id, 'playoff', p.key), torneoId: c.id, tipo: 'playoff', key: p.key, instancia, titulo: p.titulo, a: p.a, b: p.b,
          dur: cfg.duraciones[instancia], parejas: [], candidatas: cand, jugadores: [], preds, dias, nivel: 2 + ri,
          jugado: jugados.playoff.has(p.key), actual: c.horariosPlayoff[p.key],
        })
      }
    })
  }
  return { tareas, porId: new Map(tareas.map((t) => [t.id, t])), cuadros, disp, nombrePareja, nombreTorneo, torneoDePareja, cfg, sinZonas }
}

const INST: Record<number, Instancia> = { 2: 'final', 4: 'semifinal', 8: 'cuartos', 16: 'octavos', 32: '16avos' }
const instanciaPorTam = (n: number): Instancia => INST[n] ?? '16avos'

// ------------------------------------------------------------------ tiempos

function baseDe(cfg: ConfigFecha) { return cfg.dias[0]?.fecha ?? '2000-01-01' }
const diasDesde = (base: string, f: string) => Math.round((Date.parse(`${f}T12:00:00`) - Date.parse(`${base}T12:00:00`)) / 86400000)

interface Pos { fecha: string; ini: number; fin: number; a0: number; a1: number; cancha: number }

function posDe(a: Asignacion, t: Tarea, cfg: ConfigFecha): Pos | null {
  const d = cfg.dias.find((x) => x.fecha === a.fecha)
  let ini = aMinutos(a.hora)
  if (ini === null) return null
  // madrugada: cuenta como del día (23:15 → 00:00 → 24:00)
  if (d && ini < 6 * 60 && ventana(d)[0] >= 6 * 60) ini += 1440
  const off = diasDesde(baseDe(cfg), a.fecha) * 1440
  return { fecha: a.fecha, ini, fin: ini + t.dur, a0: off + ini, a1: off + ini + t.dur, cancha: a.cancha }
}

const pisan = (a0: number, a1: number, b0: number, b1: number, margen = 0) => a0 < b1 + margen && b0 < a1 + margen

/** ¿La pareja puede jugar ese partido de zona ahí? (día de zona y franjas) */
function zonaOk(d: Disponibilidad | undefined, fecha: string, ini: number, fin: number, abre: number, cierra: number) {
  if (!d) return true
  if (d.zona?.length && !d.zona.includes(fecha)) return false
  return puedeEnFranjas(d, fecha, ini, fin, abre, cierra)
}

// ------------------------------------------------------------------ validación (la usa la grilla y el motor)

export interface Problema { tarea: string; tipo: 'error' | 'aviso'; texto: string }

export function validar(ctx: Contexto, plan: Plan): Problema[] {
  const { cfg, tareas } = ctx
  const out: Problema[] = []
  const pos = new Map<string, Pos>()
  for (const t of tareas) {
    const a = plan[t.id]
    if (!a) { if (!t.jugado) out.push({ tarea: t.id, tipo: 'error', texto: 'Sin día ni horario.' }); continue }
    const p = posDe(a, t, cfg)
    if (!p) { out.push({ tarea: t.id, tipo: 'error', texto: 'Hora inválida.' }); continue }
    pos.set(t.id, p)
    if (t.jugado) continue
    const dia = cfg.dias.find((d) => d.fecha === a.fecha)
    if (!dia || !t.dias.includes(a.fecha)) out.push({ tarea: t.id, tipo: 'error', texto: `${diaCorto(a.fecha)} no es un día de este torneo.` })
    else {
      const [abre, cierra] = ventana(dia)
      if (p.ini < abre || p.fin > cierra) out.push({ tarea: t.id, tipo: 'error', texto: `Fuera del horario de las canchas (${dia.desde} a ${dia.hasta}).` })
      if (t.tipo === 'zona') {
        for (const pid of t.parejas) {
          const d = ctx.disp.get(pid)
          if (!zonaOk(d, a.fecha, p.ini, p.fin, abre, cierra)) {
            const fueraDia = !!d?.zona?.length && !d.zona.includes(a.fecha)
            out.push({ tarea: t.id, tipo: 'aviso', texto: `${ctx.nombrePareja.get(pid)}: ${fueraDia ? `pidió jugar la zona el ${d!.zona!.map((f) => diaCorto(f).slice(0, 3)).join(' o ')}` : 'no puede en ese horario'}.` })
          }
        }
      }
    }
    if (!a.cancha || a.cancha > cfg.canchas) out.push({ tarea: t.id, tipo: 'error', texto: 'Sin cancha asignada.' })
  }
  const vivos = tareas.filter((t) => pos.has(t.id))
  for (let i = 0; i < vivos.length; i++) {
    const t = vivos[i], p = pos.get(t.id)!
    // orden: después de los partidos de los que depende
    for (const pr of t.preds) {
      const q = pos.get(pr.id)
      if (q && !t.jugado && p.a0 < q.a1 + pr.gap) {
        const tp = ctx.porId.get(pr.id)!
        out.push({ tarea: t.id, tipo: 'error', texto: `Empieza antes de que termine ${tp.titulo}${pr.gap ? ` (+${pr.gap}′)` : ''}.` })
      }
    }
    for (let j = i + 1; j < vivos.length; j++) {
      const u = vivos[j], q = pos.get(u.id)!
      if (t.jugado && u.jugado) continue
      if (q.a0 >= p.a1 + cfg.descanso + 600 || p.a0 >= q.a1 + cfg.descanso + 600) continue
      if (p.cancha && p.cancha === q.cancha && pisan(p.a0, p.a1, q.a0, q.a1)) {
        out.push({ tarea: u.id, tipo: 'error', texto: `Cancha ${p.cancha} ocupada por ${nombreCorto(ctx, t)} (${aHora(p.ini)}).` })
      }
      if (t.grupo && t.grupo === u.grupo) continue
      const comunes = t.jugadores.filter((x) => u.jugadores.includes(x))
      if (!comunes.length) continue
      if (pisan(p.a0, p.a1, q.a0, q.a1)) {
        out.push({ tarea: u.id, tipo: 'error', texto: `${comunes.length > 2 ? 'La pareja' : nombreJugador(comunes)} también juega ${nombreCorto(ctx, t)} a las ${aHora(p.ini)}.` })
      } else if (cfg.descanso && pisan(p.a0, p.a1, q.a0, q.a1, cfg.descanso)) {
        out.push({ tarea: u.id, tipo: 'aviso', texto: `Menos de ${cfg.descanso}′ de descanso después de ${nombreCorto(ctx, t)}.` })
      }
    }
  }
  return out
}

const nombreJugador = (claves: string[]) => claves.map((k) => k.replace(/(^|\s)\S/g, (x) => x.toUpperCase())).join(' y ')
/** "7ma Damas · Zona B · 1 v 4" (sin el final común "- Fecha 5") */
const nombreCorto = (ctx: Contexto, t: Tarea) => `${(ctx.nombreTorneo.get(t.torneoId) ?? '').split(' - ')[0]} · ${t.titulo}`

// ------------------------------------------------------------------ motor de horarios

export interface OpcionesMotor {
  /** asignaciones que no se mueven (las fijadas a mano) */
  fijos: Plan
  /** respetar los horarios ya cargados en los torneos */
  respetarCargados: boolean
  /** tiempo máximo de búsqueda */
  ms?: number
}
export interface Propuesta { plan: Plan; problemas: Problema[]; sinLugar: string[] }

interface Estado {
  canchas: Map<string, [number, number][][]>   // fecha → por cancha, intervalos [ini, fin)
  parejas: Map<string, { a0: number; a1: number; tarea: string; grupo?: string; fecha: string; ini: number }[]>
  jugadores: Map<string, { a0: number; a1: number; grupo?: string }[]>
  fin: Map<string, number>                      // tarea → fin absoluto
  plan: Plan
}

export function programar(ctx: Contexto, op: OpcionesMotor): Propuesta {
  const { cfg, tareas } = ctx
  if (!cfg.dias.length || !tareas.length) return { plan: {}, problemas: validar(ctx, {}), sinLugar: tareas.filter((t) => !t.jugado).map((t) => t.id) }
  const base = baseDe(cfg)
  const ventanas = new Map(cfg.dias.map((d) => [d.fecha, ventana(d)]))
  const limite = Date.now() + (op.ms ?? 1200)

  // fijos: jugados con horario, los fijados a mano y (si se pide) los que ya tienen horario cargado
  const fijos: Plan = {}
  for (const t of tareas) {
    const f = op.fijos[t.id]
    if (f && !t.jugado) { fijos[t.id] = { ...f, fijo: true }; continue }
    const h = t.actual
    if ((t.jugado || op.respetarCargados) && h?.fecha && h?.hora) fijos[t.id] = { fecha: h.fecha, hora: h.hora, cancha: Number(h.cancha) || 0, fijo: !t.jugado }
  }

  // flexibilidad (cuántos horarios le sirven a cada partido, sin mirar canchas): primero los más difíciles
  const flex = new Map<string, number>()
  for (const t of tareas) {
    let n = 0
    for (const f of t.dias) {
      const [abre, cierra] = ventanas.get(f)!
      for (let s = abre; s + t.dur <= cierra; s += PASO) if (t.tipo !== 'zona' || t.parejas.every((pid) => zonaOk(ctx.disp.get(pid), f, s, s + t.dur, abre, cierra))) n++
    }
    flex.set(t.id, n)
  }

  // cola: lo que falta jugar después de cada partido (los de cadena más larga, primero)
  const sucesores = new Map<string, string[]>()
  for (const t of tareas) for (const p of t.preds) sucesores.set(p.id, [...(sucesores.get(p.id) ?? []), t.id])
  const cola = new Map<string, number>()
  const colaDe = (id: string): number => {
    if (cola.has(id)) return cola.get(id)!
    cola.set(id, 0)
    const v = Math.max(0, ...(sucesores.get(id) ?? []).map((s) => (ctx.porId.get(s)?.dur ?? 0) + colaDe(s)))
    cola.set(id, v)
    return v
  }
  tareas.forEach((t) => colaDe(t.id))

  let mejor: Propuesta | null = null
  let mejorPuntaje = Infinity
  for (let it = 0; it === 0 || Date.now() < limite; it++) {
    const ruido = it === 0 ? 0 : 1
    const prioridad = new Map(tareas.map((t) => [t.id,
      (flex.get(t.id) ?? 0) * (1 + ruido * (Math.random() - 0.5) * 0.8) - (cola.get(t.id) ?? 0) / PASO * 3 + ruido * Math.random() * 10]))
    const pendientes = tareas.filter((t) => !fijos[t.id] && !t.jugado)
    const r = unaPasada(ctx, pendientes, prioridad, fijos, base, ventanas, it === 0 ? 0 : 0.6)
    const problemas = validar(ctx, r.plan)
    const puntaje = problemas.filter((p) => p.tipo === 'error').length * 10000 + problemas.filter((p) => p.tipo === 'aviso').length * 400 + r.costo
    if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; mejor = { plan: r.plan, problemas, sinLugar: r.sinLugar } }
    if (it > 400) break
  }
  return mejor!
}

function unaPasada(ctx: Contexto, pendientes: Tarea[], prioridad: Map<string, number>, fijos: Plan, base: string, ventanas: Map<string, [number, number]>, azar: number) {
  const { cfg } = ctx
  const e: Estado = { canchas: new Map(), parejas: new Map(), jugadores: new Map(), fin: new Map(), plan: {} }
  for (const d of cfg.dias) e.canchas.set(d.fecha, Array.from({ length: cfg.canchas }, () => []))
  const off = (f: string) => diasDesde(base, f) * 1440

  const ocupar = (t: Tarea, fecha: string, ini: number, cancha: number, fijo?: boolean) => {
    const a0 = off(fecha) + ini, a1 = a0 + t.dur
    if (cancha >= 1 && cancha <= cfg.canchas) e.canchas.get(fecha)?.[cancha - 1].push([ini, ini + t.dur])
    for (const pid of t.parejas) {
      const l = e.parejas.get(pid) ?? []
      l.push({ a0, a1, tarea: t.id, grupo: t.grupo, fecha, ini })
      e.parejas.set(pid, l)
    }
    for (const j of t.jugadores) {
      const l = e.jugadores.get(j) ?? []
      l.push({ a0, a1, grupo: t.grupo })
      e.jugadores.set(j, l)
    }
    e.fin.set(t.id, a1)
    e.plan[t.id] = { fecha, hora: aHora(ini), cancha, ...(fijo ? { fijo: true } : {}) }
  }

  // fijos y jugados primero
  for (const t of ctx.tareas) {
    const f = fijos[t.id]
    if (!f) continue
    const p = posDe(f, t, cfg)
    if (!p) continue
    let cancha = f.cancha
    const libres = e.canchas.get(f.fecha)
    if (libres && (!cancha || cancha > cfg.canchas || libres[cancha - 1].some(([a, b]) => pisan(p.ini, p.fin, a, b)))) {
      const k = libres.findIndex((l) => !l.some(([a, b]) => pisan(p.ini, p.fin, a, b)))
      if (k >= 0) cancha = k + 1
    }
    ocupar(t, f.fecha, p.ini, cancha, f.fijo)
  }
  // partidos jugados sin horario: no ocupan nada pero no bloquean a los que dependen de ellos
  for (const t of ctx.tareas) if (t.jugado && !e.fin.has(t.id)) e.fin.set(t.id, -Infinity)

  let costo = 0
  const sinLugar: string[] = []
  const resta = new Set(pendientes)
  const listo = (t: Tarea) => t.preds.every((pr) => e.fin.has(pr.id))
  while (resta.size) {
    // de los partidos que ya se pueden ubicar (sus anteriores ya tienen horario), el de mayor prioridad
    let t: Tarea | null = null
    for (const x of resta) if (listo(x) && (!t || prioridad.get(x.id)! < prioridad.get(t.id)!)) t = x
    if (!t) { sinLugar.push(...[...resta].map((x) => x.id)); break }
    resta.delete(t)
    let desde = -Infinity
    for (const pr of t.preds) desde = Math.max(desde, e.fin.get(pr.id)! + pr.gap)
    let mejor = null as { fecha: string; ini: number; cancha: number; c: number } | null
    for (const estricto of [true, false]) {
      for (const fecha of t.dias) {
        const [abre, cierra] = ventanas.get(fecha)!
        const canchas = e.canchas.get(fecha)!
        const o = off(fecha)
        for (let ini = abre; ini + t.dur <= cierra; ini += PASO) {
          const fin = ini + t.dur
          const a0 = o + ini, a1 = o + fin
          if (a0 < desde) continue
          // de las canchas libres, la que queda con menos hueco antes (así se aprovechan mejor)
          let k = -1, hueco = Infinity
          canchas.forEach((l, ci) => {
            if (l.some(([x, y]) => pisan(ini, fin, x, y))) return
            const antes = l.reduce((m, [, y]) => (y <= ini && y > m ? y : m), abre)
            if (ini - antes < hueco) { hueco = ini - antes; k = ci }
          })
          if (k < 0) continue
          // la misma pareja / jugador no puede estar en dos partidos a la vez (con descanso)
          if (t.parejas.some((pid) => (e.parejas.get(pid) ?? []).some((x) => !(t.grupo && x.grupo === t.grupo) && pisan(a0, a1, x.a0, x.a1, cfg.descanso)))) continue
          if (t.jugadores.some((j) => (e.jugadores.get(j) ?? []).some((x) => !(t.grupo && x.grupo === t.grupo) && pisan(a0, a1, x.a0, x.a1, cfg.descanso)))) continue
          let c = (a0 - off(cfg.dias[0].fecha) - ventanas.get(cfg.dias[0].fecha)![0]) / PASO + (hueco / PASO) * 0.8
          if (t.tipo === 'zona') {
            let mal = 0
            for (const pid of t.parejas) {
              const d = ctx.disp.get(pid)
              if (!zonaOk(d, fecha, ini, fin, abre, cierra)) mal++
              if (d?.preferencia === 'temprano') c += ((ini - abre) / PASO) * 2.5
              if (d?.preferencia === 'tarde') c += ((cierra - fin) / PASO) * 2.5
              if (!t.grupo) {
                // que los partidos de una pareja queden cerca (mismo día, poca espera)
                for (const x of e.parejas.get(pid) ?? []) {
                  if (x.fecha !== fecha) { c += 40; continue }
                  const espera = ini >= x.ini ? ini - (x.ini + t.dur) : x.ini - fin
                  if (espera > 60) c += ((espera - 60) / PASO) * 1.5
                }
              }
            }
            if (estricto && mal) continue
            c += mal * 500
          } else if (t.candidatas.length) {
            const no = t.candidatas.filter((pid) => !puedeEnFranjas(ctx.disp.get(pid), fecha, ini, fin, abre, cierra)).length
            c += (no / t.candidatas.length) * 30
          }
          if (azar) c += Math.random() * azar * 6
          if (!mejor || c < mejor.c) mejor = { fecha, ini, cancha: k + 1, c }
        }
      }
      if (mejor) break
    }
    if (!mejor) { sinLugar.push(t.id); e.fin.set(t.id, Infinity); continue }
    costo += mejor.c
    ocupar(t, mejor.fecha, mejor.ini, mejor.cancha)
  }
  return { plan: e.plan, sinLugar, costo }
}

// ------------------------------------------------------------------ zonas por disponibilidad

/**
 * Reparte las parejas de un torneo en zonas (mismos tamaños que el sorteo: de 3 y de 4) juntando
 * a las que pueden jugar en los mismos días y horarios. En zonas de 4 elige quién juega 1 vs 4 y 2 vs 3.
 */
export function zonasPorDisponibilidad(c: Categoria, cfg: ConfigFecha): string[][] {
  const ids = c.parejas.map((p) => p.id)
  const tam = sugerirZonas(ids, false).map((z) => z.length)
  if (!tam.length) return []
  const grilla: boolean[][] = c.parejas.map((p) => grillaZona(p.disponibilidad, c, cfg))
  const n = ids.length
  const L = grilla[0]?.length ?? 0
  const ov: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
    let k = 0
    for (let s = 0; s < L; s++) if (grilla[i][s] && grilla[j][s]) k++
    return k
  }))
  const comun = (m: number[]) => { let k = 0; for (let s = 0; s < L; s++) if (m.every((i) => grilla[i][s])) k++; return k }
  const puntajeZona = (m: number[]) => {
    let p = 0
    for (let a = 0; a < m.length; a++) for (let b = a + 1; b < m.length; b++) {
      const o = ov[m[a]][m[b]]
      p += Math.min(o, 16) - (o < 4 ? 120 : 0)
    }
    const cm = comun(m)
    return p + Math.min(cm, 16) * 3 - (cm < 4 ? 60 : 0)
  }
  const total = (zs: number[][]) => zs.reduce((s, z) => s + puntajeZona(z), 0)

  let mejor: number[][] | null = null
  let mejorP = -Infinity
  for (let intento = 0; intento < 12; intento++) {
    // reparto inicial: primero las más difíciles, cada una a la zona donde mejor encaja
    const orden = [...Array(n).keys()].sort((a, b) => grilla[a].filter(Boolean).length - grilla[b].filter(Boolean).length + (intento ? (Math.random() - 0.5) * 20 : 0))
    const zs: number[][] = tam.map(() => [])
    for (const i of orden) {
      let k = -1, kp = -Infinity
      zs.forEach((z, zi) => {
        if (z.length >= tam[zi]) return
        const g = z.length ? z.reduce((s, j) => s + Math.min(ov[i][j], 16) - (ov[i][j] < 4 ? 120 : 0), 0) / z.length : 0.5
        if (g > kp) { kp = g; k = zi }
      })
      zs[k].push(i)
    }
    // mejora: intercambiar parejas entre zonas mientras sume
    let p = total(zs)
    for (let paso = 0; paso < 3000; paso++) {
      const z1 = Math.floor(Math.random() * zs.length), z2 = Math.floor(Math.random() * zs.length)
      if (z1 === z2) continue
      const i1 = Math.floor(Math.random() * zs[z1].length), i2 = Math.floor(Math.random() * zs[z2].length)
      const antes = puntajeZona(zs[z1]) + puntajeZona(zs[z2])
      ;[zs[z1][i1], zs[z2][i2]] = [zs[z2][i2], zs[z1][i1]]
      const despues = puntajeZona(zs[z1]) + puntajeZona(zs[z2])
      if (despues >= antes) p += despues - antes
      else [zs[z1][i1], zs[z2][i2]] = [zs[z2][i2], zs[z1][i1]]
    }
    if (p > mejorP) { mejorP = p; mejor = zs.map((z) => [...z]) }
  }
  // zonas de 4: el orden que deja mejor parados los cruces 1 vs 4 y 2 vs 3
  const out = mejor!.map((z) => {
    if (z.length !== 4) return z
    const [a, b, cc, d] = z
    const opciones = [[a, b, cc, d], [a, cc, b, d], [a, d, b, cc]].map(([w, x, y, v]) => ({ z: [w, x, y, v], p: Math.min(ov[w][v], ov[x][y]) }))
    return opciones.sort((x, y) => y.p - x.p)[0].z
  })
  return out.map((z) => z.map((i) => ids[i]))
}

/** Disponibilidad para jugar la zona en una grilla de turnos de 15′ (todos los días del torneo en la fecha) */
function grillaZona(d: Disponibilidad | undefined, c: Categoria, cfg: ConfigFecha): boolean[] {
  const dias = diasEntre(c.fechaInicio, c.fechaFin)
  const dur = cfg.duraciones.zonas
  const v: boolean[] = []
  for (const x of cfg.dias) {
    if (!dias.includes(x.fecha)) continue
    const [abre, cierra] = ventana(x)
    for (let s = abre; s + dur <= cierra; s += PASO) v.push(zonaOk(d, x.fecha, s, s + dur, abre, cierra))
  }
  return v
}

/** Parejas de una zona que no coinciden en ningún horario (no podrían jugar entre ellas) */
export function incompatiblesZona(c: Categoria, zona: string[], cfg: ConfigFecha): [string, string][] {
  const g = new Map(zona.map((id) => [id, grillaZona(c.parejas.find((p) => p.id === id)?.disponibilidad, c, cfg)]))
  const out: [string, string][] = []
  for (let i = 0; i < zona.length; i++) for (let j = i + 1; j < zona.length; j++) {
    const a = g.get(zona[i])!, b = g.get(zona[j])!
    let k = 0
    for (let s = 0; s < a.length; s++) if (a[s] && b[s]) k++
    if (k < 3) out.push([zona[i], zona[j]])
  }
  return out
}

/** Jugadores anotados en más de un torneo de la fecha */
export function jugadoresRepetidos(cats: Categoria[]): { nombre: string; torneos: string[] }[] {
  const m = new Map<string, { nombre: string; torneos: Set<string> }>()
  for (const c of cats) for (const p of c.parejas) for (const j of jugadoresDe(p)) {
    if (!j.trim()) continue
    const k = claveJugador(j)
    const x = m.get(k) ?? { nombre: j, torneos: new Set<string>() }
    x.torneos.add(c.torneo)
    m.set(k, x)
  }
  return [...m.values()].filter((x) => x.torneos.size > 1).map((x) => ({ nombre: x.nombre, torneos: [...x.torneos] }))
}
