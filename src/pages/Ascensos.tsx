import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Pencil, Plus, RotateCcw, Share2, Trash2 } from 'lucide-react'
import {
  FALTA_SQL_RECAT, agregarMovimiento, aplicarTanda, cambiarMovimiento, crearTanda, editarTanda, eliminarTanda, fechaCorta, hoyISO,
  leerTanda, listarTandas, nombreSugerido, quitarMovimiento, revertirTanda, type Movimiento, type Tanda,
} from '../lib/recategorizaciones'
import { listarBase } from '../lib/jugadores'
import { CATEGORIAS_JUGADOR, destinosPosibles, rama, tipoMovimiento, type CategoriaJugador, type TipoMovimiento } from '../lib/categorias'
import { nombrePropio } from '../lib/torneo'
import { ESTILO_CATEGORIA, BadgeCategoriaJugador } from '../components/Categoria'
import { EncabezadoCard, compartirArchivos, useColapso } from '../components/CardsCategorias'
import SelectorJugador from '../components/SelectorJugador'
import { Alerta, Badge, Button, Field, Input, Modal, Select, Spinner, Titulo, Vacio } from '../components/ui'

type TandaBase = Omit<Tanda, 'ascensos' | 'recategorizaciones'>
type Msg = { tipo: 'ok' | 'error' | 'aviso'; txt: string } | null
const err = (e: unknown, def = 'Algo salió mal.') => (e instanceof Error ? e.message : def)
const num = (c: string) => c.split(' ')[0]

/** Pestaña "Ascensos": tandas de cambios de categoría (cada 2 o 3 meses) y sus imágenes para WhatsApp */
export default function Ascensos() {
  const [abierta, setAbierta] = useState<string | null>(null)
  return abierta ? <Detalle id={abierta} onVolver={() => setAbierta(null)} /> : <Lista onAbrir={setAbierta} />
}

// ------------------------------------------------------------------ lista de tandas
function Lista({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [tandas, setTandas] = useState<Tanda[] | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    listarTandas().then(setTandas).catch((e) => { setTandas([]); setMsg({ tipo: 'error', txt: err(e, 'No se pudieron leer las tandas.') }) })
  }, [])

  const nueva = (
    <Button onClick={() => setCreando(true)} disabled={msg?.txt === FALTA_SQL_RECAT}><Plus className="h-4 w-4" aria-hidden /> Nueva tanda</Button>
  )
  return (
    <>
      <Titulo accion={nueva}
        bajada="Cada tanda junta los ascensos y recategorizaciones de un corte. Mientras está en borrador no cambia ninguna categoría; al aplicarla se actualizan todos los jugadores juntos. De cada categoría se comparte una imagen: festiva para los ascensos e informativa para las recategorizaciones.">
        Ascensos
      </Titulo>
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.txt}</Alerta></div>}
      {tandas === null ? <Spinner texto="Cargando tandas…" /> : tandas.length === 0 ? (
        msg ? null : <Vacio titulo="Todavía no hay tandas" accion={nueva}>Creá una tanda, sumá los jugadores que cambian de categoría y aplicala cuando esté lista.</Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tandas.map((t) => (
            <li key={t.id}>
              <button onClick={() => onAbrir(t.id)}
                className={`flex w-full flex-col gap-2 rounded-xl border-l-[6px] bg-white p-4 text-left ring-1 ring-noche/10 hover:ring-cancha/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cancha ${t.estado === 'aplicada' ? 'border-l-cancha' : 'border-l-amber-400'}`}>
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display text-xl font-bold leading-tight text-noche">{t.nombre}</span>
                  <EstadoBadge estado={t.estado} />
                </span>
                <span className="text-xs text-noche/60">Vigente desde el {fechaCorta(t.vigencia)}</span>
                <span className="flex flex-wrap gap-2 text-sm">
                  <span className="font-semibold text-cancha">{t.ascensos} {t.ascensos === 1 ? 'ascenso' : 'ascensos'}</span>
                  <span className="text-noche/40">·</span>
                  <span className="font-semibold text-noche/70">{t.recategorizaciones} {t.recategorizaciones === 1 ? 'recategorización' : 'recategorizaciones'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ModalTanda abierto={creando} onCerrar={() => setCreando(false)}
        onGuardar={async (nombre, vigencia) => { const id = await crearTanda(nombre, vigencia); setCreando(false); onAbrir(id) }} />
    </>
  )
}

function EstadoBadge({ estado }: { estado: TandaBase['estado'] }) {
  return estado === 'aplicada' ? <Badge tono="verde">Aplicada</Badge> : <Badge tono="ambar">Borrador</Badge>
}

/** Alta o edición del nombre y la vigencia de la tanda */
function ModalTanda({ abierto, inicial, onCerrar, onGuardar }: {
  abierto: boolean; inicial?: { nombre: string; vigencia: string }; onCerrar: () => void
  onGuardar: (nombre: string, vigencia: string) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    if (!abierto) return
    setNombre(inicial?.nombre ?? nombreSugerido())
    setVigencia(inicial?.vigencia ?? hoyISO())
    setError('')
  }, [abierto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('Poné un nombre para la tanda.'); return }
    if (!vigencia) { setError('Elegí desde qué fecha rigen los cambios.'); return }
    setGuardando(true)
    try { await onGuardar(nombre, vigencia) } catch (x) { setError(err(x)) } finally { setGuardando(false) }
  }
  return (
    <Modal abierto={abierto} titulo={inicial ? 'Editar tanda' : 'Nueva tanda'} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <Field label="Nombre" hint="Sale en las imágenes, debajo de la lista.">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} autoFocus />
        </Field>
        <Field label="Vigente desde" hint="Fecha desde la que rigen las categorías nuevas (se informa en las imágenes).">
          <Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
        </Field>
        {error && <Alerta tipo="error">{error}</Alerta>}
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" cargando={guardando}>{inicial ? 'Guardar' : 'Crear tanda'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------ detalle de una tanda
interface JugadorBase { id: string; nombre: string; categoria: CategoriaJugador | null }
interface Grupo { tipo: TipoMovimiento; categoria: CategoriaJugador; movimientos: Movimiento[] }

const nombreArchivo = (g: Grupo, i: number, n: number) =>
  `${`${g.tipo === 'ascenso' ? 'Ascensos' : 'Recategorización'} ${g.categoria}${n > 1 ? ` (${i + 1} de ${n})` : ''}`.replace(/[\\/:*?"<>|]+/g, '').trim()}.png`

async function generarImagenes(grupos: Grupo[], tanda: TandaBase): Promise<File[]> {
  // se carga recién al compartir (no suma peso a la página)
  const { imagenesAscenso, imagenesRecategorizacion } = await import('../lib/imagenes')
  const files: File[] = []
  for (const g of grupos) {
    const datos = {
      categoria: g.categoria, rama: rama(g.categoria), tanda: tanda.nombre, vigencia: fechaCorta(tanda.vigencia),
      jugadores: g.movimientos.map((m) => ({ nombre: nombrePropio(m.nombre), antes: m.anterior })),
    }
    const blobs = g.tipo === 'ascenso' ? await imagenesAscenso(datos) : await imagenesRecategorizacion(datos)
    blobs.forEach((b, i) => files.push(new File([b], nombreArchivo(g, i, blobs.length), { type: 'image/png' })))
  }
  return files
}

function Detalle({ id, onVolver }: { id: string; onVolver: () => void }) {
  const [tanda, setTanda] = useState<TandaBase | null>(null)
  const [movs, setMovs] = useState<Movimiento[]>([])
  const [padron, setPadron] = useState<JugadorBase[]>([])
  const [cargando, setCargando] = useState(true)
  const [msg, setMsg] = useState<Msg>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)
  const [generando, setGenerando] = useState<string | null>(null)
  const { colapsada, alternar } = useColapso()

  const refrescar = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([leerTanda(id), listarBase()])
      setTanda(t.tanda); setMovs(t.movimientos); setPadron(p.jugadores)
    } catch (e) { setMsg({ tipo: 'error', txt: err(e, 'No se pudo leer la tanda.') }) } finally { setCargando(false) }
  }, [id])
  useEffect(() => { void refrescar() }, [refrescar])

  async function accion(clave: string, f: () => Promise<string | void>) {
    setOcupado(clave); setMsg(null)
    try { const ok = await f(); await refrescar(); if (ok) setMsg({ tipo: 'ok', txt: ok }) }
    catch (e) { setMsg({ tipo: 'error', txt: err(e) }) } finally { setOcupado(null) }
  }

  const borrador = tanda?.estado === 'borrador'
  const grupos = useMemo(() => {
    const out: Grupo[] = []
    for (const tipo of ['ascenso', 'recategorizacion'] as const) {
      for (const c of CATEGORIAS_JUGADOR) {
        const m = movs.filter((x) => x.tipo === tipo && x.nueva === c)
        if (m.length) out.push({ tipo, categoria: c, movimientos: m })
      }
    }
    return out
  }, [movs])
  // en borrador: jugadores cuya categoría actual ya no es la "anterior" (la cambiaron por otro lado)
  const conflictos = borrador ? movs.filter((m) => !m.enPadron || m.actual !== m.anterior) : []

  async function compartir(clave: string, gs: Grupo[], titulo: string) {
    if (!tanda || !gs.length) return
    setGenerando(clave)
    try { await compartirArchivos(await generarImagenes(gs, tanda), titulo) } catch (e) { alert(err(e, 'No se pudieron generar las imágenes.')) } finally { setGenerando(null) }
  }

  if (cargando) return <Spinner texto="Cargando tanda…" />
  if (!tanda) {
    return (
      <>
        <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-cancha"><ArrowLeft className="h-4 w-4" aria-hidden /> Ascensos</button>
        {msg && <Alerta tipo={msg.tipo}>{msg.txt}</Alerta>}
      </>
    )
  }

  const nAsc = movs.filter((m) => m.tipo === 'ascenso').length
  const nRec = movs.length - nAsc

  return (
    <>
      <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-cancha"><ArrowLeft className="h-4 w-4" aria-hidden /> Ascensos</button>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-4xl font-bold leading-none text-noche">{tanda.nombre}</h1>
            <EstadoBadge estado={tanda.estado} />
          </div>
          <p className="mt-2 text-sm text-noche/70">
            Vigente desde el {fechaCorta(tanda.vigencia)} · {nAsc} {nAsc === 1 ? 'ascenso' : 'ascensos'} · {nRec} {nRec === 1 ? 'recategorización' : 'recategorizaciones'}
            {tanda.aplicada && <> · aplicada el {new Date(tanda.aplicada).toLocaleDateString('es-AR')}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variante="secundario" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" aria-hidden /> Editar</Button>
          {grupos.length > 0 && (
            <Button variante="secundario" cargando={generando === 'todas'} onClick={() => void compartir('todas', grupos, tanda.nombre)}>
              {generando !== 'todas' && <Share2 className="h-4 w-4" aria-hidden />} Compartir todas
            </Button>
          )}
          {borrador ? (
            <Button disabled={!movs.length || conflictos.length > 0} cargando={ocupado === 'aplicar'}
              title={conflictos.length ? 'Corregí los jugadores marcados antes de aplicar' : undefined}
              onClick={() => {
                if (!confirm(`Se actualiza la categoría de ${movs.length} ${movs.length === 1 ? 'jugador' : 'jugadores'} en el padrón. ¿Aplicar la tanda?`)) return
                void accion('aplicar', async () => { const n = await aplicarTanda(id); return `Tanda aplicada: ${n} ${n === 1 ? 'jugador cambió' : 'jugadores cambiaron'} de categoría.` })
              }}>
              {ocupado !== 'aplicar' && <CheckCircle2 className="h-4 w-4" aria-hidden />} Aplicar tanda
            </Button>
          ) : (
            <Button variante="secundario" cargando={ocupado === 'revertir'}
              onClick={() => {
                if (!confirm('Los jugadores vuelven a su categoría anterior y la tanda queda en borrador. ¿Revertir?')) return
                void accion('revertir', async () => { const n = await revertirTanda(id); return `Tanda revertida: ${n} ${n === 1 ? 'jugador volvió' : 'jugadores volvieron'} a su categoría anterior.` })
              }}>
              {ocupado !== 'revertir' && <RotateCcw className="h-4 w-4" aria-hidden />} Revertir
            </Button>
          )}
          <Button variante="peligro" cargando={ocupado === 'eliminar'} aria-label="Eliminar tanda" title="Eliminar tanda"
            onClick={async () => {
              const txt = borrador ? '¿Eliminar la tanda y todos sus cambios cargados?' : 'Se borra la tanda del historial. Las categorías de los jugadores quedan como están. ¿Eliminar?'
              if (!confirm(txt)) return
              setOcupado('eliminar')
              try { await eliminarTanda(id); onVolver() } catch (e) { setMsg({ tipo: 'error', txt: err(e) }); setOcupado(null) }
            }}>
            {ocupado !== 'eliminar' && <Trash2 className="h-4 w-4" aria-hidden />}
          </Button>
        </div>
      </header>

      {!borrador && <div className="mb-4"><Alerta tipo="info">La tanda está aplicada: las categorías ya se actualizaron en el padrón. Para modificarla, revertila.</Alerta></div>}
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.txt}</Alerta></div>}
      {conflictos.length > 0 && (
        <div className="mb-4">
          <Alerta tipo="aviso">
            {conflictos.length === 1 ? 'Un jugador cambió' : `${conflictos.length} jugadores cambiaron`} de categoría desde que se cargó en la tanda. Corregilos (abajo, marcados en ámbar) antes de aplicar.
          </Alerta>
        </div>
      )}

      {borrador && <Agregar padron={padron} enTanda={new Set(movs.map((m) => m.jugadorId).filter(Boolean) as string[])} ocupado={ocupado === 'agregar'}
        onAgregar={(j, nueva) => accion('agregar', async () => {
          await agregarMovimiento(id, j, nueva)
          return `${nombrePropio(j.nombre)}: ${j.categoria} → ${nueva} (${tipoMovimiento(j.categoria, nueva) === 'ascenso' ? 'ascenso' : 'recategorización'}).`
        })} />}

      {!movs.length ? (
        <Vacio titulo="La tanda está vacía">Buscá un jugador y elegí su categoría nueva. Si baja el número (7ma → 6ta) es un ascenso; si sube (6ta → 7ma), una recategorización.</Vacio>
      ) : (
        <div className="space-y-6">
          {(['ascenso', 'recategorizacion'] as const).map((tipo) => {
            const gs = grupos.filter((g) => g.tipo === tipo)
            if (!gs.length) return null
            return (
              <section key={tipo}>
                <h2 className="mb-1 font-display text-2xl font-bold text-noche">{tipo === 'ascenso' ? 'Ascensos' : 'Recategorizaciones'}</h2>
                <p className="mb-3 text-xs text-noche/60">
                  {tipo === 'ascenso' ? 'Imagen de felicitaciones por categoría.' : 'Imagen informativa por categoría.'} Compartí cada una con el botón de su encabezado.
                </p>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {gs.map((g) => {
                    const clave = `${g.tipo}:${g.categoria}`
                    return (
                      <section key={clave} className="flex flex-col overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
                        <EncabezadoCard titulo={g.categoria} cantidad={g.movimientos.length} colapsada={colapsada(clave)} onAlternar={() => alternar(clave)}
                          onCompartir={() => void compartir(clave, [g], `${tipo === 'ascenso' ? 'Ascensos' : 'Recategorización'} ${g.categoria}`)}
                          generando={generando === clave} clase={ESTILO_CATEGORIA[rama(g.categoria)].etiqueta} />
                        {!colapsada(clave) && (
                          <ul>
                            {g.movimientos.map((m) => (
                              <Fila key={m.id} m={m} borrador={borrador} ocupado={ocupado === m.id}
                                onCambiar={(c) => accion(m.id, () => cambiarMovimiento(m.id, c))}
                                onQuitar={() => accion(m.id, async () => { await quitarMovimiento(m.id); return `${nombrePropio(m.nombre)} se quitó de la tanda.` })} />
                            ))}
                          </ul>
                        )}
                      </section>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <ModalTanda abierto={editando} inicial={{ nombre: tanda.nombre, vigencia: tanda.vigencia }} onCerrar={() => setEditando(false)}
        onGuardar={async (nombre, vigencia) => { await editarTanda(id, nombre, vigencia); setEditando(false); await refrescar() }} />
    </>
  )
}

/** Buscador de jugador + categoría nueva */
function Agregar({ padron, enTanda, ocupado, onAgregar }: {
  padron: JugadorBase[]; enTanda: Set<string>; ocupado: boolean
  onAgregar: (j: { id: string; nombre: string; categoria: CategoriaJugador }, nueva: CategoriaJugador) => Promise<void>
}) {
  const [texto, setTexto] = useState('')
  const [nueva, setNueva] = useState('')
  const porNombre = useMemo(() => new Map(padron.map((j) => [nombrePropio(j.nombre), j])), [padron])
  // solo se ofrecen los que tienen categoría y no están ya en la tanda
  const opciones = useMemo(() => padron.filter((j) => j.categoria && !enTanda.has(j.id)).map((j) => nombrePropio(j.nombre)), [padron, enTanda])
  const elegido = porNombre.get(texto) ?? null
  const destinos = elegido?.categoria ? destinosPosibles(elegido.categoria) : []
  useEffect(() => { setNueva('') }, [elegido?.id])

  let aviso = ''
  if (elegido && !elegido.categoria) aviso = 'No tiene categoría asignada: asignásela primero en la pestaña Categorías.'
  else if (elegido && enTanda.has(elegido.id)) aviso = 'Ya está en esta tanda.'

  const valida = !!elegido?.categoria && !enTanda.has(elegido.id) && destinos.includes(nueva as CategoriaJugador)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!valida || !elegido?.categoria) return
    await onAgregar({ id: elegido.id, nombre: elegido.nombre, categoria: elegido.categoria }, nueva as CategoriaJugador)
    setTexto(''); setNueva('')
  }
  const tipo = elegido?.categoria && destinos.includes(nueva as CategoriaJugador) ? tipoMovimiento(elegido.categoria, nueva as CategoriaJugador) : null

  return (
    <form onSubmit={enviar} className="mb-6 rounded-xl bg-white p-4 ring-1 ring-noche/10">
      <h2 className="mb-3 font-display text-xl font-bold text-noche">Agregar cambio de categoría</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <div>
          <span className="mb-1 flex items-center gap-2 text-sm font-medium text-noche">
            Jugador {elegido && <BadgeCategoriaJugador categoria={elegido.categoria} />}
          </span>
          <SelectorJugador valor={texto} onChange={setTexto} padron={opciones} permitirNuevo={false} placeholder="Buscá un jugador del padrón" />
        </div>
        <Field label="Categoría nueva">
          <Select value={nueva} onChange={(e) => setNueva(e.target.value)} disabled={!destinos.length}>
            <option value="">{elegido ? 'Elegí…' : '—'}</option>
            {destinos.map((c) => <option key={c} value={c}>{c} ({tipoMovimiento(elegido!.categoria!, c) === 'ascenso' ? 'asciende' : 'recategoriza'})</option>)}
          </Select>
        </Field>
        <Button type="submit" disabled={!valida} cargando={ocupado}>{!ocupado && <Plus className="h-4 w-4" aria-hidden />} Agregar</Button>
      </div>
      {aviso && <p className="mt-2 text-xs text-amber-800">{aviso}</p>}
      {tipo && (
        <p className={`mt-2 text-xs font-semibold ${tipo === 'ascenso' ? 'text-cancha' : 'text-noche/70'}`}>
          {tipo === 'ascenso' ? 'Ascenso: sale en la imagen de felicitaciones.' : 'Recategorización: sale en la imagen informativa.'}
        </p>
      )}
    </form>
  )
}

/** Un jugador de la tanda: anterior → nueva, con cambio de categoría y quitar (solo en borrador) */
function Fila({ m, borrador, ocupado, onCambiar, onQuitar }: {
  m: Movimiento; borrador: boolean; ocupado: boolean
  onCambiar: (c: { nueva?: CategoriaJugador; anterior?: CategoriaJugador }) => void; onQuitar: () => void
}) {
  const conflicto = borrador && (!m.enPadron || m.actual !== m.anterior)
  // si hoy tiene otra categoría de la misma rama (distinta de la nueva), se puede tomar esa como "anterior"
  const puedeUsarActual = conflicto && m.actual && rama(m.actual) === rama(m.nueva) && m.actual !== m.nueva
  return (
    <li className={`border-b border-noche/5 px-3 py-2 ${conflicto ? 'bg-amber-50' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-noche" title={nombrePropio(m.nombre)}>{nombrePropio(m.nombre)}</span>
        <span className="num inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-noche/60">
          {num(m.anterior)} <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
        {borrador ? (
          <select value={m.nueva} disabled={ocupado} onChange={(e) => onCambiar({ nueva: e.target.value as CategoriaJugador })}
            aria-label={`Categoría nueva de ${nombrePropio(m.nombre)}`}
            className="w-[5.5rem] shrink-0 rounded-md border-0 bg-white py-1 pl-2 pr-6 text-xs font-semibold text-noche ring-1 ring-inset ring-noche/15 focus:ring-2 focus:ring-cancha disabled:opacity-50">
            {destinosPosibles(m.anterior).map((c) => <option key={c} value={c}>{num(c)}</option>)}
          </select>
        ) : (
          <span className="shrink-0 rounded-md bg-cancha px-2 py-0.5 text-xs font-bold text-white">{num(m.nueva)}</span>
        )}
        {borrador && (
          <button onClick={onQuitar} disabled={ocupado} aria-label={`Quitar a ${nombrePropio(m.nombre)} de la tanda`} title="Quitar de la tanda"
            className="shrink-0 rounded-md p-1 text-noche/40 hover:bg-red/5 hover:text-red disabled:opacity-50">
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
      {conflicto && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-amber-900">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          {!m.enPadron ? 'Ya no está en el padrón: quitalo de la tanda.' : `Hoy es ${m.actual ?? 'sin categoría'} (se cargó como ${m.anterior}).`}
          {puedeUsarActual && <button onClick={() => onCambiar({ anterior: m.actual! })} disabled={ocupado} className="font-semibold underline">Tomar {num(m.actual!)} como anterior</button>}
          {m.enPadron && m.actual === m.nueva && 'Ya tiene la categoría nueva: quitalo de la tanda.'}
        </p>
      )}
    </li>
  )
}
