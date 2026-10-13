// Guardado en Supabase (tablas torneos_nodo_*).
// En memoria se sigue trabajando con `Categoria`; acá se traduce a filas y se sincroniza
// solo lo que cambió (por fila), así dos personas cargando resultados de partidos distintos no se pisan.
import { supabase, T } from './supabase'
import { estadoTorneo, evaluar, resolverTorneo } from './resultados'
import {
  FORMATOS_DEFECTO, INSTANCIAS, esUuid, instanciaDeRonda, jugadoresDe, normalizar, nuevoId,
  type Categoria, type EstadoTorneo, type Formato, type Horario, type Instancia, type Resultado, type Slot,
} from './torneo'

// ------------------------------------------------------------------ filas

export interface FilaTorneo {
  id: string; nombre: string; premio: string; fecha_inicio: string | null; fecha_fin: string | null
  inscripcion: number | null; observacion: string; cant_zonas: number; cuadro: (Slot | null)[][] | null; desempates: Record<string, string[]>
  publicado: boolean; estado: EstadoTorneo; campeon: string | null
}
export interface FilaPareja { id: string; torneo_id: string; orden: number; jugador1: string; jugador2: string; horario: string; zona: number | null; posicion: number | null }
export interface FilaInstancia { torneo_id: string; instancia: Instancia; formato: Formato }
export interface FilaPartido {
  torneo_id: string; clave: string; instancia: Instancia | null; fecha: string | null; hora: string | null; sede: string | null
  pareja_a: string | null; pareja_b: string | null; sets: [number, number][] | null; wo: 'a' | 'b' | null; resultado: string | null; ganador: string | null
}
interface Filas { torneo: FilaTorneo; parejas: FilaPareja[]; instancias: FilaInstancia[]; partidos: FilaPartido[] }

function aFilas(c: Categoria): Filas {
  const ids = new Set(c.parejas.map((p) => p.id))
  const valido = (id: string | undefined | null) => (id && ids.has(id) ? id : null)
  const campeonId = resolverTorneo(c).campeon
  const torneo: FilaTorneo = {
    id: c.id, nombre: c.torneo, premio: c.premio, fecha_inicio: c.fechaInicio || null, fecha_fin: c.fechaFin || null,
    inscripcion: c.inscripcion ? Number(c.inscripcion) : null, observacion: c.observacion, cant_zonas: c.zonas.length,
    cuadro: c.cuadro, desempates: c.desempates,
    // para la página pública: visible, estado calculado y nombre del campeón
    publicado: c.publicado, estado: estadoTorneo(c, campeonId), campeon: campeonId ? c.parejas.find((p) => p.id === campeonId)?.nombre ?? null : null,
  }
  const parejas: FilaPareja[] = c.parejas.map((p, i) => {
    const [j1, j2] = jugadoresDe(p)
    const zi = c.zonas.findIndex((z) => z.includes(p.id))
    return {
      id: p.id, torneo_id: c.id, orden: i, jugador1: j1, jugador2: j2, horario: p.horario ?? '',
      zona: zi >= 0 ? zi : null, posicion: zi >= 0 ? c.zonas[zi].indexOf(p.id) + 1 : null,
    }
  })
  const instancias: FilaInstancia[] = INSTANCIAS.map((i) => ({ torneo_id: c.id, instancia: i.id, formato: c.formatos[i.id] }))

  const partidos: FilaPartido[] = []
  const fila = (clave: string, instancia: Instancia | null, h: Horario | undefined, r: Resultado | undefined) => {
    const conHorario = !!(h?.fecha || h?.hora || h?.sede)
    if (!conHorario && !r) return
    const ev = r && instancia ? evaluar(c.formatos[instancia], r) : undefined
    const a = valido(r?.a), b = valido(r?.b)
    partidos.push({
      torneo_id: c.id, clave, instancia, fecha: h?.fecha || null, hora: h?.hora || null, sede: h?.sede || null,
      pareja_a: a, pareja_b: b, sets: r && !r.wo ? r.sets : null, wo: r?.wo ?? null,
      resultado: r ? (r.wo ? 'W.O.' : r.sets.map(([x, y]) => `${x}-${y}`).join(' ')) : null,
      ganador: ev?.ok ? (ev.ganador === 'a' ? a : b) : null,
    })
  }
  for (const k of new Set([...Object.keys(c.horariosZona), ...Object.keys(c.resultadosZona)])) {
    fila(`Z${k}`, 'zonas', c.horariosZona[k], c.resultadosZona[k])
  }
  for (const k of new Set([...Object.keys(c.horariosPlayoff), ...Object.keys(c.resultadosPlayoff)])) {
    const inst = c.cuadro?.length ? instanciaDeRonda(c.cuadro.length, Number(k.split('-')[0])) : null
    fila(`P${k}`, inst, c.horariosPlayoff[k], c.resultadosPlayoff[k])
  }
  return { torneo, parejas, instancias, partidos }
}

export function desdeFilas(t: FilaTorneo & { actualizado?: string }, ps: FilaPareja[], is: FilaInstancia[], pts: FilaPartido[]): Categoria {
  const parejas = [...ps].sort((a, b) => a.orden - b.orden)
  const maxZona = Math.max(t.cant_zonas, ...parejas.map((p) => (p.zona ?? -1) + 1))
  const zonas: string[][] = Array.from({ length: maxZona }, (_, zi) =>
    parejas.filter((p) => p.zona === zi).sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0)).map((p) => p.id))
  const formatos = { ...FORMATOS_DEFECTO }
  for (const i of is) formatos[i.instancia] = i.formato
  const c: Categoria = {
    id: t.id, torneo: t.nombre, premio: t.premio ?? '', fechaInicio: t.fecha_inicio ?? '', fechaFin: t.fecha_fin ?? '',
    inscripcion: t.inscripcion != null ? String(t.inscripcion) : '', observacion: t.observacion,
    parejas: parejas.map((p) => ({ id: p.id, nombre: `${p.jugador1} / ${p.jugador2}`, jugador1: p.jugador1, jugador2: p.jugador2, horario: p.horario })),
    zonas, cuadro: t.cuadro, desempates: t.desempates ?? {}, formatos,
    publicado: !!t.publicado, cancelado: t.estado === 'cancelado',
    horariosZona: {}, horariosPlayoff: {}, resultadosZona: {}, resultadosPlayoff: {},
    actualizado: t.actualizado ? Date.parse(t.actualizado) : Date.now(),
  }
  for (const p of pts) {
    const k = p.clave.slice(1)
    const zona = p.clave[0] === 'Z'
    if (p.fecha || p.hora || p.sede) {
      const h: Horario = { fecha: p.fecha ?? '', hora: p.hora ? p.hora.slice(0, 5) : '', ...(p.sede ? { sede: p.sede } : {}) }
      ;(zona ? c.horariosZona : c.horariosPlayoff)[k] = h
    }
    if (p.sets || p.wo) {
      const r: Resultado = { a: p.pareja_a ?? '', b: p.pareja_b ?? '', sets: p.sets ?? [], ...(p.wo ? { wo: p.wo } : {}) }
      ;(zona ? c.resultadosZona : c.resultadosPlayoff)[k] = r
    }
  }
  return normalizar(c)
}

// ------------------------------------------------------------------ foto de lo último guardado

interface Foto { torneo: string; parejas: Map<string, string>; instancias: Map<string, string>; partidos: Map<string, string> }
const fotos = new Map<string, Foto>()
const json = (x: unknown) => JSON.stringify(x)

function foto(f: Filas): Foto {
  return {
    torneo: json(f.torneo),
    parejas: new Map(f.parejas.map((p) => [p.id, json(p)])),
    instancias: new Map(f.instancias.map((i) => [i.instancia, json(i)])),
    partidos: new Map(f.partidos.map((p) => [p.clave, json(p)])),
  }
}

const chequear = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message) }

/** Sube lo que cambió respecto de la última foto (o todo, si es la primera vez) */
async function sincronizar(c: Categoria) {
  const f = aFilas(c)
  const prev = fotos.get(c.id)
  const nueva = foto(f)
  if (!prev || prev.torneo !== nueva.torneo) chequear(await supabase.from(T.torneos).upsert(f.torneo))

  const cambiadas = <X>(lista: X[], clave: (x: X) => string, antes: Map<string, string> | undefined, ahora: Map<string, string>) =>
    lista.filter((x) => antes?.get(clave(x)) !== ahora.get(clave(x)))

  const parejas = cambiadas(f.parejas, (p) => p.id, prev?.parejas, nueva.parejas)
  if (parejas.length) chequear(await supabase.from(T.parejas).upsert(parejas))
  const instancias = cambiadas(f.instancias, (i) => i.instancia, prev?.instancias, nueva.instancias)
  if (instancias.length) chequear(await supabase.from(T.instancias).upsert(instancias, { onConflict: 'torneo_id,instancia' }))
  const partidos = cambiadas(f.partidos, (p) => p.clave, prev?.partidos, nueva.partidos)
  if (partidos.length) chequear(await supabase.from(T.partidos).upsert(partidos, { onConflict: 'torneo_id,clave' }))

  if (prev) {
    const sinPartido = [...prev.partidos.keys()].filter((k) => !nueva.partidos.has(k))
    if (sinPartido.length) chequear(await supabase.from(T.partidos).delete().eq('torneo_id', c.id).in('clave', sinPartido))
    const sinPareja = [...prev.parejas.keys()].filter((k) => !nueva.parejas.has(k))
    if (sinPareja.length) chequear(await supabase.from(T.parejas).delete().eq('torneo_id', c.id).in('id', sinPareja))
  }
  fotos.set(c.id, nueva)
}

// ------------------------------------------------------------------ cola de guardado (con espera)

export type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'error'
const pendientes = new Map<string, Categoria>()
const oyentes = new Set<(e: EstadoGuardado, error: string) => void>()
let estado: EstadoGuardado = 'guardado'
let ultimoError = ''
let timer: ReturnType<typeof setTimeout> | undefined
let cadena: Promise<void> = Promise.resolve()

function setEstado(e: EstadoGuardado, err = '') {
  estado = e
  ultimoError = err
  oyentes.forEach((f) => f(e, err))
}
export const estadoGuardado = () => ({ estado, error: ultimoError })
export function escucharGuardado(f: (e: EstadoGuardado, error: string) => void) {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

/** Guarda en unos instantes (agrupa los cambios seguidos, por ejemplo al escribir) */
export function guardar(c: Categoria) {
  pendientes.set(c.id, c)
  setEstado('pendiente')
  clearTimeout(timer)
  timer = setTimeout(() => { void vaciar() }, 700)
}

/** Sube ya todo lo pendiente (al salir del torneo, antes de recargar…) */
export function vaciar(): Promise<void> {
  clearTimeout(timer)
  cadena = cadena.then(async () => {
    const lista = [...pendientes.values()]
    pendientes.clear()
    if (!lista.length) return
    setEstado('guardando')
    for (const c of lista) {
      try {
        await sincronizar(c)
      } catch (e) {
        // se reintenta (si mientras tanto hubo una versión más nueva, queda esa)
        if (!pendientes.has(c.id)) pendientes.set(c.id, c)
        setEstado('error', e instanceof Error ? e.message : 'No se pudo guardar')
        timer = setTimeout(() => { void vaciar() }, 5000)
        return
      }
    }
    setEstado(pendientes.size ? 'pendiente' : 'guardado')
  })
  return cadena
}

/** Guarda y espera a que termine (para crear / duplicar / importar) */
export async function guardarAhora(c: Categoria) {
  pendientes.set(c.id, c)
  await vaciar()
  if (estado === 'error') throw new Error(ultimoError)
}

// ------------------------------------------------------------------ lectura

export interface ResumenTorneo {
  id: string; torneo: string; fechaInicio: string; fechaFin: string
  parejas: number; zonas: number; playoff: boolean; actualizado: number
  publicado: boolean; estado: EstadoTorneo
}

export async function listar(): Promise<ResumenTorneo[]> {
  const { data, error } = await supabase
    .from(T.torneos)
    .select(`id, nombre, fecha_inicio, fecha_fin, cant_zonas, cuadro, actualizado, publicado, estado, parejas:${T.parejas}(count)`)
    .order('actualizado', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as (FilaTorneo & { actualizado: string; parejas: { count: number }[] })[]).map((t) => ({
    id: t.id, torneo: t.nombre, fechaInicio: t.fecha_inicio ?? '', fechaFin: t.fecha_fin ?? '',
    parejas: t.parejas?.[0]?.count ?? 0, zonas: t.cant_zonas, playoff: !!t.cuadro, actualizado: Date.parse(t.actualizado),
    publicado: !!t.publicado, estado: t.estado ?? 'pendiente',
  }))
}

async function traer(ids?: string[]): Promise<Categoria[]> {
  const sel = (tabla: string, col: string) => {
    const q = supabase.from(tabla).select('*')
    return ids ? q.in(col, ids) : q
  }
  const [t, p, i, pt] = await Promise.all([sel(T.torneos, 'id'), sel(T.parejas, 'torneo_id'), sel(T.instancias, 'torneo_id'), sel(T.partidos, 'torneo_id')])
  for (const r of [t, p, i, pt]) chequear(r)
  return (t.data as (FilaTorneo & { actualizado: string })[]).map((x) => {
    const c = desdeFilas(
      x,
      (p.data as FilaPareja[]).filter((y) => y.torneo_id === x.id),
      (i.data as FilaInstancia[]).filter((y) => y.torneo_id === x.id),
      (pt.data as FilaPartido[]).filter((y) => y.torneo_id === x.id),
    )
    const f = aFilas(c)
    fotos.set(c.id, foto(f))
    // estado y campeón se calculan en la app: si en la base quedaron viejos (por ejemplo, torneos anteriores
    // a la página pública), se actualizan solos al abrir el torneo
    if (x.estado !== f.torneo.estado || (x.campeon ?? null) !== f.torneo.campeon) {
      fotos.get(c.id)!.torneo = ''
      guardar(c)
    }
    return c
  })
}

/** Torneo completo desde la base. Si hay cambios sin subir de ese torneo, primero los sube */
export async function cargar(id: string): Promise<Categoria | null> {
  if (pendientes.has(id)) await vaciar()
  return (await traer([id]))[0] ?? null
}

export async function eliminar(id: string) {
  pendientes.delete(id)
  chequear(await supabase.from(T.torneos).delete().eq('id', id))
  fotos.delete(id)
}

/** Copia con ids nuevos (para otra categoría del mismo torneo). Mantiene horarios, sin resultados */
export async function duplicar(id: string): Promise<Categoria> {
  const c = await cargar(id)
  if (!c) throw new Error('No se encontró el torneo.')
  const copia = { ...conIdsNuevos(c, true), torneo: `${c.torneo} (copia)`, resultadosZona: {}, resultadosPlayoff: {}, desempates: {}, publicado: false, cancelado: false }
  await guardarAhora(copia)
  return copia
}

/** Cambia el id del torneo y de las parejas (todos, o solo los que no son UUID: respaldos viejos) */
function conIdsNuevos(c: Categoria, todos: boolean): Categoria {
  const m = new Map<string, string>()
  const nuevo = (id: string) => {
    if (!todos && esUuid(id)) return id
    if (!m.has(id)) m.set(id, nuevoId())
    return m.get(id)!
  }
  const r = (x: Record<string, Resultado>) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, { ...v, a: nuevo(v.a), b: nuevo(v.b) }]))
  return {
    ...c,
    id: todos || !esUuid(c.id) ? nuevoId() : c.id,
    parejas: c.parejas.map((p) => ({ ...p, id: nuevo(p.id) })),
    zonas: c.zonas.map((z) => z.map(nuevo)),
    resultadosZona: r(c.resultadosZona),
    resultadosPlayoff: r(c.resultadosPlayoff),
    desempates: Object.fromEntries(Object.entries(c.desempates).map(([k, v]) => [k, v.map(nuevo)])),
  }
}

// ------------------------------------------------------------------ importación (solo para subir los torneos de la versión anterior)

const APP = 'nodo'
interface Respaldo { app: string; version: 1; exportado: string; torneos: Categoria[] }

/**
 * Carga un respaldo en la base. Los torneos que no están se agregan; los que ya están
 * se reemplazan solo si el del archivo es más nuevo. Nunca borra torneos.
 */
async function importar(texto: string): Promise<{ nuevos: number; actualizados: number; sinCambios: number }> {
  let r: Partial<Respaldo>
  try { r = JSON.parse(texto) } catch { throw new Error('El archivo no es un respaldo válido.') }
  if (!r || !Array.isArray(r.torneos)) throw new Error('El archivo no es un respaldo válido.')
  if (r.app && r.app !== APP) throw new Error(`Ese respaldo es de otro complejo (${r.app}). Importalo en su propia app.`)
  const validos = r.torneos.filter((t): t is Categoria => !!t && typeof t.id === 'string' && Array.isArray(t.parejas) && Array.isArray(t.zonas))
  const actuales = new Map((await listar()).map((t) => [t.id, t]))
  let nuevos = 0, actualizados = 0, sinCambios = 0
  for (const t0 of validos) {
    const t = conIdsNuevos(normalizar(t0), false)
    const ya = actuales.get(t.id)
    if (!ya) { fotos.delete(t.id); await guardarAhora(t); nuevos++ }
    else if ((t.actualizado ?? 0) > ya.actualizado) { await cargar(t.id); await guardarAhora(t); actualizados++ }
    else sinCambios++
  }
  return { nuevos, actualizados, sinCambios }
}

// ------------------------------------------------------------------ torneos de la versión anterior (localStorage)

const CLAVE_LOCAL = 'nodo-generador:categorias:v1'

/** Cantidad de torneos que quedaron guardados en este navegador (versión sin base de datos) */
export function torneosLocales(): number {
  try { return (JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? '[]') as unknown[]).length } catch { return 0 }
}

/** Los sube a la base y deja una copia del original en otra clave, por las dudas */
export async function migrarLocales() {
  const texto = localStorage.getItem(CLAVE_LOCAL) ?? '[]'
  const res = await importar(JSON.stringify({ app: APP, version: 1, exportado: new Date().toISOString(), torneos: JSON.parse(texto) }))
  try { localStorage.setItem(`${CLAVE_LOCAL}:migrado`, texto); localStorage.removeItem(CLAVE_LOCAL) } catch { /* nada */ }
  return res
}
