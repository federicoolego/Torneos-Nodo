import { useCallback, useEffect, useMemo, useState } from 'react'
import { CloudUpload, Copy, Plus, Search, Trash2 } from 'lucide-react'
import { completarAlcances, duplicar, eliminar, listar, migrarLocales, torneosLocales, type ResumenTorneo } from '../lib/almacen'
import { CATEGORIAS, ESTADOS, MESES, compararCercania, nombreEstado, rangoFechas, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { Alerta, Badge, Button, Input, MultiSelect, Spinner, Titulo, Vacio } from '../components/ui'
import ImportarTorneos from '../components/ImportarTorneos'
import { BadgeCategoria, bordeCategoria } from '../components/Categoria'
import { GruposEstado } from '../components/GruposEstado'

const ANIO_ACTUAL = String(new Date().getFullYear())

export default function Inicio({ onAbrir, onNuevo }: { onAbrir: (id: string) => void; onNuevo: () => void }) {
  const [lista, setLista] = useState<ResumenTorneo[] | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [locales, setLocales] = useState(torneosLocales)
  // filtros (los mismos que la página pública, más "publicado")
  const [texto, setTexto] = useState('')
  // filtros de selección múltiple: vacío = todos
  const [categoria, setCategoria] = useState<CategoriaTorneo[]>([])
  const [estado, setEstado] = useState<EstadoTorneo[]>([])
  // por defecto, el año en curso
  const [anio, setAnio] = useState<string[]>([ANIO_ACTUAL])
  const [mes, setMes] = useState<string[]>([])
  const [publicacion, setPublicacion] = useState<('si' | 'no')[]>([])
  const anios = useMemo(() => [...new Set([ANIO_ACTUAL, ...(lista ?? []).map((t) => t.fechaInicio.slice(0, 4)).filter(Boolean)])].sort().reverse(), [lista])
  // del más cercano al más lejano: pendientes / en curso del próximo a jugarse al último; finalizados del más reciente al más viejo
  const visibles = useMemo(() => {
    const q = normalizarTexto(texto)
    return (lista ?? [])
      .filter((t) => !q || normalizarTexto(t.torneo).includes(q))
      .filter((t) => !categoria.length || categoria.includes(t.categoria))
      .filter((t) => !estado.length || estado.includes(t.estado))
      .filter((t) => !anio.length || anio.includes(t.fechaInicio.slice(0, 4)))
      .filter((t) => !mes.length || mes.includes(t.fechaInicio.slice(5, 7)))
      .filter((t) => !publicacion.length || publicacion.includes(t.publicado ? 'si' : 'no'))
      .sort((a, b) => compararCercania({ inicio: a.fechaInicio, estado: a.estado, nombre: a.torneo }, { inicio: b.fechaInicio, estado: b.estado, nombre: b.torneo }) || b.actualizado - a.actualizado)
  }, [lista, texto, categoria, estado, anio, mes, publicacion])
  const hayFiltros = !!(texto || categoria.length || estado.length || anio.length || mes.length || publicacion.length)

  const refrescar = useCallback(async () => {
    try {
      const l = await listar()
      setLista(l)
      // torneos anteriores a "hasta dónde llegó cada pareja": se calcula una vez, en segundo plano
      completarAlcances(l).then(async (n) => { if (n) setLista(await listar()) }).catch(() => {})
    } catch (e) { setLista([]); setMsg({ tipo: 'error', txt: `No se pudo leer la base: ${e instanceof Error ? e.message : e}` }) }
  }, [])
  useEffect(() => { void refrescar() }, [refrescar])

  /** Corre una acción mostrando el error si falla */
  async function accion(f: () => Promise<void>) {
    setOcupado(true)
    try { await f() } catch (e) { setMsg({ tipo: 'error', txt: e instanceof Error ? e.message : 'Algo salió mal.' }) } finally { setOcupado(false) }
  }

  const subirLocales = () => accion(async () => {
    const r = await migrarLocales()
    setLocales(0)
    await refrescar()
    setMsg({ tipo: 'ok', txt: `Torneos de este navegador subidos a la base: ${r.nuevos} nuevo(s), ${r.actualizados} actualizado(s), ${r.sinCambios} ya estaban.` })
  })

  // no se guarda nada todavía: el torneo se crea al completar los datos obligatorios
  const nueva = () => onNuevo()


  return (
    <>
      <Titulo bajada="Cada torneo (una categoría) se arma por separado. Todo queda guardado en la base de datos. El cronograma de todos los torneos en juego (PDF y carga de resultados) está en la pestaña Calendario, y los rankings, en Estadísticas." accion={
        <div className="flex flex-wrap gap-2">
          <ImportarTorneos
            onImportado={async (txt) => { await refrescar(); setMsg({ tipo: 'ok', txt }) }}
            onError={(txt) => setMsg({ tipo: 'error', txt })} />
          <Button onClick={nueva} cargando={ocupado}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>
        </div>
      }>
        Torneos
      </Titulo>
      {locales > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cancha-suave p-4 ring-1 ring-cancha/20">
          <p className="text-sm text-noche/80">En este navegador quedaron <strong>{locales} torneo(s)</strong> de la versión anterior (sin base de datos).</p>
          <Button onClick={subirLocales} cargando={ocupado}><CloudUpload className="h-4 w-4" aria-hidden /> Subirlos a la base</Button>
        </div>
      )}
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.txt}</Alerta></div>}
      {!!lista?.length && (
        <div className="mb-4 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar torneo…" className="pl-9" aria-label="Buscar torneo" />
          </label>
          <MultiSelect<CategoriaTorneo> valor={categoria} onChange={setCategoria} aria-label="Categoría" placeholder="Todas las categorías"
            opciones={CATEGORIAS.map((x) => ({ valor: x, label: x }))} plural={(n) => `${n} categorías`} />
          <MultiSelect<EstadoTorneo> valor={estado} onChange={setEstado} aria-label="Estado" placeholder="Todos los estados"
            opciones={ESTADOS.map((e) => ({ valor: e.id, label: e.nombre }))} plural={(n) => `${n} estados`} />
          <MultiSelect valor={anio} onChange={setAnio} aria-label="Año" placeholder="Año"
            opciones={anios.map((x) => ({ valor: x, label: x }))} plural={(n) => `${n} años`} />
          <MultiSelect valor={mes} onChange={setMes} aria-label="Mes" placeholder="Mes"
            opciones={MESES.map((m, i) => ({ valor: String(i + 1).padStart(2, '0'), label: m }))} plural={(n) => `${n} meses`} />
          <MultiSelect<'si' | 'no'> valor={publicacion} onChange={setPublicacion} aria-label="Publicación" placeholder="Publicados y no"
            opciones={[{ valor: 'si', label: 'Publicados' }, { valor: 'no', label: 'No publicados' }]} />
        </div>
      )}
      {hayFiltros && !!lista?.length && <p className="-mt-2 mb-3 text-xs text-noche/55">{visibles.length} de {lista.length} torneos</p>}
      {lista === null ? <Spinner texto="Cargando torneos…" /> : lista.length === 0 ? (
        <Vacio titulo="Todavía no armaste ningún torneo" accion={<Button onClick={nueva}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>}>
          Cargás el torneo, las parejas, armás las zonas y el playoff, generás las imágenes para WhatsApp y cargás los resultados.
        </Vacio>
      ) : visibles.length === 0 ? (
        <Vacio titulo="No hay torneos con esos filtros">
          <button className="font-semibold text-cancha" onClick={() => { setTexto(''); setCategoria([]); setEstado([]); setAnio([]); setMes([]); setPublicacion([]) }}>Limpiar filtros</button>
        </Vacio>
      ) : (
        <GruposEstado items={visibles} estado={(c) => c.estado} clave={(c) => c.id} render={(c) => (
            <li className={`flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ${bordeCategoria(c.categoria)} ring-noche/10`}>
              <button onClick={() => onAbrir(c.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-display text-xl font-bold">{c.torneo || 'Torneo sin nombre'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <BadgeCategoria categoria={c.categoria} />
                  <Badge tono={c.estado === 'en_curso' ? 'verde' : c.estado === 'finalizado' ? 'azul' : c.estado === 'cancelado' ? 'rojo' : 'ambar'}>{nombreEstado(c.estado)}</Badge>
                  {c.publicado && <Badge tono="pelota">{c.soloInfo ? 'Publicado · solo info' : 'Publicado'}</Badge>}
                </div>
                <p className="truncate text-sm text-noche/65">{c.fechaInicio ? rangoFechas(c.fechaInicio, c.fechaFin) : 'Sin fechas'}</p>
                <p className="mt-1 text-xs text-noche/50">
                  {c.parejas} parejas · {c.zonas ? `${c.zonas} zonas` : 'sin zonas'}{c.playoff ? ' · playoff armado' : ''} ·{' '}
                  {new Date(c.actualizado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              </button>
              <button title="Duplicar (por ejemplo, para otra categoría)" aria-label="Duplicar" className="p-2 text-noche/50 hover:text-cancha" disabled={ocupado}
                onClick={() => accion(async () => { await duplicar(c.id); await refrescar() })}>
                <Copy className="h-4 w-4" />
              </button>
              <button aria-label="Eliminar" className="p-2 text-noche/50 hover:text-red" disabled={ocupado}
                onClick={() => confirm(`¿Eliminar ${c.torneo || 'este torneo'}? Se borra de la base con sus parejas y resultados.`) &&
                  accion(async () => { await eliminar(c.id); await refrescar() })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          )} />
      )}
    </>
  )
}
