import { useCallback, useEffect, useMemo, useState } from 'react'
import { CloudUpload, Copy, Plus, Search, Trash2 } from 'lucide-react'
import { duplicar, eliminar, listar, migrarLocales, torneosLocales, type ResumenTorneo } from '../lib/almacen'
import { CATEGORIAS, ESTADOS, MESES, nombreEstado, rangoFechas, type CategoriaTorneo, type EstadoTorneo } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { Alerta, Badge, Button, Input, Select, Spinner, Titulo, Vacio } from '../components/ui'
import Instructivo from '../components/Instructivo'
import ImportarTorneos from '../components/ImportarTorneos'
import Estadisticas from '../components/Estadisticas'
import { BadgeCategoria, bordeCategoria } from '../components/Categoria'

export default function Inicio({ onAbrir, onNuevo }: { onAbrir: (id: string) => void; onNuevo: () => void }) {
  const [lista, setLista] = useState<ResumenTorneo[] | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [locales, setLocales] = useState(torneosLocales)
  // filtros (los mismos que la página pública, más "publicado")
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState<'' | CategoriaTorneo>('')
  const [estado, setEstado] = useState<'' | EstadoTorneo>('')
  const [anio, setAnio] = useState('')
  const [mes, setMes] = useState('')
  const [publicacion, setPublicacion] = useState<'' | 'si' | 'no'>('')
  const anios = useMemo(() => [...new Set((lista ?? []).map((t) => t.fechaInicio.slice(0, 4)).filter(Boolean))].sort().reverse(), [lista])
  // siempre del más nuevo al más viejo (por fecha de inicio; sin fecha, al final)
  const visibles = useMemo(() => {
    const q = normalizarTexto(texto)
    return (lista ?? [])
      .filter((t) => !q || normalizarTexto(t.torneo).includes(q))
      .filter((t) => !categoria || t.categoria === categoria)
      .filter((t) => !estado || t.estado === estado)
      .filter((t) => !anio || t.fechaInicio.startsWith(anio))
      .filter((t) => !mes || t.fechaInicio.slice(5, 7) === mes)
      .filter((t) => !publicacion || t.publicado === (publicacion === 'si'))
      .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '') || b.actualizado - a.actualizado)
  }, [lista, texto, categoria, estado, anio, mes, publicacion])
  const datosEstadisticas = useMemo(() => visibles.map((t) => ({ ...t, nombre: t.torneo })), [visibles])
  const hayFiltros = !!(texto || categoria || estado || anio || mes || publicacion)

  const refrescar = useCallback(async () => {
    try { setLista(await listar()) } catch (e) { setLista([]); setMsg({ tipo: 'error', txt: `No se pudo leer la base: ${e instanceof Error ? e.message : e}` }) }
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
      <Titulo bajada="Cada torneo (una categoría) se arma por separado. Todo queda guardado en la base de datos. El cronograma de todos los torneos en juego (PDF y carga de resultados) está en la pestaña Calendario." accion={
        <div className="flex flex-wrap gap-2">
          <ImportarTorneos
            onImportado={async (txt) => { await refrescar(); setMsg({ tipo: 'ok', txt }) }}
            onError={(txt) => setMsg({ tipo: 'error', txt })} />
          <Button onClick={nueva} cargando={ocupado}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>
        </div>
      }>
        Torneos
      </Titulo>
      <Instructivo />
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
            {anios.map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
          <Select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
            <option value="">Mes</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </Select>
          <Select value={publicacion} onChange={(e) => setPublicacion(e.target.value as '' | 'si' | 'no')} aria-label="Publicación">
            <option value="">Publicados y no</option>
            <option value="si">Publicados</option>
            <option value="no">No publicados</option>
          </Select>
        </div>
      )}
      {hayFiltros && !!lista?.length && <p className="-mt-2 mb-3 text-xs text-noche/55">{visibles.length} de {lista.length} torneos</p>}
      {!!visibles.length && <Estadisticas torneos={datosEstadisticas} filtrado={hayFiltros} />}
      {lista === null ? <Spinner texto="Cargando torneos…" /> : lista.length === 0 ? (
        <Vacio titulo="Todavía no armaste ningún torneo" accion={<Button onClick={nueva}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>}>
          Cargás el torneo, las parejas, armás las zonas y el playoff, generás las imágenes para WhatsApp y cargás los resultados.
        </Vacio>
      ) : visibles.length === 0 ? (
        <Vacio titulo="No hay torneos con esos filtros">
          <button className="font-semibold text-cancha" onClick={() => { setTexto(''); setCategoria(''); setEstado(''); setAnio(''); setMes(''); setPublicacion('') }}>Limpiar filtros</button>
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibles.map((c) => (
            <li key={c.id} className={`flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ${bordeCategoria(c.categoria)} ring-noche/10`}>
              <button onClick={() => onAbrir(c.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-display text-xl font-bold">{c.torneo || 'Torneo sin nombre'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <BadgeCategoria categoria={c.categoria} />
                  <Badge tono={c.estado === 'en_curso' ? 'verde' : c.estado === 'finalizado' ? 'azul' : c.estado === 'cancelado' ? 'rojo' : 'ambar'}>{nombreEstado(c.estado)}</Badge>
                  {c.publicado && <Badge tono="pelota">Publicado</Badge>}
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
          ))}
        </ul>
      )}
    </>
  )
}
