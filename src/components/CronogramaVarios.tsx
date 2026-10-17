import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, CloudUpload, Download, FileText, Loader2, Plus, Printer, RefreshCw, Search, Share2 } from 'lucide-react'
import { cargarVarios, escucharGuardado, estadoGuardado, guardar, listar, vaciar, type EstadoGuardado, type ResumenTorneo } from '../lib/almacen'
import { docWord, encabezadoVarios, filasCronogramaVarios, htmlCronogramaVarios, logoPng, nombresVarios, superposiciones } from '../lib/cronograma'
import { estadoTorneo, resolverTorneo, type Partido } from '../lib/resultados'
import { diaCorto, diaLargo, hoyLocal, type Categoria, type Horario, type Resultado } from '../lib/torneo'
import { normalizarTexto } from '../lib/publico'
import { logoUrl } from '../App'
import { Alerta, Button, Card, Input, Select, Spinner, Vacio } from './ui'
import { CargaPartido } from './pasos/Partidos'

// Colores del documento (los de la marca del complejo, iguales al cronograma de cada torneo)
const COLORES = { oscuro: '#042D29', acento: '#C8DC3C', suave: '#F2F6F4' }
/** NODO: sede única con 3 canchas */
const CANCHAS = 3
/** cada cuánto se traen los resultados que cargaron otros (si no hay nada sin subir) */
const REFRESCO_MS = 60 * 1000
/** cuánto queda a la vista un partido recién cargado en el filtro "Pendientes" */
const RECIENTE_MS = 3500

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const tituloDia = (f: string) => `${diaLargo(f)} de ${MESES[Number(f.slice(5, 7)) - 1]}`

type Vista = 'pendientes' | 'todos' | 'jugados'
interface Item {
  id: string            // `${torneo}|${tipo}|${key}`
  cat: Categoria
  p: Partido
  horario: Horario | undefined
  fecha: string
  hora: string
  orden: number
}

/** partido con resultado ya cargado y válido */
const jugado = (p: Partido) => p.estado === 'jugado'
/** partidos "de verdad" del torneo (sin los bye del cuadro) */
const partidosDe = (c: Categoria) => {
  const res = resolverTorneo(c)
  return { zonas: res.zonas.flatMap((z) => z.partidos), playoff: (res.playoff ?? []).flat().filter((p) => !p.bye) }
}
const faltan = (c: Categoria) => { const { zonas, playoff } = partidosDe(c); return [...zonas, ...playoff].filter((p) => !jugado(p)).length }
/** torneos que entran solos: pendientes o en curso con algún partido sin resultado */
const activo = (c: Categoria) => { const e = estadoTorneo(c); return (e === 'pendiente' || e === 'en_curso') && faltan(c) > 0 }
/** orden por defecto de los torneos (desempata los partidos a igual horario) */
const porFecha = (a: Categoria, b: Categoria) =>
  (a.fechaInicio || '9999').localeCompare(b.fechaInicio || '9999') || (a.torneo || '').localeCompare(b.torneo || '', 'es')

/** mismo orden que el PDF del cronograma (filasCronogramaVarios): día, hora y, a igual horario, torneo y partido */
const ordenar = (x: Item, y: Item) =>
  (x.fecha ? 0 : 1) - (y.fecha ? 0 : 1) || x.fecha.localeCompare(y.fecha) ||
  (x.hora ? 0 : 1) - (y.hora ? 0 : 1) || x.hora.localeCompare(y.hora) || x.orden - y.orden

function itemsDe(cats: Categoria[]): Item[] {
  const out: Item[] = []
  cats.forEach((c, i) => {
    const { zonas, playoff } = partidosDe(c)
    let orden = 0
    const add = (p: Partido, h: Horario | undefined, base: number) =>
      out.push({ id: `${c.id}|${p.tipo}|${p.key}`, cat: c, p, horario: h, fecha: h?.fecha ?? '', hora: h?.hora ?? '', orden: i * 100000 + base + orden++ })
    for (const p of zonas) add(p, c.horariosZona[p.key], 0)
    for (const p of playoff) add(p, c.horariosPlayoff[p.key], 1000)
  })
  return out.sort(ordenar)
}

function useEstadoGuardado() {
  const [e, setE] = useState(estadoGuardado)
  useEffect(() => escucharGuardado((estado, error) => setE({ estado, error })), [])
  return e
}

function IndicadorGuardado({ estado, error }: { estado: EstadoGuardado; error: string }) {
  if (estado === 'error') {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red" title={error}><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> No se pudo guardar · reintentando</span>
  }
  if (estado === 'guardado') return <span className="inline-flex items-center gap-1 text-xs text-noche/50"><Check className="h-3.5 w-3.5" aria-hidden /> Guardado</span>
  return (
    <span className="inline-flex items-center gap-1 text-xs text-noche/60">
      {estado === 'guardando' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CloudUpload className="h-3.5 w-3.5" aria-hidden />} Guardando…
    </span>
  )
}

/**
 * Cronograma unificado (#/admin/cronograma): todos los partidos de los torneos pendientes / en curso,
 * en orden de día y horario (el mismo orden del PDF), con el PDF para compartir y la carga de resultados.
 */
export default function CronogramaVarios() {
  // torneos del cronograma (en orden: desempata a igual horario) y cuáles están tildados
  const [cats, setCats] = useState<Categoria[] | null>(null)
  const [tildados, setTildados] = useState<Set<string>>(new Set())
  const [todos, setTodos] = useState<ResumenTorneo[]>([])
  const [error, setError] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [trayendo, setTrayendo] = useState(false)
  const guardado = useEstadoGuardado()
  useEffect(() => { logoPng(logoUrl()).then(setLogo) }, [])

  // ---------------------------------------------------------------- carga inicial
  useEffect(() => {
    let vigente = true
    ;(async () => {
      const lista = await listar()
      // se leen completos los que no están terminados: el estado y los partidos sin resultado se calculan en la app
      const candidatos = lista.filter((t) => t.estado !== 'finalizado' && t.estado !== 'cancelado').map((t) => t.id)
      const leidos = candidatos.length ? await cargarVarios(candidatos) : []
      const activos = leidos.filter(activo).sort(porFecha)
      if (!vigente) return
      setTodos(lista)
      setCats(activos)
      setTildados(new Set(activos.map((c) => c.id)))
    })().catch((e) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron leer los torneos.') })
    return () => { vigente = false }
  }, [])

  // aviso al cerrar la pestaña con cambios sin subir
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (estadoGuardado().estado !== 'guardado') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', f)
    return () => window.removeEventListener('beforeunload', f)
  }, [])

  // ---------------------------------------------------------------- traer lo que cargaron otros
  const catsRef = useRef<Categoria[] | null>(null)
  catsRef.current = cats
  const traer = useCallback(async () => {
    const actuales = catsRef.current
    if (!actuales?.length) return
    await vaciar()
    const nuevos = await cargarVarios(actuales.map((c) => c.id))
    const m = new Map(nuevos.map((c) => [c.id, c]))
    // si mientras tanto se cargó algo acá, queda lo de acá (se sube en el próximo guardado)
    if (estadoGuardado().estado !== 'guardado') return
    setCats((cs) => (cs ? cs.map((c) => m.get(c.id) ?? c).filter((c) => m.has(c.id)) : cs))
  }, [])
  useEffect(() => {
    const auto = () => { if (document.visibilityState === 'visible' && estadoGuardado().estado === 'guardado') void traer().catch(() => { /* en el próximo */ }) }
    const t = setInterval(auto, REFRESCO_MS)
    document.addEventListener('visibilitychange', auto)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', auto) }
  }, [traer])
  async function traerAhora() {
    setTrayendo(true)
    try { await traer() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron traer los cambios.') } finally { setTrayendo(false) }
  }

  // ---------------------------------------------------------------- cambios (resultado / reprogramar)
  const [recientes, setRecientes] = useState<Set<string>>(new Set())
  const cambiar = useCallback((id: string, f: (c: Categoria) => Categoria) => {
    setCats((cs) => cs && cs.map((c) => {
      if (c.id !== id) return c
      const n = { ...f(c), actualizado: Date.now() }
      guardar(n)
      return n
    }))
  }, [])
  const setResultado = (it: Item, r: Resultado | null) => {
    const campo = it.p.tipo === 'zona' ? 'resultadosZona' : 'resultadosPlayoff'
    cambiar(it.cat.id, (c) => {
      const nuevo = { ...c[campo] }
      if (r) nuevo[it.p.key] = r
      else delete nuevo[it.p.key]
      return { ...c, [campo]: nuevo }
    })
    if (r) {
      setRecientes((s) => new Set(s).add(it.id))
      setTimeout(() => setRecientes((s) => { const n = new Set(s); n.delete(it.id); return n }), RECIENTE_MS)
    }
  }
  const setHorario = (it: Item, h: Horario) => {
    const campo = it.p.tipo === 'zona' ? 'horariosZona' : 'horariosPlayoff'
    cambiar(it.cat.id, (c) => ({ ...c, [campo]: { ...c[campo], [it.p.key]: h } }))
  }

  // ---------------------------------------------------------------- torneos: tildar, ordenar, sumar
  const alternar = (id: string) => setTildados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const mover = (i: number, d: -1 | 1) => setCats((cs) => {
    if (!cs || i + d < 0 || i + d >= cs.length) return cs
    const n = [...cs]
    ;[n[i], n[i + d]] = [n[i + d], n[i]]
    return n
  })
  const [sumando, setSumando] = useState(false)
  const paraSumar = useMemo(() => todos.filter((t) => !cats?.some((c) => c.id === t.id))
    .sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')), [todos, cats])
  async function sumar(id: string) {
    if (!id) return
    setSumando(true)
    try {
      const [c] = await cargarVarios([id])
      if (c) { setCats((cs) => (cs ? [...cs, c] : [c])); setTildados((s) => new Set(s).add(c.id)) }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el torneo.') } finally { setSumando(false) }
  }

  // ---------------------------------------------------------------- PDF / imprimir / Word (todos los partidos de los tildados)
  const elegidos = useMemo(() => (cats ?? []).filter((c) => tildados.has(c.id)), [cats, tildados])
  const filas = useMemo(() => filasCronogramaVarios(elegidos), [elegidos])
  const enc = useMemo(() => (elegidos.length ? encabezadoVarios(elegidos) : null), [elegidos])
  const avisos = useMemo(() => superposiciones(filas, CANCHAS), [filas])
  const sinHorario = filas.filter((f) => !f.fecha || !f.hora).length
  const nombreArchivo = `Cronograma - ${(enc?.titulo ?? 'Torneos').replace(/[\\/:*?"<>|]+/g, '')}`

  // el PDF se arma de antemano: compartir tiene que ejecutarse enseguida después del toque
  const [pdf, setPdf] = useState<File | null>(null)
  useEffect(() => {
    let vigente = true
    setPdf(null)
    if (!elegidos.length || !filas.length) return
    const t = setTimeout(() => {
      import('../lib/cronogramaPdf')
        .then(({ pdfCronogramaVarios }) => { if (vigente) setPdf(new File([pdfCronogramaVarios(elegidos, logo, COLORES)], `${nombreArchivo}.pdf`, { type: 'application/pdf' })) })
        .catch(() => { /* sin PDF: quedan imprimir y Word */ })
    }, 400)
    return () => { vigente = false; clearTimeout(t) }
  }, [elegidos, logo, filas.length, nombreArchivo])
  const puedeCompartir = !!pdf && typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdf] })

  const bajar = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function compartirPdf() {
    if (!pdf) return
    if (!puedeCompartir) return bajar(pdf, pdf.name)
    try { await navigator.share({ files: [pdf], title: `Cronograma · ${enc?.titulo ?? ''}` }) } catch { /* canceló */ }
  }
  function imprimir() {
    const w = window.open('', '_blank')
    if (!w) return alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio.')
    w.document.open()
    w.document.write(htmlCronogramaVarios(elegidos, logo, COLORES))
    w.document.close()
    w.onload = () => setTimeout(() => w.print(), 300)
  }
  const word = () => bajar(docWord(htmlCronogramaVarios(elegidos, null, COLORES)), `${nombreArchivo}.doc`)

  // ---------------------------------------------------------------- lista para cargar (filtros solo de pantalla)
  const [vista, setVista] = useState<Vista>('pendientes')
  const [dia, setDia] = useState<string | null>(null)   // null = todavía sin elegir (arranca en hoy si hay partidos hoy)
  const [texto, setTexto] = useState('')
  const items = useMemo(() => itemsDe(elegidos), [elegidos])
  const dias = useMemo(() => [...new Set(items.map((i) => i.fecha))], [items])
  const hoy = hoyLocal()
  useEffect(() => { if (dia === null && items.length) setDia(dias.includes(hoy) ? hoy : '*') }, [dia, items.length, dias, hoy])
  const diaElegido = dia === null || (dia !== '*' && !dias.includes(dia)) ? '*' : dia

  const visibles = useMemo(() => {
    const q = normalizarTexto(texto)
    return items
      .filter((i) => vista === 'todos' || (vista === 'jugados' ? jugado(i.p) : !jugado(i.p) || recientes.has(i.id)))
      .filter((i) => diaElegido === '*' || i.fecha === diaElegido)
      .filter((i) => !q || normalizarTexto(`${i.p.etiquetaA} ${i.p.etiquetaB} ${i.cat.torneo}`).includes(q))
  }, [items, vista, diaElegido, texto, recientes])
  const cargados = items.filter((i) => jugado(i.p)).length
  const gruposDia = useMemo(() => {
    const g: { dia: string; items: Item[] }[] = []
    for (const i of visibles) {
      const ult = g[g.length - 1]
      if (ult && ult.dia === i.fecha) ult.items.push(i)
      else g.push({ dia: i.fecha, items: [i] })
    }
    return g
  }, [visibles])
  // mismo nombre de torneo que en el PDF (sin el final común "- Fecha 5", si lo hay)
  const corto = useMemo(() => nombresVarios(elegidos).corto, [elegidos])

  // ---------------------------------------------------------------- pantalla
  return (
    <>
      <header className="mb-5">
        <h1 className="flex items-center gap-2 font-display text-4xl font-bold leading-none text-noche">
          <CalendarDays className="h-8 w-8 text-cancha" aria-hidden /> Cronograma{enc && enc.titulo !== 'Cronograma de partidos' ? ` · ${enc.titulo}` : ''}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-noche/70">
          Partidos de los torneos pendientes y en curso, ordenados por día y horario (el mismo orden del PDF). Compartí el cronograma o cargá los resultados desde acá.
        </p>
      </header>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {!cats ? <Spinner texto="Armando el cronograma…" /> : (
        <div className="space-y-4">
          {/* ------------------------------------------------ torneos */}
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-noche/55">Torneos del cronograma</p>
              <label className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-cancha" aria-hidden />
                <Select value="" disabled={sumando || !paraSumar.length} onChange={(e) => void sumar(e.target.value)} className="py-1 text-sm" aria-label="Sumar torneo">
                  <option value="">{sumando ? 'Sumando…' : 'Sumar torneo…'}</option>
                  {paraSumar.map((t) => <option key={t.id} value={t.id}>{t.torneo || 'Torneo sin nombre'}{t.fechaInicio ? ` · ${diaCorto(t.fechaInicio)}` : ''}</option>)}
                </Select>
              </label>
            </div>
            {cats.length === 0 ? (
              <p className="text-sm text-noche/65">No hay torneos pendientes o en curso con partidos por jugar. Podés sumar uno a mano.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cats.map((c, i) => {
                  const on = tildados.has(c.id)
                  return (
                    <li key={c.id} className={`flex items-center gap-1 rounded-lg py-1 pl-2 pr-1 text-sm ring-1 ${on ? 'bg-cancha-suave ring-cancha/40' : 'bg-white text-noche/45 ring-noche/15'}`}>
                      <label className="flex cursor-pointer items-center gap-1.5 font-semibold">
                        <input type="checkbox" checked={on} onChange={() => alternar(c.id)} className="h-4 w-4 accent-[#0F6B57]" />
                        {c.torneo || 'Torneo sin nombre'}
                        <span className="num text-xs font-normal text-noche/55">· {faltan(c)} por jugar</span>
                      </label>
                      {cats.length > 1 && (
                        <span className="ml-1 flex">
                          <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover antes" title="Mover antes (a igual horario va primero)" className="rounded p-0.5 text-noche/45 hover:bg-white hover:text-cancha disabled:opacity-25"><ArrowLeft className="h-3.5 w-3.5" /></button>
                          <button onClick={() => mover(i, 1)} disabled={i === cats.length - 1} aria-label="Mover después" title="Mover después" className="rounded p-0.5 text-noche/45 hover:bg-white hover:text-cancha disabled:opacity-25"><ArrowRight className="h-3.5 w-3.5" /></button>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {cats.length > 1 && <p className="text-[11px] text-noche/50">El orden de los torneos define cuál va primero cuando dos partidos tienen el mismo horario.</p>}
          </Card>

          {!elegidos.length ? (
            cats.length > 0 && <Vacio titulo="No hay torneos tildados">Tildá al menos uno para ver sus partidos.</Vacio>
          ) : (
            <>
              {/* ------------------------------------------------ PDF */}
              <Card className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-auto text-sm text-noche/75">
                    <strong className="num">{filas.length}</strong> partidos{enc?.rango ? ` · ${enc.rango}` : ''} · <strong className="num">{cargados}</strong> con resultado
                  </p>
                  <button onClick={compartirPdf} disabled={!pdf}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#1FA855] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18914A] disabled:opacity-50">
                    <Share2 className="h-4 w-4" aria-hidden /> {puedeCompartir ? 'Compartir PDF' : 'Descargar PDF'}
                  </button>
                  {puedeCompartir && <Button variante="secundario" onClick={() => pdf && bajar(pdf, pdf.name)}><Download className="h-4 w-4" aria-hidden /> PDF</Button>}
                  <Button variante="secundario" onClick={imprimir} disabled={!filas.length}><Printer className="h-4 w-4" aria-hidden /> Imprimir</Button>
                  <Button variante="secundario" onClick={word} disabled={!filas.length}><FileText className="h-4 w-4" aria-hidden /> Word</Button>
                </div>
                {sinHorario > 0 && <Alerta tipo="aviso">{sinHorario} partido(s) no tienen día u horario: aparecen al final, en “Sin día asignado”.</Alerta>}
                {avisos.length > 0 && (
                  <Alerta tipo="aviso">
                    <p className="font-semibold">Revisá estos horarios (duración estimada: americano 45′, al mejor de 3 sets 1 h · {CANCHAS} canchas):</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
                  </Alerta>
                )}
              </Card>

              {/* ------------------------------------------------ filtros de la lista */}
              <div className="sticky top-[64px] z-20 -mx-4 space-y-2 bg-vidrio/95 px-4 py-2 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-noche/15">
                    {(['pendientes', 'todos', 'jugados'] as Vista[]).map((v) => (
                      <button key={v} onClick={() => setVista(v)}
                        className={`px-3 py-1.5 text-sm font-semibold capitalize ${vista === v ? 'bg-noche text-white' : 'bg-white text-noche/70 hover:bg-vidrio'}`}>{v}</button>
                    ))}
                  </div>
                  <label className="relative min-w-[11rem] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
                    <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar jugador…" className="py-1.5 pl-9" aria-label="Buscar jugador" />
                  </label>
                  <IndicadorGuardado {...guardado} />
                  <Button variante="secundario" className="py-1.5" cargando={trayendo} onClick={traerAhora}><RefreshCw className="h-4 w-4" aria-hidden /> Traer cambios</Button>
                </div>
                {dias.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {['*', ...dias].map((d) => (
                      <button key={d || 'sin'} onClick={() => setDia(d)}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${diaElegido === d ? 'bg-pelota text-noche ring-pelota' : 'bg-white text-noche/65 ring-noche/15 hover:bg-vidrio'}`}>
                        {d === '*' ? 'Todos los días' : !d ? 'Sin día' : d === hoy ? `Hoy · ${diaCorto(d)}` : diaCorto(d)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ------------------------------------------------ partidos */}
              {!visibles.length ? (
                <Vacio titulo={vista === 'pendientes' ? 'No quedan partidos por cargar' : 'No hay partidos con esos filtros'}>
                  {vista === 'pendientes' && cargados > 0 ? 'Todos los partidos de este filtro ya tienen resultado.' : null}
                </Vacio>
              ) : gruposDia.map((g) => (
                <section key={g.dia || 'sin'} className="space-y-2">
                  <h2 className="border-l-[6px] border-pelota pl-2 font-display text-xl font-bold text-noche">
                    {g.dia ? tituloDia(g.dia) : 'Sin día asignado'} <span className="text-xs font-normal text-noche/50">{g.items.length} partido{g.items.length === 1 ? '' : 's'}</span>
                  </h2>
                  <ul className="space-y-2">
                    {g.items.map((it) => (
                      <li key={it.id} className="flex gap-2">
                        <div className="w-14 shrink-0 pt-3 text-center">
                          <p className="num font-display text-lg font-bold leading-none text-noche">{it.hora || '—'}</p>
                          {recientes.has(it.id) && <Check className="mx-auto mt-1 h-4 w-4 text-emerald-600" aria-label="Cargado" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 truncate text-xs font-bold uppercase tracking-wide text-noche/60">{corto(it.cat)}</p>
                          <CargaPartido p={it.p} horario={it.horario} onGuardar={(r) => setResultado(it, r)} onHorario={(h) => setHorario(it, h)}
                            desde={it.cat.fechaInicio} hasta={it.cat.fechaFin} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
      )}
    </>
  )
}
