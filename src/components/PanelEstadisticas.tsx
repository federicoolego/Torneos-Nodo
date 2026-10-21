import { useEffect, useMemo, useState } from 'react'
import { CATEGORIAS, ESTADOS, MESES, nombreEstado, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { CATEGORIAS_JUGADOR, esCategoriaJugador, rama, type CategoriaJugador } from '../lib/categorias'
import Estadisticas, { clave, type DatoEstadistica } from './Estadisticas'
import { Alerta, Select, Spinner, Vacio } from './ui'

const ANIO_ACTUAL = String(new Date().getFullYear())

/** Jugador con su categoría actual (para el filtro "Categorías") */
export interface CategoriaDeJugador { nombre: string; categoria: string | null }

/**
 * Pestaña Estadísticas (página pública y admin): filtros de torneos + "Categorías"
 * (categoría actual del jugador: los rankings muestran solo a los jugadores de esa categoría).
 * `admin`: suma el filtro de publicación.
 */
export default function PanelEstadisticas({ cargar, cargarCategorias, admin = false, enlace }: {
  cargar: () => Promise<DatoEstadistica[]>
  /** si falla (por ejemplo, falta el SQL de categorías), el filtro no se muestra */
  cargarCategorias: () => Promise<CategoriaDeJugador[]>
  admin?: boolean
  enlace?: (id: string) => string
}) {
  const [lista, setLista] = useState<DatoEstadistica[] | null>(null)
  const [error, setError] = useState('')
  // categoría de cada jugador (clave del nombre → categoría); null = no disponible
  const [categorias, setCategorias] = useState<Map<string, CategoriaJugador> | null>(null)
  const [catJugador, setCatJugador] = useState<'' | CategoriaJugador>('')
  const [categoria, setCategoria] = useState<'' | CategoriaTorneo>('')
  const [estado, setEstado] = useState<'' | EstadoTorneo>('')
  // por defecto, el año en curso
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [mes, setMes] = useState('')
  const [publicacion, setPublicacion] = useState<'' | 'si' | 'no'>('')

  useEffect(() => {
    cargar().then(setLista).catch((e) => { setError(e instanceof Error ? e.message : 'No se pudieron cargar los torneos.'); setLista([]) })
  }, [cargar])
  useEffect(() => {
    cargarCategorias()
      .then((l) => setCategorias(new Map(l.filter((j) => esCategoriaJugador(j.categoria)).map((j) => [clave(j.nombre), j.categoria as CategoriaJugador]))))
      .catch(() => setCategorias(null))
  }, [cargarCategorias])

  // jugadores de la categoría elegida (para los rankings)
  const soloJugadores = useMemo(
    () => (catJugador && categorias ? new Set([...categorias].filter(([, c]) => c === catJugador).map(([k]) => k)) : null),
    [catJugador, categorias])
  const cuentaCategoria = useMemo(() => {
    const m = new Map<CategoriaJugador, number>()
    for (const c of categorias?.values() ?? []) m.set(c, (m.get(c) ?? 0) + 1)
    return m
  }, [categorias])

  const anios = useMemo(() => [...new Set([ANIO_ACTUAL, ...((lista ?? []).map((t) => t.fechaInicio?.slice(0, 4)).filter(Boolean) as string[])])].sort().reverse(), [lista])

  const visibles = useMemo(() => (lista ?? [])
    .filter((t) => !categoria || t.categoria === categoria)
    .filter((t) => !estado || t.estado === estado)
    .filter((t) => !anio || (t.fechaInicio ?? '').startsWith(anio))
    .filter((t) => !mes || (t.fechaInicio ?? '').slice(5, 7) === mes)
    .filter((t) => !publicacion || !!t.publicado === (publicacion === 'si')),
  [lista, categoria, estado, anio, mes, publicacion])

  const hayFiltros = !!(catJugador || categoria || estado || anio || mes || publicacion)
  // filtros aplicados, para las imágenes de los rankings
  const filtros = [
    catJugador && `Jugadores de ${catJugador}`, categoria && `Torneos de ${categoria}`, estado && nombreEstado(estado), anio, mes && MESES[Number(mes) - 1],
    publicacion && (publicacion === 'si' ? 'Publicados' : 'No publicados'),
  ].filter(Boolean) as string[]
  const limpiar = () => { setCatJugador(''); setCategoria(''); setEstado(''); setAnio(''); setMes(''); setPublicacion('') }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Estadísticas</h1>
        <p className="mt-2 text-sm text-noche/70">
          Rankings de campeones, participaciones y puntos{admin ? '' : ' de los torneos publicados'}.
          {categorias && ' Con “Categorías” ves solo a los jugadores de una categoría (por ejemplo, el ranking de puntos de 7ma Damas).'}
        </p>
      </header>

      <div className={`mb-5 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-2 ${admin ? 'lg:grid-cols-[1.3fr_1fr_1fr_0.7fr_0.9fr_1fr]' : 'lg:grid-cols-[1.3fr_1fr_1fr_0.7fr_0.9fr]'}`}>
        {categorias && (
          <Select value={catJugador} onChange={(e) => setCatJugador(esCategoriaJugador(e.target.value) ? e.target.value : '')} aria-label="Categoría de los jugadores">
            <option value="">Todas las categorías</option>
            {(['Damas', 'Caballeros'] as const).map((r) => (
              <optgroup key={r} label={r}>
                {CATEGORIAS_JUGADOR.filter((c) => rama(c) === r).map((c) => <option key={c} value={c} disabled={!cuentaCategoria.get(c)}>{c}</option>)}
              </optgroup>
            ))}
          </Select>
        )}
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value as '' | CategoriaTorneo)} aria-label="Tipo de torneo">
          <option value="">Damas, Caballeros y Mixto</option>
          {CATEGORIAS.map((x) => <option key={x} value={x}>Torneos de {x}</option>)}
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
        {admin && (
          <Select value={publicacion} onChange={(e) => setPublicacion(e.target.value as '' | 'si' | 'no')} aria-label="Publicación">
            <option value="">Publicados y no</option>
            <option value="si">Publicados</option>
            <option value="no">No publicados</option>
          </Select>
        )}
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {hayFiltros && !!lista?.length && (
        <p className="-mt-2 mb-3 text-xs text-noche/55">
          {visibles.length} de {lista.length} torneos{soloJugadores ? ` · ${soloJugadores.size} jugadores de ${catJugador}` : ''}
        </p>
      )}
      {lista === null ? <Spinner texto="Cargando estadísticas…" /> : visibles.length === 0 ? (
        <Vacio titulo={lista.length ? 'No hay torneos con esos filtros' : admin ? 'Todavía no armaste ningún torneo' : 'Todavía no hay torneos publicados'}>
          {lista.length ? <>Probá cambiando el año o el mes. <button className="font-semibold text-cancha" onClick={limpiar}>Ver todos</button></> : null}
        </Vacio>
      ) : (
        <Estadisticas torneos={visibles} filtrado={hayFiltros} publico={!admin} enlace={enlace} filtros={filtros} conPuntos conCompartir fijo soloJugadores={soloJugadores} />
      )}
    </>
  )
}
