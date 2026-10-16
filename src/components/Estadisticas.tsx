import { useMemo, useState, type ReactNode } from 'react'
import { BarChart3, ChevronDown, Medal, Trophy, Users } from 'lucide-react'
import { CATEGORIAS, nombrePropio, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { ESTILO_CATEGORIA } from './Categoria'

/** Lo mínimo que necesitan las estadísticas de cada torneo (sirve para el panel y para la página pública) */
export interface DatoEstadistica {
  categoria: CategoriaTorneo
  estado: EstadoTorneo
  parejas: number
  /** jugadores inscriptos */
  jugadores: string[]
  /** nombre de la pareja campeona ("Juan Pérez / Luis Gómez") */
  campeon: string | null
  /** solo en el panel de organizadores */
  publicado?: boolean
}

/** "juan  PÉREZ" y "Juan Perez" cuentan como el mismo jugador */
const clave = (n: string) => normalizarTexto(n).replace(/\s+/g, ' ')

/** Ranking de jugadores: cuántas veces aparece cada uno (se muestra el nombre como se escribió la primera vez) */
function ranking(nombres: string[], top = 5) {
  const m = new Map<string, { nombre: string; n: number }>()
  for (const x of nombres) {
    const k = clave(x)
    if (!k) continue
    const e = m.get(k) ?? { nombre: nombrePropio(x), n: 0 }
    e.n++
    m.set(k, e)
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre)).slice(0, top)
}

/**
 * Estadísticas sobre los torneos que se le pasan (ya filtrados por la lista).
 * `publico`: versión para jugadores (sin datos de publicación: ahí solo llegan torneos publicados).
 */
export default function Estadisticas({ torneos: base, filtrado, publico = false }: { torneos: DatoEstadistica[]; filtrado: boolean; publico?: boolean }) {
  // filtro propio de las estadísticas, encima de los filtros de la lista (no cambia la lista)
  const [sel, setSel] = useState<'' | CategoriaTorneo>('')
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
    // cada campeón suma un título por jugador ("Juan Pérez / Luis Gómez" → 2 jugadores)
    const campeones = finalizados.flatMap((t) => (t.campeon ? t.campeon.split(' / ') : []))
    // participaciones: un jugador cuenta una vez por torneo
    const participaciones = activos.flatMap((t) => [...new Map(t.jugadores.map((j) => [clave(j), j])).values()])
    return {
      total: torneos.length,
      porEstado: { en_curso: torneos.filter((t) => t.estado === 'en_curso').length, pendiente: torneos.filter((t) => t.estado === 'pendiente').length, finalizado: finalizados.length, cancelado: torneos.filter((t) => t.estado === 'cancelado').length },
      publicados: torneos.filter((t) => t.publicado).length,
      parejas,
      promedio: activos.length ? Math.round(parejas / activos.length) : 0,
      distintos,
      campeones: ranking(campeones),
      participaciones: ranking(participaciones),
    }
  }, [torneos])

  return (
    <details className="group mb-5 rounded-xl bg-white ring-1 ring-noche/10 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-display text-lg font-semibold text-noche">
        <BarChart3 className="h-5 w-5 text-cancha" aria-hidden /> Estadísticas{activa ? ` · ${activa}` : ''}{filtrado ? ' (de los torneos filtrados)' : ''}
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
        <div className="grid gap-3 md:grid-cols-2">
          <Ranking titulo="Ranking de campeones" icono={<Trophy className="h-4 w-4 text-cancha" aria-hidden />} unidad={['título', 'títulos']}
            filas={st.campeones} vacio="Todavía no hay torneos finalizados." />
          <Ranking titulo="Más participaciones" icono={<Users className="h-4 w-4 text-cancha" aria-hidden />} unidad={['torneo', 'torneos']}
            filas={st.participaciones} vacio="Todavía no hay parejas cargadas." />
        </div>
        <p className="text-[11px] text-noche/45">
          {publico
            ? 'Sobre los torneos publicados. Los jugadores se identifican por nombre: si está escrito distinto en dos torneos, cuenta como dos. No incluye torneos cancelados (salvo en el total).'
            : 'Los jugadores se identifican por nombre (sin importar mayúsculas ni acentos): si está escrito distinto en dos torneos, por ejemplo con un apodo, cuenta como dos. No incluye torneos cancelados (salvo en el total).'}
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

function Ranking({ titulo, icono, filas, unidad, vacio }: { titulo: string; icono: ReactNode; filas: { nombre: string; n: number }[]; unidad: [string, string]; vacio: string }) {
  return (
    <div className="rounded-lg bg-vidrio p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-noche">{icono} {titulo}</p>
      {filas.length === 0 ? <p className="text-xs text-noche/55">{vacio}</p> : (
        <ol className="space-y-1">
          {filas.map((f, i) => (
            <li key={f.nombre} className="flex items-center gap-2 text-sm">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i === 0 ? 'bg-pelota text-noche' : 'bg-white text-noche/60'}`}>
                {i === 0 ? <Medal className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
              <span className="num text-xs font-semibold text-noche/70">{f.n} {f.n === 1 ? unidad[0] : unidad[1]}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
