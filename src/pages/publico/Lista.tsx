import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, MessageCircle, Search, Ticket, Trophy, Users } from 'lucide-react'
import { MOSTRAR_CATEGORIAS_PUBLICAS, categoriasPublicas, listarPublicos, normalizarTexto, type ResumenPublico } from '../../lib/publico'
import { CATEGORIAS, ESTADOS, MESES, compararCercania, formatoPesos, nombreEstado, rangoFechas, type CategoriaTorneo, type EstadoTorneo } from '../../lib/torneo'
import { Alerta, Badge, Input, MultiSelect, Spinner, Tabs, Vacio } from '../../components/ui'
import Calendario from './Calendario'
import CategoriasPublicas from './Categorias'
import AscensosPublicos from './Ascensos'
import PanelEstadisticas from '../../components/PanelEstadisticas'
import type { DatoEstadistica } from '../../components/Estadisticas'
import { BadgeCategoria, bordeCategoria } from '../../components/Categoria'
import { GruposEstado } from '../../components/GruposEstado'

export const tonoEstado = (e: EstadoTorneo) => (e === 'en_curso' ? 'verde' : e === 'finalizado' ? 'azul' : e === 'cancelado' ? 'rojo' : 'ambar') as 'verde' | 'azul' | 'rojo' | 'ambar'

type PestanaInicio = 'torneos' | 'calendario' | 'estadisticas' | 'categorias' | 'ascensos'
const LINKS: Record<PestanaInicio, string> = { torneos: '#/', calendario: '#/calendario', estadisticas: '#/estadisticas', categorias: '#/categorias', ascensos: '#/ascensos' }
/** pestaña de la página inicial según el link (#/ · #/calendario · #/estadisticas · #/categorias · #/ascensos) */
const pestanaDelLink = (): PestanaInicio => {
  const h = window.location.hash
  return h.startsWith('#/calendario') ? 'calendario' : h.startsWith('#/estadisticas') ? 'estadisticas' : h.startsWith('#/categorias') && MOSTRAR_CATEGORIAS_PUBLICAS ? 'categorias' : h.startsWith('#/ascensos') ? 'ascensos' : 'torneos'
}

/** Torneos publicados con los datos que usan las estadísticas (sin los publicados "solo info": todavía no tienen parejas a la vista) */
const cargarEstadisticas = async (): Promise<DatoEstadistica[]> =>
  (await listarPublicos()).filter((t) => !t.solo_info).map((t) => ({ ...t, fechaInicio: t.fecha_inicio, fechaFin: t.fecha_fin, jugadores: t.jugadores ?? [] }))
/** categorías ocultas: el filtro de Estadísticas no se muestra */
const sinCategorias = () => Promise.reject(new Error('Categorías ocultas'))
const enlaceTorneo = (id: string) => `#/torneo/${id}`

/** Página inicial para jugadores: pestañas Torneos (por defecto), Calendario, Estadísticas, Categorías y Ascensos */
export default function ListaPublica() {
  const [pestana, setPestana] = useState<PestanaInicio>(pestanaDelLink)
  useEffect(() => {
    const f = () => setPestana(pestanaDelLink())
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  // el link refleja la pestaña (para compartir el calendario y para volver a ella desde un torneo), sin agregar historial
  const cambiar = (p: PestanaInicio) => {
    setPestana(p)
    history.replaceState(null, '', LINKS[p])
  }
  return (
    <>
      <div className="mb-5">
        <Tabs<PestanaInicio> opciones={[{ id: 'torneos', label: 'Torneos' }, { id: 'calendario', label: 'Calendario' }, { id: 'estadisticas', label: 'Estadísticas' }, ...(MOSTRAR_CATEGORIAS_PUBLICAS ? [{ id: 'categorias' as const, label: 'Categorías' }] : []), { id: 'ascensos', label: 'Ascensos' }]} valor={pestana} onChange={cambiar} />
      </div>
      {pestana === 'calendario' ? (
        <>
          <header className="mb-3"><h1 className="font-display text-4xl font-bold leading-none text-noche">Calendario</h1></header>
          <Calendario />
        </>
      ) : pestana === 'categorias' ? <CategoriasPublicas /> : pestana === 'ascensos' ? <AscensosPublicos /> : pestana === 'estadisticas' ? <PanelEstadisticas cargar={cargarEstadisticas} cargarCategorias={MOSTRAR_CATEGORIAS_PUBLICAS ? categoriasPublicas : sinCategorias} enlace={enlaceTorneo} /> : <Torneos />}
    </>
  )
}

const ANIO_ACTUAL = String(new Date().getFullYear())

/** Torneos publicados con filtros */
function Torneos() {
  const [lista, setLista] = useState<ResumenPublico[] | null>(null)
  const [error, setError] = useState('')
  // filtros de selección múltiple: vacío = todos
  const [categoria, setCategoria] = useState<CategoriaTorneo[]>([])
  const [estado, setEstado] = useState<EstadoTorneo[]>([])
  // por defecto, el año en curso
  const [anio, setAnio] = useState<string[]>([ANIO_ACTUAL])
  const [mes, setMes] = useState<string[]>([])
  const [texto, setTexto] = useState('')

  useEffect(() => {
    listarPublicos().then(setLista).catch((e) => { setError(e instanceof Error ? e.message : 'No se pudieron cargar los torneos.'); setLista([]) })
  }, [])

  const anios = useMemo(() => [...new Set([ANIO_ACTUAL, ...((lista ?? []).map((t) => t.fecha_inicio?.slice(0, 4)).filter(Boolean) as string[])])].sort().reverse(), [lista])

  const visibles = useMemo(() => {
    const q = normalizarTexto(texto)
    return (lista ?? [])
      .filter((t) => !categoria.length || categoria.includes(t.categoria))
      .filter((t) => !estado.length || estado.includes(t.estado))
      .filter((t) => !anio.length || anio.includes(t.fecha_inicio?.slice(0, 4) ?? ''))
      .filter((t) => !mes.length || mes.includes(t.fecha_inicio?.slice(5, 7) ?? ''))
      .filter((t) => !q || normalizarTexto(t.nombre).includes(q))
      // los que vienen o se están jugando, del más cercano al más lejano; los terminados, del más reciente al más viejo
      .sort((a, b) => compararCercania({ inicio: a.fecha_inicio ?? '', estado: a.estado, nombre: a.nombre }, { inicio: b.fecha_inicio ?? '', estado: b.estado, nombre: b.nombre }))
  }, [lista, categoria, estado, anio, mes, texto])
  const hayFiltros = !!(texto || categoria.length || estado.length || anio.length || mes.length)

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Torneos</h1>
        <p className="mt-2 text-sm text-noche/70">Los próximos torneos de NODO con su inscripción, y las zonas, partidos, resultados y playoff, actualizados a medida que se juegan.</p>
      </header>

      <div className="mb-5 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar torneo…" className="pl-9" aria-label="Buscar torneo" />
        </label>
        <MultiSelect<CategoriaTorneo> valor={categoria} onChange={setCategoria} aria-label="Categoría" placeholder="Todas las categorías"
          opciones={CATEGORIAS.map((x) => ({ valor: x, label: x }))} plural={(n) => `${n} categorías`} />
        <MultiSelect<EstadoTorneo> valor={estado} onChange={setEstado} aria-label="Estado" placeholder="Todos los estados"
          opciones={ESTADOS.map((e) => ({ valor: e.id, label: e.nombre }))} plural={(n) => `${n} estados`} />
        <MultiSelect valor={anio} onChange={setAnio} aria-label="Año" placeholder="Año"
          opciones={anios.map((a) => ({ valor: a, label: a }))} plural={(n) => `${n} años`} />
        <MultiSelect valor={mes} onChange={setMes} aria-label="Mes" placeholder="Mes"
          opciones={MESES.map((m, i) => ({ valor: String(i + 1).padStart(2, '0'), label: m }))} plural={(n) => `${n} meses`} />
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {hayFiltros && !!lista?.length && <p className="-mt-2 mb-3 text-xs text-noche/55">{visibles.length} de {lista.length} torneos</p>}
      {lista === null ? <Spinner texto="Cargando torneos…" /> : visibles.length === 0 ? (
        <Vacio titulo={lista.length ? 'No hay torneos con esos filtros' : 'Todavía no hay torneos publicados'}>
          {lista.length ? <>Probá cambiando el estado, el año o el mes. <button className="font-semibold text-cancha" onClick={() => { setTexto(''); setCategoria([]); setEstado([]); setAnio([]); setMes([]) }}>Ver todos</button></> : 'Cuando el club publique un torneo, lo vas a ver acá.'}
        </Vacio>
      ) : (
        <GruposEstado items={visibles} estado={(t) => t.estado} clave={(t) => t.id} render={(t) => (
            <li>
              <a href={`#/torneo/${t.id}`} className={`flex h-full items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-noche/10 transition hover:ring-cancha/40 ${bordeCategoria(t.categoria)}`}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    <BadgeCategoria categoria={t.categoria} />
                    <Badge tono={tonoEstado(t.estado)}>{nombreEstado(t.estado)}</Badge>
                    {t.solo_info && t.estado === 'pendiente' && <Badge tono="pelota">Inscripción abierta</Badge>}
                  </div>
                  <p className="font-display text-2xl font-bold leading-tight text-noche">{t.nombre}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-noche/65">
                    {t.fecha_inicio && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{rangoFechas(t.fecha_inicio, t.fecha_fin ?? '')}</span>}
                    {!t.solo_info && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{t.parejas} parejas</span>}
                    {t.inscripcion ? <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" aria-hidden />{formatoPesos(String(t.inscripcion))}</span> : null}
                  </div>
                  {t.premio && <p className="text-sm text-noche/65">Premio: {t.premio}</p>}
                  {t.solo_info && t.estado === 'pendiente' && (
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#18914A]"><MessageCircle className="h-4 w-4" aria-hidden /> Inscripciones por WhatsApp · tocá para ver la info</p>
                  )}
                  {t.estado === 'finalizado' && t.campeon && (
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-noche"><Trophy className="h-4 w-4 text-cancha" aria-hidden /> {t.campeon}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-noche/30" aria-hidden />
              </a>
            </li>
          )} />
      )}
    </>
  )
}
