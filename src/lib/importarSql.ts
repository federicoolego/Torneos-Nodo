// Importación de torneos desde un archivo .sql (el que se genera desde el Excel).
// La app NO ejecuta SQL: lee el archivo, acepta solo INSERT … ON CONFLICT sobre las tablas torneos_nodo_*
// y los traduce a upserts de Supabase (con los permisos del usuario logueado, igual que el resto de la app).
import { supabase, T } from './supabase'
import { desdeFilas, vaciar, type FilaInstancia, type FilaPareja, type FilaPartido, type FilaTorneo, type ResumenTorneo } from './almacen'
import {
  MAX_PAREJAS, MIN_PAREJAS, LETRAS, erroresCuadro, esCategoriaTorneo, esUuid, instanciaDeRonda, partidosDeZona, rondasPlayoff,
  type Categoria, type CategoriaTorneo,
} from './torneo'

// ------------------------------------------------------------------ tablas y columnas permitidas

export type TablaImport = 'torneos' | 'jugadores' | 'instancias' | 'parejas' | 'partidos'

const TABLAS: Record<string, TablaImport> = {
  torneos_nodo_torneos: 'torneos',
  torneos_nodo_jugadores: 'jugadores',
  torneos_nodo_instancias: 'instancias',
  torneos_nodo_parejas: 'parejas',
  torneos_nodo_partidos: 'partidos',
}
const COLUMNAS: Record<TablaImport, string[]> = {
  torneos: ['id', 'nombre', 'categoria', 'premio', 'fecha_inicio', 'fecha_fin', 'inscripcion', 'observacion', 'cant_zonas', 'cuadro', 'desempates', 'publicado', 'estado', 'campeon'],
  jugadores: ['nombre'],
  instancias: ['torneo_id', 'instancia', 'formato'],
  parejas: ['id', 'torneo_id', 'orden', 'jugador1', 'jugador2', 'horario', 'zona', 'posicion', 'disponibilidad'],
  partidos: ['torneo_id', 'clave', 'instancia', 'fecha', 'hora', 'sede', 'cancha', 'pareja_a', 'pareja_b', 'sets', 'wo', 'resultado', 'ganador'],
}
/** clave única de cada tabla (la del ON CONFLICT) */
const CLAVE: Record<TablaImport, string[]> = {
  torneos: ['id'], jugadores: ['nombre'], instancias: ['torneo_id', 'instancia'], parejas: ['id'], partidos: ['torneo_id', 'clave'],
}
/** orden de carga (por las claves foráneas) */
const ORDEN: TablaImport[] = ['torneos', 'jugadores', 'instancias', 'parejas', 'partidos']
const NOMBRE_TABLA: Record<TablaImport, string> = { torneos: 'torneos', jugadores: 'jugadores', instancias: 'formatos', parejas: 'parejas', partidos: 'partidos' }

type Valor = string | number | boolean | null | object
type Fila = Record<string, Valor>

export interface Sentencia {
  tabla: TablaImport
  columnas: string[]
  filas: Fila[]
  /** null = INSERT sin ON CONFLICT (si la fila ya existe, falla) */
  conflicto: { accion: 'nada' | 'actualizar'; set: string[] } | null
  linea: number
}
export interface ArchivoSql { sentencias: Sentencia[]; ignoradas: number }

// ------------------------------------------------------------------ lectura del SQL

type Tok = { t: 'id' | 'str' | 'num' | 'p'; v: string; linea: number }

function tokenizar(sql: string): Tok[] {
  const out: Tok[] = []
  let i = 0, linea = 1
  const n = sql.length
  while (i < n) {
    const c = sql[i]
    if (c === '\n') { linea++; i++; continue }
    if (/\s/.test(c)) { i++; continue }
    if (c === '-' && sql[i + 1] === '-') { while (i < n && sql[i] !== '\n') i++; continue }
    if (c === '/' && sql[i + 1] === '*') {
      const fin = sql.indexOf('*/', i + 2)
      const hasta = fin < 0 ? n : fin + 2
      linea += (sql.slice(i, hasta).match(/\n/g) ?? []).length
      i = hasta
      continue
    }
    if (c === "'") {
      let v = ''
      const desde = linea
      i++
      for (;;) {
        if (i >= n) throw new Error(`Línea ${desde}: hay un texto entre comillas sin cerrar.`)
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { v += "'"; i += 2; continue }
          i++
          break
        }
        if (sql[i] === '\n') linea++
        v += sql[i++]
      }
      out.push({ t: 'str', v, linea: desde })
      continue
    }
    if (c === '"') {
      const fin = sql.indexOf('"', i + 1)
      if (fin < 0) throw new Error(`Línea ${linea}: identificador entre comillas sin cerrar.`)
      out.push({ t: 'id', v: sql.slice(i + 1, fin).toLowerCase(), linea })
      i = fin + 1
      continue
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_]/.test(sql[j])) j++
      out.push({ t: 'id', v: sql.slice(i, j).toLowerCase(), linea })
      i = j
      continue
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(sql[i + 1] ?? ''))) {
      let j = i + 1
      while (j < n && /[0-9.]/.test(sql[j])) j++
      out.push({ t: 'num', v: sql.slice(i, j), linea })
      i = j
      continue
    }
    if (c === ':' && sql[i + 1] === ':') { out.push({ t: 'p', v: '::', linea }); i += 2; continue }
    out.push({ t: 'p', v: c, linea })
    i++
  }
  return out
}

/** Separa en sentencias por ";" (fuera de textos y comentarios) */
function sentenciasDe(toks: Tok[]): Tok[][] {
  const out: Tok[][] = []
  let act: Tok[] = []
  for (const t of toks) {
    if (t.t === 'p' && t.v === ';') { if (act.length) out.push(act); act = [] }
    else act.push(t)
  }
  if (act.length) out.push(act)
  return out
}

class Lector {
  i = 0
  constructor(private toks: Tok[]) {}
  get fin() { return this.i >= this.toks.length }
  get linea() { return (this.toks[this.i] ?? this.toks[this.toks.length - 1])?.linea ?? 0 }
  ver(k = 0) { return this.toks[this.i + k] }
  es(v: string) { const t = this.ver(); return !!t && (t.t === 'id' || t.t === 'p') && t.v === v }
  tomar(v: string) {
    if (!this.es(v)) throw new Error(`Línea ${this.linea}: se esperaba “${v}”${this.ver() ? ` y vino “${this.ver().v}”` : ''}.`)
    this.i++
  }
  id(): string {
    const t = this.ver()
    if (!t || t.t !== 'id') throw new Error(`Línea ${this.linea}: se esperaba un nombre de tabla o columna.`)
    this.i++
    return t.v
  }
  lista(): string[] {
    this.tomar('(')
    const out = [this.id()]
    while (this.es(',')) { this.i++; out.push(this.id()) }
    this.tomar(')')
    return out
  }
}

function valor(l: Lector): Valor {
  const t = l.ver()
  if (!t) throw new Error(`Línea ${l.linea}: falta un valor.`)
  let v: Valor
  if (t.t === 'str') { v = t.v; l.i++ }
  else if (t.t === 'num') { v = Number(t.v); l.i++ }
  else if (t.t === 'id' && ['null', 'true', 'false'].includes(t.v)) { v = t.v === 'null' ? null : t.v === 'true'; l.i++ }
  else throw new Error(`Línea ${t.linea}: valor no admitido “${t.v}” (solo textos, números, null, true/false).`)
  // casteos: 'texto'::jsonb, '2026-10-16'::date …
  while (l.es('::')) {
    l.i++
    const tipo = l.id()
    if ((tipo === 'jsonb' || tipo === 'json') && typeof v === 'string') {
      try { v = JSON.parse(v) as Valor } catch { throw new Error(`Línea ${t.linea}: el JSON no es válido.`) }
    }
  }
  return v
}

function leerInsert(l: Lector): Sentencia {
  const linea = l.linea
  l.tomar('insert'); l.tomar('into')
  let nombre = l.id()
  if (l.es('.')) { l.i++; if (nombre !== 'public') throw new Error(`Línea ${linea}: solo se admite el esquema public.`); nombre = l.id() }
  const tabla = TABLAS[nombre]
  if (!tabla) throw new Error(`Línea ${linea}: la tabla “${nombre}” no se puede importar (solo ${Object.keys(TABLAS).join(', ')}).`)
  const columnas = l.lista()
  const raras = columnas.filter((c) => !COLUMNAS[tabla].includes(c))
  if (raras.length) throw new Error(`Línea ${linea}: ${nombre} no tiene la(s) columna(s) ${raras.join(', ')}.`)
  if (new Set(columnas).size !== columnas.length) throw new Error(`Línea ${linea}: hay columnas repetidas.`)
  const faltan = CLAVE[tabla].filter((c) => !columnas.includes(c))
  if (faltan.length) throw new Error(`Línea ${linea}: falta la columna ${faltan.join(', ')} en ${nombre}.`)

  l.tomar('values')
  const filas: Fila[] = []
  do {
    if (filas.length) l.tomar(',')
    l.tomar('(')
    const vals = [valor(l)]
    while (l.es(',')) { l.i++; vals.push(valor(l)) }
    l.tomar(')')
    if (vals.length !== columnas.length) throw new Error(`Línea ${l.linea}: una fila tiene ${vals.length} valores y la tabla ${columnas.length} columnas.`)
    filas.push(Object.fromEntries(columnas.map((c, i) => [c, vals[i]])))
  } while (l.es(','))

  let conflicto: Sentencia['conflicto'] = null
  if (l.es('on')) {
    l.i++; l.tomar('conflict')
    const cols = l.lista()
    if (cols.join(',') !== CLAVE[tabla].join(',')) throw new Error(`Línea ${linea}: en ${nombre} el ON CONFLICT tiene que ser (${CLAVE[tabla].join(',')}).`)
    l.tomar('do')
    if (l.es('nothing')) { l.i++; conflicto = { accion: 'nada', set: [] } }
    else {
      l.tomar('update'); l.tomar('set')
      const set: string[] = []
      do {
        if (set.length) l.tomar(',')
        const col = l.id()
        l.tomar('='); l.tomar('excluded'); l.tomar('.')
        if (l.id() !== col) throw new Error(`Línea ${linea}: en el SET solo se admite columna = excluded.columna.`)
        if (!columnas.includes(col)) throw new Error(`Línea ${linea}: el SET actualiza ${col}, que no está en el INSERT.`)
        set.push(col)
      } while (l.es(','))
      conflicto = { accion: 'actualizar', set }
    }
  }
  if (!l.fin) throw new Error(`Línea ${l.linea}: no se entiende “${l.ver().v}” al final de la sentencia.`)
  return { tabla, columnas, filas, conflicto, linea }
}

/** Lee el archivo. Si hay algo que no sea un INSERT permitido (o un SELECT de control), no importa nada */
export function parsearSql(texto: string): ArchivoSql {
  const sentencias: Sentencia[] = []
  let ignoradas = 0
  for (const toks of sentenciasDe(tokenizar(texto))) {
    const primera = toks[0].v
    // SELECT de control, BEGIN/COMMIT: no hacen falta (la app muestra el resumen)
    if (['select', 'begin', 'commit', 'start', 'end'].includes(primera)) { ignoradas++; continue }
    if (primera !== 'insert') throw new Error(`Línea ${toks[0].linea}: solo se pueden importar INSERT (vino “${primera.toUpperCase()}”). No se importó nada.`)
    sentencias.push(leerInsert(new Lector(toks)))
  }
  if (!sentencias.length) throw new Error('El archivo no tiene ningún INSERT de torneos.')
  return { sentencias, ignoradas }
}

// ------------------------------------------------------------------ análisis (vista previa)

export interface TorneoArchivo {
  id: string
  nombre: string
  categoria: string
  fechaInicio: string
  fechaFin: string
  parejas: number
  partidos: number
  /** ya está en la base */
  existente: ResumenTorneo | null
  avisos: string[]
}
export interface Analisis { torneos: TorneoArchivo[]; errores: string[]; avisos: string[] }

const filasDe = (a: ArchivoSql, t: TablaImport) => a.sentencias.filter((s) => s.tabla === t).flatMap((s) => s.filas)

/** Revisa el archivo contra la lógica de la app (zonas, cuadro, claves de partidos) y contra lo que ya hay en la base */
export function analizar(a: ArchivoSql, actuales: ResumenTorneo[]): Analisis {
  const errores: string[] = []
  const avisos: string[] = []
  const enBase = new Map(actuales.map((t) => [t.id, t]))
  const torneos = filasDe(a, 'torneos') as unknown as FilaTorneo[]
  const parejas = filasDe(a, 'parejas') as unknown as FilaPareja[]
  const instancias = filasDe(a, 'instancias') as unknown as FilaInstancia[]
  const partidos = (filasDe(a, 'partidos') as unknown as FilaPartido[]).map((p) => ({ ...p, hora: p.hora ? String(p.hora).slice(0, 5) : p.hora }))
  const idsArchivo = new Set(torneos.map((t) => String(t.id)))

  for (const t of torneos) {
    if (!esUuid(String(t.id))) errores.push(`El torneo “${t.nombre}” no tiene un id válido (${t.id}).`)
    if (t.categoria != null && !esCategoriaTorneo(t.categoria)) errores.push(`“${t.nombre}”: la categoría tiene que ser Damas, Caballeros o Mixto (vino “${t.categoria}”).`)
  }
  if (idsArchivo.size !== torneos.length) errores.push('Hay torneos repetidos (mismo id) en el archivo.')
  // parejas, formatos y partidos tienen que ser de un torneo del archivo o de uno que ya esté en la base
  const huerfanos = new Set([...parejas, ...instancias, ...partidos].map((x) => String(x.torneo_id)).filter((id) => !idsArchivo.has(id) && !enBase.has(id)))
  if (huerfanos.size) errores.push(`Hay datos de ${huerfanos.size} torneo(s) que no están ni en el archivo ni en la base (${[...huerfanos].join(', ')}).`)
  for (const p of parejas) if (!esUuid(String(p.id))) errores.push(`La pareja ${p.jugador1} / ${p.jugador2} no tiene un id válido.`)
  for (const s of a.sentencias) {
    if (!s.conflicto) avisos.push(`Línea ${s.linea}: INSERT en ${NOMBRE_TABLA[s.tabla]} sin ON CONFLICT: si se importa dos veces, falla.`)
  }

  const lista: TorneoArchivo[] = torneos.map((t) => {
    const id = String(t.id)
    const ps = parejas.filter((p) => p.torneo_id === id)
    const pts = partidos.filter((p) => p.torneo_id === id)
    const av: string[] = []
    // se arma el torneo como lo vería la app y se controla
    let c: Categoria | null = null
    try {
      c = desdeFilas(
        { ...t, id, nombre: t.nombre ?? '', categoria: (t.categoria ?? 'Damas') as CategoriaTorneo, premio: t.premio ?? '', observacion: t.observacion ?? '',
          cant_zonas: Number(t.cant_zonas ?? 0), desempates: t.desempates ?? {}, cuadro: t.cuadro ?? null, publicado: false, estado: 'pendiente', campeon: null },
        ps, instancias.filter((i) => i.torneo_id === id), pts)
    } catch (e) { av.push(`No se pudo armar el torneo: ${e instanceof Error ? e.message : e}`) }
    if (c) {
      if (ps.length < MIN_PAREJAS || ps.length > MAX_PAREJAS) av.push(`${ps.length} parejas (la app admite de ${MIN_PAREJAS} a ${MAX_PAREJAS}).`)
      const sinZona = ps.filter((p) => p.zona == null)
      if (sinZona.length) av.push(`${sinZona.length} pareja(s) sin zona.`)
      c.zonas.forEach((z, zi) => { if (z.length !== 3 && z.length !== 4) av.push(`La Zona ${LETRAS[zi]} tiene ${z.length} parejas (tienen que ser 3 o 4).`) })
      const posRep = new Set<string>()
      for (const p of ps) {
        if (p.zona == null) continue
        const k = `${p.zona}:${p.posicion}`
        if (posRep.has(k)) av.push(`Dos parejas en la misma posición (${p.posicion}°) de la Zona ${LETRAS[p.zona]}.`)
        posRep.add(k)
      }
      if (Number(t.cant_zonas ?? 0) !== c.zonas.length) av.push(`cant_zonas dice ${t.cant_zonas} y las parejas están en ${c.zonas.length} zonas.`)
      // claves de partidos que existen en el torneo
      const zonaOk = new Set(c.zonas.flatMap((z, zi) => partidosDeZona(z, zi, () => '').map((p) => `Z${p.key}`)))
      const errCuadro = c.cuadro ? erroresCuadro(c.cuadro, c.zonas) : []
      if (errCuadro.length) av.push(`Cuadro del playoff: ${errCuadro.join(' ')}`)
      const playoff = c.cuadro && !errCuadro.length ? rondasPlayoff(c.cuadro).flat() : []
      const playoffOk = new Set(playoff.filter((p) => !p.bye).map((p) => `P${p.key}`))
      const byes = new Set(playoff.filter((p) => p.bye).map((p) => `P${p.key}`))
      for (const m of pts) {
        if (zonaOk.has(m.clave) || playoffOk.has(m.clave)) continue
        av.push(byes.has(m.clave) ? `${m.clave} es un pase directo (libre): no se juega, no hace falta horario.` : `El partido ${m.clave} no existe en este torneo.`)
      }
      for (const m of pts) {
        if (m.clave[0] !== 'P' || !playoffOk.has(m.clave) || !c.cuadro) continue
        const esperada = instanciaDeRonda(c.cuadro.length, Number(m.clave.slice(1).split('-')[0]))
        if (m.instancia && m.instancia !== esperada) av.push(`${m.clave} figura como ${m.instancia} y en el cuadro es ${esperada}.`)
      }
      const conHorario = new Set(pts.filter((m) => m.fecha && m.hora).map((m) => m.clave))
      const sinHorario = [...zonaOk, ...playoffOk].filter((k) => !conHorario.has(k))
      if (sinHorario.length) av.push(`${sinHorario.length} partido(s) sin día u hora (${sinHorario.join(', ')}).`)
      const fuera = pts.filter((m) => m.fecha && ((t.fecha_inicio && m.fecha < t.fecha_inicio) || (t.fecha_fin && m.fecha > t.fecha_fin)))
      if (fuera.length) av.push(`${fuera.length} partido(s) fuera de las fechas del torneo.`)
      const unaPalabra = ps.flatMap((p) => [p.jugador1, p.jugador2]).filter((j) => String(j ?? '').trim().split(/\s+/).length < 2)
      if (unaPalabra.length) av.push(`Jugador(es) con un solo nombre: ${unaPalabra.join(', ')} (se dan de alta así en el padrón).`)
    }
    return {
      id, nombre: String(t.nombre ?? ''), categoria: String(t.categoria ?? ''), fechaInicio: String(t.fecha_inicio ?? ''), fechaFin: String(t.fecha_fin ?? ''),
      parejas: ps.length, partidos: pts.length, existente: enBase.get(id) ?? null, avisos: av,
    }
  })
  return { torneos: lista, errores, avisos }
}

// ------------------------------------------------------------------ importación

export interface ResultadoImport {
  torneosNuevos: number
  torneosActualizados: number
  torneosOmitidos: number
  parejasNuevas: number
  parejasActualizadas: number
  partidosNuevos: number
  partidosActualizados: number
  jugadoresNuevos: number
}

const chequear = (r: { error: { message: string } | null }, que: string) => { if (r.error) throw new Error(`Al cargar ${que}: ${r.error.message}`) }
const torneoDe = (tabla: TablaImport, f: Fila) => String(tabla === 'torneos' ? f.id : f.torneo_id ?? '')

async function contarJugadores(): Promise<number> {
  const r = await supabase.from(T.jugadores).select('id', { count: 'exact', head: true })
  return r.count ?? 0
}

/**
 * Carga el archivo en la base.
 * · `actualizarExistentes = false`: los torneos que ya están en la base se saltean enteros (con sus parejas y partidos).
 * · `true`: se actualizan como diga el ON CONFLICT del archivo (nunca se tocan resultados ni la publicación).
 * No es una transacción: si algo falla a mitad de camino, se corrige y se vuelve a importar (no duplica).
 */
export async function importarSql(a: ArchivoSql, analisis: Analisis, actualizarExistentes: boolean): Promise<ResultadoImport> {
  await vaciar()
  const omitir = new Set(analisis.torneos.filter((t) => t.existente && !actualizarExistentes).map((t) => t.id))
  const incluir = (s: Sentencia, f: Fila) => s.tabla === 'jugadores' || !omitir.has(torneoDe(s.tabla, f))
  const ids = analisis.torneos.map((t) => t.id).filter((id) => !omitir.has(id))

  // lo que ya estaba (para el resumen)
  const previas = ids.length ? await supabase.from(T.parejas).select('id').in('torneo_id', ids) : { data: [], error: null }
  chequear(previas, 'parejas')
  const previos = ids.length ? await supabase.from(T.partidos).select('torneo_id, clave').in('torneo_id', ids) : { data: [], error: null }
  chequear(previos, 'partidos')
  const yaParejas = new Set(((previas.data ?? []) as { id: string }[]).map((p) => p.id))
  const yaPartidos = new Set(((previos.data ?? []) as { torneo_id: string; clave: string }[]).map((p) => `${p.torneo_id}|${p.clave}`))
  const jugadoresAntes = await contarJugadores()

  const tabla = { torneos: T.torneos, jugadores: T.jugadores, instancias: T.instancias, parejas: T.parejas, partidos: T.partidos } as const
  const ordenadas = [...a.sentencias].sort((x, y) => ORDEN.indexOf(x.tabla) - ORDEN.indexOf(y.tabla))
  let parejasNuevas = 0, parejasActualizadas = 0, partidosNuevos = 0, partidosActualizados = 0
  for (const s of ordenadas) {
    const filas = s.filas.filter((f) => incluir(s, f))
      // horas como texto "HH:MM" (la columna es time)
      .map((f) => (s.tabla === 'partidos' && typeof f.hora === 'number' ? { ...f, hora: String(f.hora) } : f))
    if (s.tabla === 'parejas') for (const f of filas) yaParejas.has(String(f.id)) ? parejasActualizadas++ : parejasNuevas++
    if (s.tabla === 'partidos') for (const f of filas) yaPartidos.has(`${f.torneo_id}|${f.clave}`) ? partidosActualizados++ : partidosNuevos++
    for (let i = 0; i < filas.length; i += 500) {
      const lote = filas.slice(i, i + 500)
      const q = supabase.from(tabla[s.tabla])
      const r = !s.conflicto
        ? await q.insert(lote)
        // DO UPDATE: PostgREST actualiza las columnas que se mandan (las del INSERT); DO NOTHING: ignora las que ya existen
        : await q.upsert(lote, { onConflict: CLAVE[s.tabla].join(','), ignoreDuplicates: s.conflicto.accion === 'nada' })
      chequear(r, NOMBRE_TABLA[s.tabla])
    }
  }
  const jugadoresNuevos = Math.max(0, (await contarJugadores()) - jugadoresAntes)
  const nuevos = analisis.torneos.filter((t) => !t.existente).length
  return {
    torneosNuevos: nuevos,
    torneosActualizados: analisis.torneos.filter((t) => t.existente && actualizarExistentes).length,
    torneosOmitidos: omitir.size,
    parejasNuevas, parejasActualizadas, partidosNuevos, partidosActualizados, jugadoresNuevos,
  }
}
