import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight, Info, Loader2, Medal, Search, Share2, Star, Trophy, Users, X } from 'lucide-react'
import { CATEGORIAS, nombrePropio, rangoFechas, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { nombreAlcance, type Alcance } from '../lib/resultados'
import { BadgeCategoria, ESTILO_CATEGORIA } from './Categoria'
import { Input } from './ui'
import { PUNTOS_PARTICIPACION, PUNTOS_VICTORIA, desglose, puntosTorneo, textoReglas, type Victorias } from '../lib/puntos'
import { INSTANCIAS } from '../lib/torneo'

/** Lo mínimo que necesitan las estadísticas de cada torneo (sirve para el panel y para la página pública) */
export interface DatoEstadistica {
  id?: string
  /** nombre del torneo (para el detalle de cada jugador) */
  nombre?: string
  fechaInicio?: string | null
  fechaFin?: string | null
  categoria: CategoriaTorneo
  estado: EstadoTorneo
  parejas: number
  /** jugadores inscriptos */
  jugadores: string[]
  /** parejas inscriptas [jugador1, jugador2, hasta dónde llegó, partidos ganados por instancia] (compañero, instancia y puntos); si no llegan, el detalle sale sin esos datos */
  duplas?: [string, string, (Alcance | null)?, Victorias?][]
  /** nombre de la pareja campeona ("Juan Pérez / Luis Gómez") */
  campeon: string | null
  /** solo en el panel de organizadores */
  publicado?: boolean
}

/** Un torneo en el historial de un jugador */
interface Participacion {
  id?: string; torneo: string; categoria: CategoriaTorneo; fechaInicio: string; fechaFin: string; estado: EstadoTorneo
  companero: string | null; campeon: boolean
  /** máxima instancia a la que llegó en ese torneo (null si no se sabe) */
  alcance: Alcance | null
  /** partidos ganados por instancia (null si no se sabe) y puntos que sumó en el torneo */
  victorias: Victorias | null
  puntos: number
}

/** `n`: títulos, torneos o puntos, según el ranking */
interface FilaRanking { clave: string; nombre: string; n: number; torneos: Participacion[] }

/** Cómo se muestra (y se comparte) el valor de cada ranking */
interface Medida {
  unidad: [string, string]
  /** encabezado de la columna en la imagen */
  columna: string
  /** dato secundario (en el ranking de puntos: torneos jugados) */
  extra?: { columna: string; texto: (f: FilaRanking) => string }
  /** ¿dos filas empatan el puesto? (por defecto, mismo `n`) */
  igual?: (a: FilaRanking, b: FilaRanking) => boolean
  /** detalle de puntos por torneo al tocar un jugador */
  puntos?: boolean
}

const POR_PAGINA = 10

/** "juan  PÉREZ" y "Juan Perez" cuentan como el mismo jugador */
const clave = (n: string) => normalizarTexto(n).replace(/\s+/g, ' ')

/** Agrupa por jugador; ordena por cantidad y después por nombre (se muestra el nombre como se escribió la primera vez) */
function ranking(items: { nombre: string; p: Participacion }[]): FilaRanking[] {
  const m = new Map<string, FilaRanking>()
  for (const { nombre, p } of items) {
    const k = clave(nombre)
    if (!k) continue
    const e = m.get(k) ?? { clave: k, nombre: nombrePropio(nombre), n: 0, torneos: [] }
    e.n++
    e.torneos.push(p)
    m.set(k, e)
  }
  return [...m.values()]
    .map((f) => ({ ...f, torneos: f.torneos.sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)) }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
}

/** Ranking de puntos: suma los puntos de cada torneo; orden: puntos, menos torneos jugados, nombre */
function rankingPuntos(items: { nombre: string; p: Participacion }[]): FilaRanking[] {
  const m = new Map<string, FilaRanking>()
  for (const { nombre, p } of items) {
    const k = clave(nombre)
    if (!k) continue
    const e = m.get(k) ?? { clave: k, nombre: nombrePropio(nombre), n: 0, torneos: [] }
    e.n += p.puntos
    e.torneos.push(p)
    m.set(k, e)
  }
  return [...m.values()]
    .map((f) => ({ ...f, torneos: f.torneos.sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)) }))
    .sort((a, b) => b.n - a.n || a.torneos.length - b.torneos.length || a.nombre.localeCompare(b.nombre))
}

const mismoN = (a: FilaRanking, b: FilaRanking) => a.n === b.n

/** Puesto con empates (1, 1, 3…) */
function puestos(filas: FilaRanking[], igual: (a: FilaRanking, b: FilaRanking) => boolean = mismoN): Map<string, number> {
  const out = new Map<string, number>()
  filas.forEach((f, i) => out.set(f.clave, i > 0 && igual(filas[i - 1], f) ? out.get(filas[i - 1].clave)! : i + 1))
  return out
}

const MEDIDAS = {
  campeones: { unidad: ['título', 'títulos'], columna: 'Títulos' },
  participaciones: { unidad: ['torneo', 'torneos'], columna: 'Torneos' },
  puntos: {
    unidad: ['pt', 'pts'], columna: 'Puntos', puntos: true,
    extra: { columna: 'Torneos', texto: (f) => `${f.torneos.length} ${f.torneos.length === 1 ? 'torneo' : 'torneos'}` },
    igual: (a, b) => a.n === b.n && a.torneos.length === b.torneos.length,
  },
} satisfies Record<string, Medida>

/** Comparte la imagen (menú nativo: WhatsApp…) o, si el navegador no deja, la descarga */
async function compartirImagen(blob: Blob, nombre: string, titulo: string) {
  const file = new File([blob], nombre, { type: 'image/png' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo })
      return
    } catch (e) {
      // canceló: no se hace nada. Si el navegador no dejó abrir el menú (por ejemplo, Safari tras generar la imagen), se descarga
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Estadísticas sobre los torneos que se le pasan (ya filtrados por la lista).
 * `publico`: versión para jugadores (sin datos de publicación: ahí solo llegan torneos publicados).
 * `enlace`: link a cada torneo desde el detalle de un jugador (solo en la página pública).
 */
export default function Estadisticas({ torneos: base, publico = false, enlace, filtros = [], conPuntos = false, conCompartir = false }: {
  torneos: DatoEstadistica[]; filtrado?: boolean; publico?: boolean; enlace?: (id: string) => string
  /** filtros de la lista aplicados, para la imagen ("Caballeros", "2026", "Octubre"…) */
  filtros?: string[]
  /** ranking de puntos */
  conPuntos?: boolean
  /** botón para compartir cada ranking como imagen */
  conCompartir?: boolean
}) {
  // filtro propio de las estadísticas, encima de los filtros de la lista (no cambia la lista)
  const [sel, setSel] = useState<'' | CategoriaTorneo>('')
  const [texto, setTexto] = useState('')
  const cuentas = useMemo(() => Object.fromEntries(CATEGORIAS.map((c) => [c, base.filter((t) => t.categoria === c).length])) as Record<CategoriaTorneo, number>, [base])
  // si la categoría elegida ya no tiene torneos (por ejemplo, cambió un filtro de la lista), vuelve a "Todas"
  const activa: '' | CategoriaTorneo = sel && cuentas[sel] ? sel : ''
  const torneos = useMemo(() => (activa ? base.filter((t) => t.categoria === activa) : base), [base, activa])
  const st = useMemo(() => {
    const activos = torneos.filter((t) => t.estado !== 'cancelado')
    const parejas = activos.reduce((s, t) => s + t.parejas, 0)
    const todos = activos.flatMap((t) => t.jugadores)
    const distintos = new Set(todos.map(clave).filter(Boolean)).size
    const finalizados = torneos.filter((t) => t.estado === 'finalizado')
    const datoTorneo = (t: DatoEstadistica) => ({ id: t.id, torneo: t.nombre ?? '', categoria: t.categoria, fechaInicio: t.fechaInicio ?? '', fechaFin: t.fechaFin ?? '', estado: t.estado })
    const campeonesDe = (t: DatoEstadistica) => (t.estado === 'finalizado' && t.campeon ? t.campeon.split(' / ').map((x) => x.trim()).filter(Boolean) : [])

    // cada campeón suma un título por jugador ("Juan Pérez / Luis Gómez" → 2 jugadores)
    const titulos = finalizados.flatMap((t) => {
      const cs = campeonesDe(t)
      return cs.map((nombre) => ({ nombre, p: { ...datoTorneo(t), companero: cs.find((x) => clave(x) !== clave(nombre)) ?? null, campeon: true, alcance: 'campeon' as Alcance, victorias: null, puntos: 0 } }))
    })

    // participaciones: un jugador cuenta una vez por torneo
    const participaciones = activos.flatMap((t) => {
      const ganadores = new Set(campeonesDe(t).map(clave))
      const vistos = new Map<string, { nombre: string; companero: string | null; alcance: Alcance | null; victorias: Victorias | null }>()
      const duplas = t.duplas?.length ? t.duplas : null
      if (duplas) {
        for (const [a, b, x, v] of duplas) {
          const g = v ?? null
          if (a?.trim() && !vistos.has(clave(a))) vistos.set(clave(a), { nombre: a, companero: b?.trim() ? nombrePropio(b) : null, alcance: x ?? null, victorias: g })
          if (b?.trim() && !vistos.has(clave(b))) vistos.set(clave(b), { nombre: b, companero: a?.trim() ? nombrePropio(a) : null, alcance: x ?? null, victorias: g })
        }
      } else {
        for (const j of t.jugadores) if (j.trim() && !vistos.has(clave(j))) vistos.set(clave(j), { nombre: j, companero: null, alcance: null, victorias: null })
      }
      return [...vistos.entries()].map(([k, v]) => ({
        nombre: v.nombre,
        p: { ...datoTorneo(t), companero: v.companero, campeon: ganadores.has(k), alcance: ganadores.has(k) ? 'campeon' as Alcance : v.alcance, victorias: v.victorias, puntos: puntosTorneo(v.victorias) },
      }))
    })

    return {
      total: torneos.length,
      porEstado: { en_curso: torneos.filter((t) => t.estado === 'en_curso').length, pendiente: torneos.filter((t) => t.estado === 'pendiente').length, finalizado: finalizados.length, cancelado: torneos.filter((t) => t.estado === 'cancelado').length },
      publicados: torneos.filter((t) => t.publicado).length,
      parejas,
      promedio: activos.length ? Math.round(parejas / activos.length) : 0,
      distintos,
      campeones: ranking(titulos.map((x) => ({ ...x, p: { ...x.p, companero: x.p.companero && nombrePropio(x.p.companero) } }))),
      participaciones: ranking(participaciones),
      puntos: rankingPuntos(participaciones),
    }
  }, [torneos])

  // filtros aplicados (los de la lista + la categoría y el buscador de las estadísticas), para la imagen
  const busqueda = texto.trim()
  const textoFiltros = [...filtros, ...(activa && !filtros.includes(activa) ? [activa] : []), ...(busqueda ? [`Jugador: “${busqueda}”`] : [])].join(' · ') || 'Todos los torneos'
  const compartir = conCompartir
    ? async (titulo: string, medida: Medida, filas: FilaRanking[], puesto: Map<string, number>) => {
      // se carga recién al compartir (no suma peso a la página)
      const { imagenRanking, MAX_FILAS_RANKING } = await import('../lib/imagenes')
      const blob = await imagenRanking({
        titulo, filtros: textoFiltros, columna: medida.columna, columnaExtra: medida.extra?.columna, total: filas.length,
        filas: filas.slice(0, MAX_FILAS_RANKING).map((f) => ({ puesto: puesto.get(f.clave) ?? 0, nombre: f.nombre, valor: `${f.n} ${f.n === 1 ? medida.unidad[0] : medida.unidad[1]}`, extra: medida.extra?.texto(f) })),
      })
      const archivo = `NODO - ${titulo} - ${textoFiltros}`.replace(/[\\/:*?"<>|“”]/g, '').replace(/\s+/g, ' ').trim()
      await compartirImagen(blob, `${archivo}.png`, titulo)
    }
    : undefined

  return (
    <details className="group mb-5 rounded-xl bg-white ring-1 ring-noche/10 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-display text-lg font-semibold text-noche">
        <BarChart3 className="h-5 w-5 text-cancha" aria-hidden /> Estadísticas{activa ? ` · ${activa}` : ''}
        <ChevronDown className="ml-auto h-5 w-5 text-noche/40 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 border-t border-noche/10 p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Categoría de las estadísticas">
          <span className="text-xs font-semibold uppercase tracking-wide text-noche/55">Categoría</span>
          {([{ id: '', label: 'Todas', n: base.length }, ...CATEGORIAS.map((c) => ({ id: c, label: c, n: cuentas[c] }))] as { id: '' | CategoriaTorneo; label: string; n: number }[]).map((o) => (
            <button key={o.id || 'todas'} onClick={() => setSel(o.id)} disabled={!o.n} aria-pressed={activa === o.id}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                activa === o.id ? (o.id ? ESTILO_CATEGORIA[o.id].activo : 'bg-noche text-white') : o.id ? `${ESTILO_CATEGORIA[o.id].etiqueta} hover:brightness-95` : 'bg-vidrio text-noche/75 hover:bg-cancha-suave'
              }`}>
              {o.label} <span className="num text-xs opacity-70">{o.n}</span>
            </button>
          ))}
        </div>
        <div className={`grid grid-cols-2 gap-3 ${publico ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          <Kpi titulo="Torneos" valor={st.total}
            detalle={[st.porEstado.en_curso && `${st.porEstado.en_curso} en curso`, st.porEstado.pendiente && `${st.porEstado.pendiente} pendientes`, st.porEstado.finalizado && `${st.porEstado.finalizado} finalizados`, st.porEstado.cancelado && `${st.porEstado.cancelado} cancelados`].filter(Boolean).join(' · ')} />
          <Kpi titulo="Parejas inscriptas" valor={st.parejas} detalle={`${st.promedio} por torneo en promedio`} />
          <Kpi titulo="Jugadores distintos" valor={st.distintos} detalle="Cada jugador cuenta una vez" />
          {!publico && <Kpi titulo="Publicados" valor={st.publicados} detalle={`${st.total - st.publicados} sin publicar`} />}
        </div>

        {/* buscador común a los dos rankings */}
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscá tu nombre o apellido en los rankings" className="pl-9 pr-9" aria-label="Buscar jugador en los rankings" />
          {texto && <button onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-noche/40"><X className="h-4 w-4" /></button>}
        </label>

        <div className={`grid items-start gap-3 md:grid-cols-2 ${conPuntos ? 'lg:grid-cols-3' : ''}`}>
          <Ranking titulo="Ranking de campeones" icono={<Trophy className="h-4 w-4 text-cancha" aria-hidden />} medida={MEDIDAS.campeones}
            filas={st.campeones} texto={texto} enlace={enlace} vacio="Todavía no hay torneos finalizados." onCompartir={compartir} />
          <Ranking titulo="Más participaciones" icono={<Users className="h-4 w-4 text-cancha" aria-hidden />} medida={MEDIDAS.participaciones}
            filas={st.participaciones} texto={texto} enlace={enlace} vacio="Todavía no hay parejas cargadas." onCompartir={compartir} />
          {conPuntos && (
            <Ranking titulo="Ranking pts" icono={<Star className="h-4 w-4 text-cancha" aria-hidden />} medida={MEDIDAS.puntos} ayuda={<AyudaPuntos />}
              filas={st.puntos} texto={texto} enlace={enlace} vacio="Todavía no hay parejas cargadas." onCompartir={compartir} />
          )}
        </div>
        <p className="text-[11px] text-noche/45">
          {publico
            ? 'Sobre los torneos publicados. Tocá un jugador para ver sus torneos. Los jugadores se identifican por nombre: si está escrito distinto en dos torneos, cuenta como dos. No incluye torneos cancelados (salvo en el total).'
            : 'Tocá un jugador para ver sus torneos. Los jugadores se identifican por nombre (sin importar mayúsculas ni acentos): si está escrito distinto en dos torneos, por ejemplo con un apodo, cuenta como dos. No incluye torneos cancelados (salvo en el total).'}
          {conPuntos && <> Ranking pts (por jugador): {textoReglas()} (el W.O. cuenta como ganado; pasar libre, no). A igual puntaje, primero el que jugó menos torneos.</>}
        </p>
      </div>
    </details>
  )
}

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: number; detalle?: string }) {
  return (
    <div className="rounded-lg bg-vidrio p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-noche/55">{titulo}</p>
      <p className="num font-display text-3xl font-bold leading-tight text-noche">{valor}</p>
      {detalle && <p className="text-[11px] text-noche/55">{detalle}</p>}
    </div>
  )
}

/** Ranking completo con buscador (de afuera), paginado de a 10, detalle de torneos al tocar un jugador y botón para compartirlo */
function Ranking({ titulo, icono, filas, medida, vacio, texto, enlace, onCompartir, ayuda }: {
  titulo: string; icono: ReactNode; ayuda?: ReactNode; filas: FilaRanking[]; medida: Medida; vacio: string; texto: string; enlace?: (id: string) => string
  onCompartir?: (titulo: string, medida: Medida, filas: FilaRanking[], puesto: Map<string, number>) => Promise<void>
}) {
  const [pagina, setPagina] = useState(0)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const puesto = useMemo(() => puestos(filas, medida.igual), [filas, medida])
  // todas las palabras tienen que aparecer, en cualquier orden ("grego massot" encuentra a "Massot Grego")
  const palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean)
  const visibles = palabras.length ? filas.filter((f) => palabras.every((p) => f.clave.includes(p))) : filas
  const paginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const actual = Math.min(pagina, paginas - 1)
  const deLaPagina = visibles.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA)

  // al buscar o cambiar los datos, vuelve a la primera página y cierra el detalle
  useEffect(() => { setPagina(0); setAbierto(null) }, [texto, filas])

  const ir = (p: number) => { setPagina(p); setAbierto(null) }
  const compartir = async () => {
    if (!onCompartir) return
    setGenerando(true)
    try { await onCompartir(titulo, medida, visibles, puesto) } catch (e) { alert(e instanceof Error ? e.message : 'No se pudo generar la imagen.') } finally { setGenerando(false) }
  }

  return (
    <div className="rounded-lg bg-vidrio p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-noche">
        {icono} {titulo}
        {ayuda && <InfoAyuda titulo={titulo}>{ayuda}</InfoAyuda>}
        {!!filas.length && <span className="num ml-auto text-xs font-normal text-noche/55">{palabras.length ? `${visibles.length} de ${filas.length}` : filas.length} {filas.length === 1 ? 'jugador' : 'jugadores'}</span>}
      </p>
      {filas.length === 0 ? <p className="text-xs text-noche/55">{vacio}</p> : visibles.length === 0 ? (
        <p className="text-xs text-noche/55">Ningún jugador coincide con “{texto.trim()}”.</p>
      ) : (
        <>
          <ol className="space-y-1">
            {deLaPagina.map((f) => {
              const pos = puesto.get(f.clave) ?? 0
              const abiertoAca = abierto === f.clave
              return (
                <li key={f.clave} className={`rounded-md ${abiertoAca ? 'bg-white ring-1 ring-noche/10' : ''}`}>
                  <button onClick={() => setAbierto(abiertoAca ? null : f.clave)} aria-expanded={abiertoAca}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cancha">
                    <span className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[11px] font-bold ${pos === 1 ? 'bg-pelota text-noche' : 'bg-white text-noche/60'}`}>
                      {pos === 1 ? <Medal className="h-3 w-3" aria-label="1°" /> : pos}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
                    {medida.extra && <span className="num shrink-0 text-[11px] text-noche/45">{medida.extra.texto(f)}</span>}
                    <span className="num shrink-0 text-xs font-semibold text-noche/70">{f.n} {f.n === 1 ? medida.unidad[0] : medida.unidad[1]}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-noche/35 transition-transform ${abiertoAca ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                  {abiertoAca && <Detalle torneos={f.torneos} enlace={enlace} puntos={medida.puntos} />}
                </li>
              )
            })}
          </ol>
          {paginas > 1 && (
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-noche/10 pt-2 text-xs text-noche/60">
              <button onClick={() => ir(actual - 1)} disabled={actual === 0} aria-label="Página anterior"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 font-semibold hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">
                <ChevronLeft className="h-4 w-4" aria-hidden /> Anterior
              </button>
              <span className="num">Página {actual + 1} de {paginas}</span>
              <button onClick={() => ir(actual + 1)} disabled={actual >= paginas - 1} aria-label="Página siguiente"
                className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 font-semibold hover:bg-white disabled:cursor-not-allowed disabled:opacity-35">
                Siguiente <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </>
      )}
      {onCompartir && visibles.length > 0 && (
        <div className="mt-1 flex justify-end">
          <button onClick={compartir} disabled={generando} title="Compartir como imagen (con los filtros aplicados)" aria-label={`Compartir ${titulo} como imagen`}
            className="inline-flex items-center gap-1 rounded-md p-1.5 text-noche/55 hover:bg-white hover:text-cancha disabled:cursor-wait">
            {generando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}
    </div>
  )
}

/** Ícono (i) con una ayuda: se ve al pasar el mouse y se fija/cierra con un clic (en el celular, al tocar) */
function InfoAyuda({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [fijo, setFijo] = useState(false)
  const [hover, setHover] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  // se cierra al tocar afuera o con Escape
  useEffect(() => {
    if (!fijo) return
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setFijo(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFijo(false) }
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', esc) }
  }, [fijo])
  const visible = fijo || hover
  return (
    <span ref={ref} className="relative inline-flex" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button type="button" onClick={() => setFijo((x) => !x)} aria-expanded={visible} aria-label={`Cómo se calcula el ${titulo}`}
        className={`rounded-full p-0.5 transition-colors hover:text-cancha focus-visible:outline focus-visible:outline-2 focus-visible:outline-cancha ${visible ? 'text-cancha' : 'text-noche/40'}`}>
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {visible && (
        <span role="tooltip" className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg bg-noche p-3 text-xs font-normal leading-relaxed text-white shadow-lg sm:left-0 sm:translate-x-0">
          {children}
        </span>
      )}
    </span>
  )
}

/** Cómo se calculan los puntos del ranking (sale de lib/puntos.ts) */
function AyudaPuntos() {
  return (
    <>
      <span className="mb-1.5 block font-semibold text-pelota">Cómo se calculan los puntos</span>
      <span className="block">Son individuales: cada jugador suma, en cada torneo que juega:</span>
      <span className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
        <span>Por participar</span><strong className="num text-right">{PUNTOS_PARTICIPACION} pts</strong>
        {INSTANCIAS.map((i) => (
          <span key={i.id} className="contents">
            <span>Partido ganado en {i.id === 'zonas' ? 'zona' : i.nombre.toLowerCase()}</span>
            <strong className="num text-right">{PUNTOS_VICTORIA[i.id]} {PUNTOS_VICTORIA[i.id] === 1 ? 'pt' : 'pts'}</strong>
          </span>
        ))}
      </span>
      <span className="mt-1.5 block text-white/75">El W.O. cuenta como partido ganado; pasar libre, no. No suman los torneos cancelados.</span>
      <span className="mt-1 block text-white/75">Orden: más puntos; a igual puntaje, el que jugó menos torneos; después, por nombre.</span>
      <span className="mt-1 block text-white/75">Tocá un jugador para ver el detalle de cada torneo.</span>
    </>
  )
}

/** Torneos de un jugador: torneo, categoría, fecha, compañero y (en el ranking de puntos) el desglose */
function Detalle({ torneos, enlace, puntos = false }: { torneos: Participacion[]; enlace?: (id: string) => string; puntos?: boolean }) {
  return (
    <ul className="space-y-1.5 px-2 pb-2 pt-1">
      {torneos.map((t, i) => {
        const nombre = t.torneo || 'Torneo'
        return (
          <li key={`${t.id ?? i}-${i}`} className="rounded-md bg-vidrio/70 px-2 py-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <BadgeCategoria categoria={t.categoria} />
              {enlace && t.id
                ? <a href={enlace(t.id)} className="font-semibold text-noche underline-offset-2 hover:underline">{nombre}</a>
                : <span className="font-semibold text-noche">{nombre}</span>}
              <Llego t={t} />
              {t.fechaInicio && <span className="ml-auto text-noche/55">{rangoFechas(t.fechaInicio, t.fechaFin)}</span>}
            </div>
            <p className="mt-0.5 text-noche/70">{t.categoria === 'Damas' ? 'Compañera' : t.categoria === 'Mixto' ? 'Compañero/a' : 'Compañero'}: <span className="font-medium text-noche">{t.companero ?? '—'}</span></p>
            {puntos && <Puntos t={t} />}
          </li>
        )
      })}
    </ul>
  )
}

/** Desglose de puntos de un torneo: Participación 5 · Zona 2×1 · Cuartos 1×4 … = total */
function Puntos({ t }: { t: Participacion }) {
  const lineas = desglose(t.victorias)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-noche/10 pt-1">
      {lineas.map((l) => (
        <span key={l.concepto} className="num rounded bg-white px-1.5 py-0.5 text-noche/75 ring-1 ring-noche/10"
          title={l.cantidad > 1 || l.concepto !== 'Participación' ? `${l.cantidad} ganado${l.cantidad === 1 ? '' : 's'} × ${l.unitario} pts` : undefined}>
          {l.concepto}{l.concepto !== 'Participación' && <span className="text-noche/45"> {l.cantidad}×{l.unitario}</span>} <strong className="text-noche">{l.puntos}</strong>
        </span>
      ))}
      <span className="num ml-auto font-bold text-cancha">{t.puntos} pts</span>
    </div>
  )
}

/** Hasta dónde llegó: Campeón con trofeo; el resto, la instancia (en torneos sin terminar, "por ahora") */
function Llego({ t }: { t: Participacion }) {
  if (t.campeon || t.alcance === 'campeon') return <span className="inline-flex items-center gap-0.5 font-semibold text-cancha"><Trophy className="h-3.5 w-3.5" aria-hidden /> Campeón</span>
  if (!t.alcance) return null
  const enJuego = t.estado !== 'finalizado'
  return (
    <span className={`rounded px-1.5 py-0.5 font-semibold ${t.alcance === 'final' ? 'bg-pelota/60 text-noche' : 'bg-white text-noche/75 ring-1 ring-noche/10'}`}
      title={enJuego ? 'El torneo todavía se está jugando' : undefined}>
      {nombreAlcance(t.alcance)}{enJuego && <span className="font-normal text-noche/50"> (en juego)</span>}
    </span>
  )
}
