import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarChart3, CloudUpload, Copy, Medal, Plus, Search, Trash2, Trophy, Users } from 'lucide-react'
import { duplicar, eliminar, listar, migrarLocales, torneosLocales, type ResumenTorneo } from '../lib/almacen'
import { ESTADOS, MESES, nombreEstado, rangoFechas, type EstadoTorneo } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { Alerta, Badge, Button, Input, Select, Spinner, Titulo, Vacio } from '../components/ui'
import Instructivo from '../components/Instructivo'

export default function Inicio({ onAbrir, onNuevo }: { onAbrir: (id: string) => void; onNuevo: () => void }) {
  const [lista, setLista] = useState<ResumenTorneo[] | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [locales, setLocales] = useState(torneosLocales)
  // filtros (los mismos que la página pública, más "publicado")
  const [texto, setTexto] = useState('')
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
      .filter((t) => !estado || t.estado === estado)
      .filter((t) => !anio || t.fechaInicio.startsWith(anio))
      .filter((t) => !mes || t.fechaInicio.slice(5, 7) === mes)
      .filter((t) => !publicacion || t.publicado === (publicacion === 'si'))
      .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '') || b.actualizado - a.actualizado)
  }, [lista, texto, estado, anio, mes, publicacion])
  const hayFiltros = !!(texto || estado || anio || mes || publicacion)

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
      <Titulo bajada="Cada torneo (una categoría) se arma por separado. Todo queda guardado en la base de datos." accion={<Button onClick={nueva} cargando={ocupado}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>}>
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
        <div className="mb-4 grid gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10 sm:grid-cols-[1.5fr_1fr_0.8fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar torneo…" className="pl-9" aria-label="Buscar torneo" />
          </label>
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
      {!!visibles.length && <Estadisticas torneos={visibles} filtrado={hayFiltros} />}
      {lista === null ? <Spinner texto="Cargando torneos…" /> : lista.length === 0 ? (
        <Vacio titulo="Todavía no armaste ningún torneo" accion={<Button onClick={nueva}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>}>
          Cargás el torneo, las parejas, armás las zonas y el playoff, generás las imágenes para WhatsApp y cargás los resultados.
        </Vacio>
      ) : visibles.length === 0 ? (
        <Vacio titulo="No hay torneos con esos filtros">
          <button className="font-semibold text-cancha" onClick={() => { setTexto(''); setEstado(''); setAnio(''); setMes(''); setPublicacion('') }}>Limpiar filtros</button>
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visibles.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-noche/10">
              <button onClick={() => onAbrir(c.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-display text-xl font-bold">{c.torneo || 'Torneo sin nombre'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
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

// ------------------------------------------------------------------ estadísticas (sobre los torneos filtrados)

/** "juan  PÉREZ" y "Juan Perez" cuentan como el mismo jugador */
const clave = (n: string) => normalizarTexto(n).replace(/\s+/g, ' ')

/** Ranking de jugadores: cuántas veces aparece cada uno (se muestra el nombre como se escribió la primera vez) */
function ranking(nombres: string[], top = 5) {
  const m = new Map<string, { nombre: string; n: number }>()
  for (const x of nombres) {
    const k = clave(x)
    if (!k) continue
    const e = m.get(k) ?? { nombre: x.trim(), n: 0 }
    e.n++
    m.set(k, e)
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre)).slice(0, top)
}

function Estadisticas({ torneos, filtrado }: { torneos: ResumenTorneo[]; filtrado: boolean }) {
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
    <details open className="mb-5 rounded-xl bg-white ring-1 ring-noche/10 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-display text-lg font-semibold text-noche">
        <BarChart3 className="h-5 w-5 text-cancha" aria-hidden /> Estadísticas{filtrado ? ' (de los torneos filtrados)' : ''}
      </summary>
      <div className="space-y-4 border-t border-noche/10 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi titulo="Torneos" valor={st.total}
            detalle={[st.porEstado.en_curso && `${st.porEstado.en_curso} en curso`, st.porEstado.pendiente && `${st.porEstado.pendiente} pendientes`, st.porEstado.finalizado && `${st.porEstado.finalizado} finalizados`, st.porEstado.cancelado && `${st.porEstado.cancelado} cancelados`].filter(Boolean).join(' · ')} />
          <Kpi titulo="Parejas inscriptas" valor={st.parejas} detalle={`${st.promedio} por torneo en promedio`} />
          <Kpi titulo="Jugadores distintos" valor={st.distintos} detalle="Cada jugador cuenta una vez" />
          <Kpi titulo="Publicados" valor={st.publicados} detalle={`${st.total - st.publicados} sin publicar`} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Ranking titulo="Ranking de campeones" icono={<Trophy className="h-4 w-4 text-cancha" aria-hidden />} unidad={['título', 'títulos']}
            filas={st.campeones} vacio="Todavía no hay torneos finalizados." />
          <Ranking titulo="Más participaciones" icono={<Users className="h-4 w-4 text-cancha" aria-hidden />} unidad={['torneo', 'torneos']}
            filas={st.participaciones} vacio="Todavía no hay parejas cargadas." />
        </div>
        <p className="text-[11px] text-noche/45">Los jugadores se identifican por nombre (sin importar mayúsculas ni acentos): si está escrito distinto en dos torneos, por ejemplo con un apodo, cuenta como dos. No incluye torneos cancelados (salvo en el total).</p>
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
