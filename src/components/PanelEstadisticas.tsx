import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { CATEGORIAS, ESTADOS, MESES, nombreEstado, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { ordenarTipos, tipoTorneo } from '../lib/categorias'
import Estadisticas, { type DatoEstadistica } from './Estadisticas'
import { Alerta, Input, Select, Spinner, Vacio } from './ui'

const ANIO_ACTUAL = String(new Date().getFullYear())

/**
 * Pestaña Estadísticas (página pública y admin): los filtros de la lista de torneos + "Torneo"
 * (tipo de torneo: "7ma Damas", "Suma 13 Caballeros"…, para ver todas sus fechas juntas).
 * `admin`: suma el filtro de publicación.
 */
export default function PanelEstadisticas({ cargar, admin = false, enlace }: {
  cargar: () => Promise<DatoEstadistica[]>
  admin?: boolean
  enlace?: (id: string) => string
}) {
  const [lista, setLista] = useState<DatoEstadistica[] | null>(null)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [tipo, setTipo] = useState('')
  const [categoria, setCategoria] = useState<'' | CategoriaTorneo>('')
  const [estado, setEstado] = useState<'' | EstadoTorneo>('')
  // por defecto, el año en curso
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [mes, setMes] = useState('')
  const [publicacion, setPublicacion] = useState<'' | 'si' | 'no'>('')

  useEffect(() => {
    cargar().then(setLista).catch((e) => { setError(e instanceof Error ? e.message : 'No se pudieron cargar los torneos.'); setLista([]) })
  }, [cargar])

  const tipoDe = (t: DatoEstadistica) => tipoTorneo(t.nombre ?? '', t.categoria)
  const anios = useMemo(() => [...new Set([ANIO_ACTUAL, ...((lista ?? []).map((t) => t.fechaInicio?.slice(0, 4)).filter(Boolean) as string[])])].sort().reverse(), [lista])
  // tipos de torneo de la categoría elegida (si hay una)
  const tipos = useMemo(() => ordenarTipos((lista ?? []).filter((t) => !categoria || t.categoria === categoria)
    .map((t) => ({ tipo: tipoDe(t), categoria: t.categoria, nombre: t.nombre ?? '' }))), [lista, categoria]) // eslint-disable-line react-hooks/exhaustive-deps
  // si se cambia la categoría y el tipo elegido ya no corresponde, vuelve a "Todos"
  const tipoActivo = tipo && tipos.includes(tipo) ? tipo : ''

  const visibles = useMemo(() => {
    const q = normalizarTexto(texto)
    return (lista ?? [])
      .filter((t) => !q || normalizarTexto(t.nombre ?? '').includes(q))
      .filter((t) => !tipoActivo || tipoDe(t) === tipoActivo)
      .filter((t) => !categoria || t.categoria === categoria)
      .filter((t) => !estado || t.estado === estado)
      .filter((t) => !anio || (t.fechaInicio ?? '').startsWith(anio))
      .filter((t) => !mes || (t.fechaInicio ?? '').slice(5, 7) === mes)
      .filter((t) => !publicacion || !!t.publicado === (publicacion === 'si'))
  }, [lista, texto, tipoActivo, categoria, estado, anio, mes, publicacion]) // eslint-disable-line react-hooks/exhaustive-deps

  const hayFiltros = !!(texto || tipoActivo || categoria || estado || anio || mes || publicacion)
  // filtros aplicados, para las imágenes de los rankings
  const filtros = [
    tipoActivo || categoria, estado && nombreEstado(estado), anio, mes && MESES[Number(mes) - 1],
    publicacion && (publicacion === 'si' ? 'Publicados' : 'No publicados'), texto.trim() && `Torneo: “${texto.trim()}”`,
  ].filter(Boolean) as string[]
  const limpiar = () => { setTexto(''); setTipo(''); setCategoria(''); setEstado(''); setAnio(''); setMes(''); setPublicacion('') }

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Estadísticas</h1>
        <p className="mt-2 text-sm text-noche/70">
          Rankings de campeones, participaciones y puntos{admin ? '' : ' de los torneos publicados'}. Con “Torneo” podés ver juntas todas las fechas de un mismo torneo (por ejemplo, 7ma Damas).
        </p>
      </header>

      <div className={`mb-5 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-2 ${admin ? 'lg:grid-cols-[1.3fr_1.2fr_1fr_1fr_0.7fr_0.9fr_1fr]' : 'lg:grid-cols-[1.3fr_1.2fr_1fr_1fr_0.7fr_0.9fr]'}`}>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar torneo…" className="pl-9" aria-label="Buscar torneo" />
        </label>
        <Select value={tipoActivo} onChange={(e) => setTipo(e.target.value)} aria-label="Torneo">
          <option value="">Todos los torneos</option>
          {tipos.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
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
        {admin && (
          <Select value={publicacion} onChange={(e) => setPublicacion(e.target.value as '' | 'si' | 'no')} aria-label="Publicación">
            <option value="">Publicados y no</option>
            <option value="si">Publicados</option>
            <option value="no">No publicados</option>
          </Select>
        )}
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {hayFiltros && !!lista?.length && <p className="-mt-2 mb-3 text-xs text-noche/55">{visibles.length} de {lista.length} torneos</p>}
      {lista === null ? <Spinner texto="Cargando estadísticas…" /> : visibles.length === 0 ? (
        <Vacio titulo={lista.length ? 'No hay torneos con esos filtros' : admin ? 'Todavía no armaste ningún torneo' : 'Todavía no hay torneos publicados'}>
          {lista.length ? <>Probá cambiando el torneo, el año o el mes. <button className="font-semibold text-cancha" onClick={limpiar}>Ver todos</button></> : null}
        </Vacio>
      ) : (
        <Estadisticas torneos={visibles} filtrado={hayFiltros} publico={!admin} enlace={enlace} filtros={filtros} conPuntos conCompartir fijo />
      )}
    </>
  )
}
