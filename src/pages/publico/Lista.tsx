import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronRight, Search, Ticket, Trophy, Users } from 'lucide-react'
import { listarPublicos, normalizarTexto, type ResumenPublico } from '../../lib/publico'
import { CATEGORIAS, ESTADOS, MESES, formatoPesos, nombreEstado, rangoFechas, type CategoriaTorneo, type EstadoTorneo } from '../../lib/torneo'
import { Alerta, Badge, Input, Select, Spinner, Tabs, Vacio } from '../../components/ui'
import Calendario from './Calendario'
import Estadisticas from '../../components/Estadisticas'
import { BadgeCategoria, bordeCategoria } from '../../components/Categoria'

/** En curso primero, después los que vienen, los terminados y los cancelados */
const ORDEN: Record<EstadoTorneo, number> = { en_curso: 0, pendiente: 1, finalizado: 2, cancelado: 3 }

export const tonoEstado = (e: EstadoTorneo) => (e === 'en_curso' ? 'verde' : e === 'finalizado' ? 'azul' : e === 'cancelado' ? 'rojo' : 'ambar') as 'verde' | 'azul' | 'rojo' | 'ambar'

type PestanaInicio = 'torneos' | 'calendario'
/** pestaña de la página inicial según el link (#/ = Torneos · #/calendario = Calendario) */
const pestanaDelLink = (): PestanaInicio => (window.location.hash.startsWith('#/calendario') ? 'calendario' : 'torneos')

/** Página inicial para jugadores: pestañas Torneos (por defecto) y Calendario */
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
    history.replaceState(null, '', p === 'calendario' ? '#/calendario' : '#/')
  }
  return (
    <>
      <div className="mb-5">
        <Tabs<PestanaInicio> opciones={[{ id: 'torneos', label: 'Torneos' }, { id: 'calendario', label: 'Calendario' }]} valor={pestana} onChange={cambiar} />
      </div>
      {pestana === 'calendario' ? (
        <>
          <header className="mb-3"><h1 className="font-display text-4xl font-bold leading-none text-noche">Calendario</h1></header>
          <Calendario />
        </>
      ) : <Torneos />}
    </>
  )
}

/** Torneos publicados con filtros */
function Torneos() {
  const [lista, setLista] = useState<ResumenPublico[] | null>(null)
  const [error, setError] = useState('')
  const [categoria, setCategoria] = useState<'' | CategoriaTorneo>('')
  const [estado, setEstado] = useState<'' | EstadoTorneo>('')
  const [anio, setAnio] = useState('')
  const [mes, setMes] = useState('')
  const [texto, setTexto] = useState('')

  useEffect(() => {
    listarPublicos().then(setLista).catch((e) => { setError(e instanceof Error ? e.message : 'No se pudieron cargar los torneos.'); setLista([]) })
  }, [])

  const anios = useMemo(() => [...new Set((lista ?? []).map((t) => t.fecha_inicio?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(), [lista])

  const visibles = useMemo(() => {
    const q = normalizarTexto(texto)
    return (lista ?? [])
      .filter((t) => !categoria || t.categoria === categoria)
      .filter((t) => !estado || t.estado === estado)
      .filter((t) => !anio || t.fecha_inicio?.startsWith(anio))
      .filter((t) => !mes || t.fecha_inicio?.slice(5, 7) === mes)
      .filter((t) => !q || normalizarTexto(t.nombre).includes(q))
      .sort((a, b) => {
        if (ORDEN[a.estado] !== ORDEN[b.estado]) return ORDEN[a.estado] - ORDEN[b.estado]
        const fa = a.fecha_inicio ?? '', fb = b.fecha_inicio ?? ''
        // los que vienen, del más cercano al más lejano; el resto, del más reciente al más viejo
        return a.estado === 'pendiente' ? fa.localeCompare(fb) : fb.localeCompare(fa)
      })
  }, [lista, categoria, estado, anio, mes, texto])
  const hayFiltros = !!(texto || categoria || estado || anio || mes)
  // las estadísticas usan los mismos torneos que la lista (que ya son solo los publicados)
  const datos = useMemo(() => visibles.map((t) => ({ ...t, fechaInicio: t.fecha_inicio, fechaFin: t.fecha_fin, jugadores: t.jugadores ?? [] })), [visibles])

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Torneos</h1>
        <p className="mt-2 text-sm text-noche/70">Zonas, partidos, resultados y playoff de los torneos de NODO, actualizados a medida que se juegan.</p>
      </header>

      <div className="mb-5 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar torneo…" className="pl-9" aria-label="Buscar torneo" />
        </label>
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value as '' | CategoriaTorneo)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
        <Select value={estado} onChange={(e) => setEstado(e.target.value as '' | EstadoTorneo)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </Select>
        <Select value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año">
          <option value="">Año</option>
          {anios.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
          <option value="">Mes</option>
          {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
        </Select>
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {hayFiltros && !!lista?.length && <p className="-mt-2 mb-3 text-xs text-noche/55">{visibles.length} de {lista.length} torneos</p>}
      {!!visibles.length && <Estadisticas torneos={datos} filtrado={hayFiltros} publico enlace={(id) => `#/torneo/${id}`} />}
      {lista === null ? <Spinner texto="Cargando torneos…" /> : visibles.length === 0 ? (
        <Vacio titulo={lista.length ? 'No hay torneos con esos filtros' : 'Todavía no hay torneos publicados'}>
          {lista.length ? 'Probá cambiando el estado, el año o el mes.' : 'Cuando el club publique un torneo, lo vas a ver acá.'}
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibles.map((t) => (
            <li key={t.id}>
              <a href={`#/torneo/${t.id}`} className={`flex h-full items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-noche/10 transition hover:ring-cancha/40 ${bordeCategoria(t.categoria)}`}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap gap-1">
                    <BadgeCategoria categoria={t.categoria} />
                    <Badge tono={tonoEstado(t.estado)}>{nombreEstado(t.estado)}</Badge>
                  </div>
                  <p className="font-display text-2xl font-bold leading-tight text-noche">{t.nombre}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-noche/65">
                    {t.fecha_inicio && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{rangoFechas(t.fecha_inicio, t.fecha_fin ?? '')}</span>}
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{t.parejas} parejas</span>
                    {t.inscripcion ? <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" aria-hidden />{formatoPesos(String(t.inscripcion))}</span> : null}
                  </div>
                  {t.premio && <p className="text-sm text-noche/65">Premio: {t.premio}</p>}
                  {t.estado === 'finalizado' && t.campeon && (
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-noche"><Trophy className="h-4 w-4 text-cancha" aria-hidden /> {t.campeon}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-noche/30" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
