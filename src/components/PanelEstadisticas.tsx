import { useEffect, useMemo, useState } from 'react'
import { CATEGORIAS, ESTADOS, MESES, nombreEstado, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { CATEGORIAS_JUGADOR, esCategoriaJugador, rama, type CategoriaJugador } from '../lib/categorias'
import Estadisticas, { clave, type DatoEstadistica } from './Estadisticas'
import { Alerta, MultiSelect, Spinner, Vacio } from './ui'

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
  // filtros de selección múltiple: vacío = todos
  const [catJugador, setCatJugador] = useState<CategoriaJugador[]>([])
  const [categoria, setCategoria] = useState<CategoriaTorneo[]>([])
  const [estado, setEstado] = useState<EstadoTorneo[]>([])
  // por defecto, el año en curso
  const [anio, setAnio] = useState<string[]>([ANIO_ACTUAL])
  const [mes, setMes] = useState<string[]>([])
  const [publicacion, setPublicacion] = useState<('si' | 'no')[]>([])

  useEffect(() => {
    cargar().then(setLista).catch((e) => { setError(e instanceof Error ? e.message : 'No se pudieron cargar los torneos.'); setLista([]) })
  }, [cargar])
  useEffect(() => {
    cargarCategorias()
      .then((l) => setCategorias(new Map(l.filter((j) => esCategoriaJugador(j.categoria)).map((j) => [clave(j.nombre), j.categoria as CategoriaJugador]))))
      .catch(() => setCategorias(null))
  }, [cargarCategorias])

  // jugadores de las categorías elegidas (para los rankings)
  const soloJugadores = useMemo(
    () => (catJugador.length && categorias ? new Set([...categorias].filter(([, c]) => catJugador.includes(c)).map(([k]) => k)) : null),
    [catJugador, categorias])
  const cuentaCategoria = useMemo(() => {
    const m = new Map<CategoriaJugador, number>()
    for (const c of categorias?.values() ?? []) m.set(c, (m.get(c) ?? 0) + 1)
    return m
  }, [categorias])

  const anios = useMemo(() => [...new Set([ANIO_ACTUAL, ...((lista ?? []).map((t) => t.fechaInicio?.slice(0, 4)).filter(Boolean) as string[])])].sort().reverse(), [lista])

  const visibles = useMemo(() => (lista ?? [])
    .filter((t) => !categoria.length || categoria.includes(t.categoria))
    .filter((t) => !estado.length || estado.includes(t.estado))
    .filter((t) => !anio.length || anio.includes((t.fechaInicio ?? '').slice(0, 4)))
    .filter((t) => !mes.length || mes.includes((t.fechaInicio ?? '').slice(5, 7)))
    .filter((t) => !publicacion.length || publicacion.includes(t.publicado ? 'si' : 'no')),
  [lista, categoria, estado, anio, mes, publicacion])

  const hayFiltros = !!(catJugador.length || categoria.length || estado.length || anio.length || mes.length || publicacion.length)
  // "A, B y C"
  const enumerar = (l: string[]) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`)
  // filtros aplicados, para las imágenes de los rankings
  const filtros = [
    catJugador.length && `Jugadores de ${enumerar(catJugador)}`,
    categoria.length && `Torneos de ${enumerar(categoria)}`,
    estado.length && enumerar(estado.map(nombreEstado)),
    anio.length && enumerar(anio),
    mes.length && enumerar(mes.map((m) => MESES[Number(m) - 1])),
    // con los dos elegidos es lo mismo que sin filtro
    publicacion.length === 1 && (publicacion[0] === 'si' ? 'Publicados' : 'No publicados'),
  ].filter(Boolean) as string[]
  const limpiar = () => { setCatJugador([]); setCategoria([]); setEstado([]); setAnio([]); setMes([]); setPublicacion([]) }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Estadísticas</h1>
        <p className="mt-2 text-sm text-noche/70">
          Rankings de campeones, participaciones y puntos{admin ? '' : ' de los torneos publicados'}.
          {categorias && ' Con “Categorías” ves solo a los jugadores de una o más categorías (por ejemplo, el ranking de puntos de 7ma Damas).'}
        </p>
      </header>

      <div className={`mb-5 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-2 ${admin ? 'lg:grid-cols-[1.3fr_1fr_1fr_0.7fr_0.9fr_1fr]' : 'lg:grid-cols-[1.3fr_1fr_1fr_0.7fr_0.9fr]'}`}>
        {categorias && (
          <MultiSelect<CategoriaJugador> valor={catJugador} onChange={setCatJugador} aria-label="Categoría de los jugadores" placeholder="Todas las categorías"
            plural={(n) => `${n} categorías`}
            opciones={(['Damas', 'Caballeros'] as const).flatMap((r) =>
              CATEGORIAS_JUGADOR.filter((c) => rama(c) === r).map((c) => ({ valor: c, label: c, grupo: r, disabled: !cuentaCategoria.get(c) })))} />
        )}
        <MultiSelect<CategoriaTorneo> valor={categoria} onChange={setCategoria} aria-label="Tipo de torneo" placeholder="Damas, Caballeros y Mixto"
          opciones={CATEGORIAS.map((x) => ({ valor: x, label: `Torneos de ${x}` }))} plural={(n) => `${n} tipos de torneo`} />
        <MultiSelect<EstadoTorneo> valor={estado} onChange={setEstado} aria-label="Estado" placeholder="Todos los estados"
          opciones={ESTADOS.map((e) => ({ valor: e.id, label: e.nombre }))} plural={(n) => `${n} estados`} />
        <MultiSelect valor={anio} onChange={setAnio} aria-label="Año" placeholder="Año"
          opciones={anios.map((a) => ({ valor: a, label: a }))} plural={(n) => `${n} años`} />
        <MultiSelect valor={mes} onChange={setMes} aria-label="Mes" placeholder="Mes"
          opciones={MESES.map((m, i) => ({ valor: String(i + 1).padStart(2, '0'), label: m }))} plural={(n) => `${n} meses`} />
        {admin && (
          <MultiSelect<'si' | 'no'> valor={publicacion} onChange={setPublicacion} aria-label="Publicación" placeholder="Publicados y no"
            opciones={[{ valor: 'si', label: 'Publicados' }, { valor: 'no', label: 'No publicados' }]} />
        )}
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {hayFiltros && !!lista?.length && (
        <p className="-mt-2 mb-3 text-xs text-noche/55">
          {visibles.length} de {lista.length} torneos{soloJugadores ? ` · ${soloJugadores.size} jugadores de ${enumerar(catJugador)}` : ''}
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
