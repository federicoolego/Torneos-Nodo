// "Armar fecha": varios torneos que se juegan juntos (mismo fin de semana, mismas canchas).
// 1) torneos y canchas · 2) horarios de las parejas · 3) zonas por disponibilidad · 4) grilla de horarios automática
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Pencil, Plus, Shuffle, Sparkles, Trash2, Users, X } from 'lucide-react'
import { cargarVarios, guardar, listar, vaciar, type ResumenTorneo } from '../lib/almacen'
import { eliminarJornada, guardarJornada, listarJornadas, type Jornada } from '../lib/jornadas'
import {
  INSTANCIAS, LETRAS, MIN_PAREJAS, compararCercania, cuadroAutomatico, diaCorto, diasEntre, nombreEstado, nuevoId, rangoFechas, zonasArmadas,
  type Categoria, type Disponibilidad, type Instancia,
} from '../lib/torneo'
import { interpretarTexto } from '../lib/disponibilidad'
import { zonasBloqueadas } from '../lib/resultados'
import { ajustarConfig, armarContexto, diasDeTorneos, incompatiblesZona, jugadoresRepetidos, zonasPorDisponibilidad, type ConfigFecha, type DiaFecha, type Plan, type VentanaCancha } from '../lib/programador'
import { nombresVarios } from '../lib/cronograma'
import { Alerta, Badge, Button, Card, Field, Input, Modal, Select, Spinner, Tabs, Titulo, Vacio } from '../components/ui'
import { ChipDisponibilidad, EditorDisponibilidad } from '../components/Disponibilidad'
import { ProblemaHorario } from '../components/pasos/Datos'
import Grilla, { PALETA, planDesdeTorneos } from '../components/fecha/Grilla'

const activo = (t: ResumenTorneo) => t.estado === 'pendiente' || t.estado === 'en_curso'
/** del más cercano a jugarse al más lejano (mismo orden que la pestaña Torneos) */
const porCercania = (a: ResumenTorneo, b: ResumenTorneo) =>
  compararCercania({ inicio: a.fechaInicio, estado: a.estado, nombre: a.torneo }, { inicio: b.fechaInicio, estado: b.estado, nombre: b.torneo })

export default function Fechas() {
  const [lista, setLista] = useState<Jornada[] | null>(null)
  const [torneos, setTorneos] = useState<ResumenTorneo[]>([])
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<Jornada | null>(null)
  const [creando, setCreando] = useState(false)

  const refrescar = useCallback(async () => {
    try {
      const [js, ts] = await Promise.all([listarJornadas(), listar()])
      setLista(js)
      setTorneos(ts)
    } catch (e) {
      setLista([])
      const m = e instanceof Error ? e.message : String(e)
      setError(/torneos_nodo_jornadas|relation|schema cache/i.test(m)
        ? 'Falta crear la tabla de fechas en la base: corré supabase/torneos_nodo_fechas.sql en el SQL Editor de Supabase.'
        : `No se pudo leer la base: ${m}`)
    }
  }, [])
  useEffect(() => { void refrescar() }, [refrescar])

  if (abierta) return <EditorFecha key={abierta.id} inicial={abierta} todos={torneos} onVolver={() => { setAbierta(null); void refrescar() }} />

  const nombre = (id: string) => torneos.find((t) => t.id === id)
  // fechas, de la más cercana a jugarse a la más lejana (las ya jugadas al final, de la más reciente a la más vieja)
  const clave = (j: Jornada) => {
    const ts = j.torneos.map(nombre).filter((t): t is ResumenTorneo => !!t)
    return { inicio: ts.map((t) => t.fechaInicio).filter(Boolean).sort()[0] ?? '', estado: ts.some(activo) ? 'pendiente' as const : 'finalizado' as const, nombre: j.nombre }
  }
  const ordenadas = [...(lista ?? [])].sort((a, b) => compararCercania(clave(a), clave(b)))
  return (
    <>
      <Titulo bajada="Juntá los torneos que se juegan el mismo fin de semana: la app arma las zonas según los horarios de cada pareja y reparte todos los partidos en las canchas, sin choques. Vos revisás, movés lo que quieras y lo aplicás."
        accion={<Button onClick={() => setCreando(true)}><Plus className="h-4 w-4" aria-hidden /> Nueva fecha</Button>}>
        Armar fecha
      </Titulo>
      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {lista === null ? <Spinner /> : !lista.length ? (
        <Vacio titulo="Todavía no armaste ninguna fecha" accion={<Button onClick={() => setCreando(true)}><Plus className="h-4 w-4" aria-hidden /> Nueva fecha</Button>}>
          Primero creá cada torneo (categoría) con sus parejas, como siempre. Después juntalos acá.
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {ordenadas.map((j) => {
            const ts = j.torneos.map(nombre).filter((t): t is ResumenTorneo => !!t)
            const inicio = ts.map((t) => t.fechaInicio).filter(Boolean).sort()[0] ?? ''
            const fin = ts.map((t) => t.fechaFin).filter(Boolean).sort().reverse()[0] ?? ''
            return (
              <li key={j.id} className="rounded-xl bg-white p-4 ring-1 ring-noche/10">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setAbierta(j)} className="text-left">
                    <p className="font-display text-2xl font-bold leading-tight hover:text-cancha">{j.nombre || 'Fecha sin nombre'}</p>
                    <p className="text-sm text-noche/60">{rangoFechas(inicio, fin) || 'Sin fechas'} · {ts.length} torneo{ts.length === 1 ? '' : 's'}</p>
                  </button>
                  <button aria-label={`Eliminar ${j.nombre}`} title="Eliminar la fecha (los torneos no se tocan)" className="p-1 text-noche/40 hover:text-red"
                    onClick={async () => {
                      if (!confirm(`¿Eliminar la fecha “${j.nombre}”? Los torneos, zonas, horarios y resultados NO se borran.`)) return
                      try { await eliminarJornada(j.id); await refrescar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar.') }
                    }}><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ts.map((t) => <Badge key={t.id}>{t.torneo}</Badge>)}
                </div>
                <Button variante="secundario" className="mt-3" onClick={() => setAbierta(j)}><Pencil className="h-4 w-4" aria-hidden /> Abrir</Button>
              </li>
            )
          })}
        </ul>
      )}
      {creando && (
        <NuevaFecha torneos={torneos.filter(activo)} onCerrar={() => setCreando(false)}
          onCrear={async (j) => {
            try { await guardarJornada(j); setCreando(false); setAbierta(j) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear.') }
          }} />
      )}
    </>
  )
}

/** Final común de los nombres ("Fecha 5" de "8va Damas - Fecha 5", "7ma Damas - Fecha 5") */
function nombreSugerido(ts: ResumenTorneo[]): string {
  const partes = ts.map((t) => t.torneo.split(' - '))
  const ult = partes[0]?.[partes[0].length - 1] ?? ''
  if (ts.length > 1 && partes.every((p) => p.length > 1 && p[p.length - 1] === ult)) return ult
  const ini = ts.map((t) => t.fechaInicio).filter(Boolean).sort()[0]
  return ini ? `Fecha del ${diaCorto(ini)}` : ''
}

function NuevaFecha({ torneos, onCerrar, onCrear }: { torneos: ResumenTorneo[]; onCerrar: () => void; onCrear: (j: Jornada) => Promise<void> }) {
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [nombre, setNombre] = useState('')
  const [tocado, setTocado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const orden = [...torneos].sort(porCercania)
  const sel = orden.filter((t) => elegidos.has(t.id))
  const sugerido = nombreSugerido(sel)
  const alternar = (id: string) => setElegidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <Modal abierto titulo="Nueva fecha" onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-noche/70">Elegí los torneos que se juegan juntos (aparecen los pendientes y en curso).</p>
        {!orden.length ? <Alerta tipo="aviso">No hay torneos pendientes: crealos primero en la pestaña Torneos.</Alerta> : (
          <ul className="max-h-72 divide-y divide-noche/5 overflow-y-auto rounded-lg ring-1 ring-noche/10">
            {orden.map((t) => (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-vidrio">
                  <input type="checkbox" checked={elegidos.has(t.id)} onChange={() => alternar(t.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.torneo}</span>
                    <span className="block text-xs text-noche/55">{rangoFechas(t.fechaInicio, t.fechaFin) || 'Sin fechas'} · {t.parejas} parejas · {nombreEstado(t.estado)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <Field label="Nombre de la fecha">
          <Input value={tocado ? nombre : sugerido} onChange={(e) => { setTocado(true); setNombre(e.target.value) }} placeholder="Ej: Fecha 6" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button disabled={!sel.length} cargando={ocupado} onClick={async () => {
            setOcupado(true)
            try { await onCrear({ id: nuevoId(), nombre: (tocado ? nombre : sugerido).trim() || 'Fecha', torneos: sel.map((t) => t.id), config: {}, plan: null }) } finally { setOcupado(false) }
          }}>Crear fecha</Button>
        </div>
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------ editor de una fecha

type Paso = 'config' | 'parejas' | 'zonas' | 'horarios'

function EditorFecha({ inicial, todos, onVolver }: { inicial: Jornada; todos: ResumenTorneo[]; onVolver: () => void }) {
  const [j, setJ] = useState<Jornada>(inicial)
  const [cats, setCats] = useState<Categoria[] | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [paso, setPaso] = useState<Paso>('config')

  useEffect(() => {
    cargarVarios(inicial.torneos).then(setCats).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron leer los torneos.'))
  }, [inicial.torneos])

  // la fecha se guarda sola (configuración y grilla)
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) { primera.current = false; return }
    const t = setTimeout(() => { guardarJornada(j).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo guardar la fecha.')) }, 600)
    return () => clearTimeout(t)
  }, [j])

  const dias = useMemo(() => diasDeTorneos(cats ?? []), [cats])
  const cfg = useMemo(() => ajustarConfig(j.config, dias), [j.config, dias])
  const setCfg = (f: (c: ConfigFecha) => ConfigFecha) => setJ((x) => ({ ...x, config: f(ajustarConfig(x.config, dias)) }))
  const ctx = useMemo(() => armarContexto(cats ?? [], cfg), [cats, cfg])
  // grilla: la guardada o, si no hay, la de los horarios que ya tienen los torneos
  const plan: Plan = useMemo(() => j.plan ?? planDesdeTorneos(ctx), [j.plan, ctx])

  const cambiarCat = useCallback((id: string, f: (c: Categoria) => Categoria) => {
    setCats((cs) => cs && cs.map((c) => {
      if (c.id !== id) return c
      const n = { ...f(c), actualizado: Date.now() }
      guardar(n)
      return n
    }))
  }, [])

  const { corto } = useMemo(() => nombresVarios(cats ?? []), [cats])
  const colorDe = useCallback((id: string) => PALETA[Math.max(0, (cats ?? []).findIndex((c) => c.id === id)) % PALETA.length], [cats])
  const cortoDe = useCallback((id: string) => { const c = (cats ?? []).find((x) => x.id === id); return c ? corto(c) : '' }, [cats, corto])

  async function quitarTorneo(id: string) {
    setJ((x) => ({ ...x, torneos: x.torneos.filter((t) => t !== id), plan: x.plan && Object.fromEntries(Object.entries(x.plan).filter(([k]) => !k.startsWith(`${id}|`))) }))
    setCats((cs) => cs && cs.filter((c) => c.id !== id))
  }
  async function sumarTorneo(id: string) {
    if (!id) return
    try {
      const [c] = await cargarVarios([id])
      if (!c) return
      setCats((cs) => [...(cs ?? []), c])
      setJ((x) => ({ ...x, torneos: [...x.torneos, id] }))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el torneo.') }
  }

  async function aplicar() {
    if (!cats) return
    let n = 0
    const nuevos = cats.map((c) => {
      const hz = { ...c.horariosZona }, hp = { ...c.horariosPlayoff }
      let cambio = false
      for (const t of ctx.tareas) {
        if (t.torneoId !== c.id || t.jugado) continue
        const a = plan[t.id]
        if (!a?.fecha || !a.hora) continue
        const h = { fecha: a.fecha, hora: a.hora, ...(a.cancha ? { cancha: String(a.cancha) } : {}) }
        if (t.tipo === 'zona') hz[t.key] = h
        else hp[t.key] = h
        n++
        cambio = true
      }
      if (!cambio) return c
      const cuadro = c.cuadro ?? ctx.cuadros[c.id] ?? null
      const nc = { ...c, horariosZona: hz, horariosPlayoff: hp, cuadro, actualizado: Date.now() }
      guardar(nc)
      return nc
    })
    setCats(nuevos)
    await vaciar()
    // la grilla queda como lo aplicado
    setJ((x) => ({ ...x, plan }))
    setMsg(`Listo: se cargaron ${n} partidos con día, hora y cancha. Ya los ves en cada torneo y en la pestaña Partidos. Cuando quieras, publicá cada torneo.`)
  }

  if (error && !cats) return <Alerta tipo="error">{error}</Alerta>
  if (!cats) return <Spinner texto="Leyendo los torneos de la fecha…" />

  const paraSumar = todos.filter((t) => activo(t) && !j.torneos.includes(t.id)).sort(porCercania)
  const pasos: { id: Paso; label: string }[] = [
    { id: 'config', label: '1. Torneos y canchas' }, { id: 'parejas', label: '2. Horarios de las parejas' },
    { id: 'zonas', label: '3. Zonas' }, { id: 'horarios', label: '4. Grilla de partidos' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variante="secundario" onClick={async () => { await vaciar(); await guardarJornada(j).catch(() => undefined); onVolver() }}><ArrowLeft className="h-4 w-4" aria-hidden /> Fechas</Button>
          <h1 className="font-display text-3xl font-bold leading-none">{j.nombre || 'Fecha'}</h1>
        </div>
        <span className="text-sm text-noche/60">{rangoFechas(dias[0] ?? '', dias[dias.length - 1] ?? '')}</span>
      </div>
      {error && <Alerta tipo="error">{error}</Alerta>}
      {msg && <Alerta tipo="ok">{msg}</Alerta>}
      <Tabs opciones={pasos} valor={paso} onChange={(p) => { setMsg(''); setPaso(p) }} />

      {paso === 'config' && (
        <PasoConfig j={j} setJ={setJ} cats={cats} cfg={cfg} setCfg={setCfg} paraSumar={paraSumar} onQuitar={quitarTorneo} onSumar={sumarTorneo} colorDe={colorDe} />
      )}
      {paso === 'parejas' && <PasoParejas cats={cats} cambiarCat={cambiarCat} colorDe={colorDe} />}
      {paso === 'zonas' && (
        <PasoZonas cats={cats} cfg={cfg} colorDe={colorDe}
          onZonas={(id, zonas) => {
            cambiarCat(id, (c) => ({ ...c, zonas, cuadro: cuadroAutomatico(zonas), horariosZona: {}, horariosPlayoff: {} }))
            // la grilla de ese torneo ya no sirve
            setJ((x) => ({ ...x, plan: x.plan && Object.fromEntries(Object.entries(x.plan).filter(([k]) => !k.startsWith(`${id}|`))) }))
          }} />
      )}
      {paso === 'horarios' && (
        <>
          {ctx.sinZonas.length > 0 && <Alerta tipo="aviso">Sin zonas armadas (no entran en la grilla): {ctx.sinZonas.map((c) => c.torneo).join(', ')}. Armalas en el paso 3.</Alerta>}
          <Grilla ctx={ctx} cats={cats} plan={plan} onPlan={(p) => setJ((x) => ({ ...x, plan: p }))} onAplicar={aplicar} colorDe={colorDe} cortoDe={cortoDe} />
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ paso 1: torneos y canchas

function PasoConfig({ j, setJ, cats, cfg, setCfg, paraSumar, onQuitar, onSumar, colorDe }: {
  j: Jornada; setJ: (f: (x: Jornada) => Jornada) => void; cats: Categoria[]; cfg: ConfigFecha; setCfg: (f: (c: ConfigFecha) => ConfigFecha) => void
  paraSumar: ResumenTorneo[]; onQuitar: (id: string) => void; onSumar: (id: string) => void; colorDe: (id: string) => string
}) {
  const repetidos = jugadoresRepetidos(cats)
  const setDia = (fecha: string, campo: 'desde' | 'hasta', v: string) => setCfg((c) => ({ ...c, dias: c.dias.map((d) => (d.fecha === fecha ? { ...d, [campo]: v } : d)) }))
  // horario cancha por cancha: se activa por día; arranca con el horario que ya tenía el día
  const porCancha = (d: DiaFecha, n: number): VentanaCancha[] => Array.from({ length: n }, (_, i) => d.canchas?.[i] ?? { desde: d.desde, hasta: d.hasta })
  const activarPorCancha = (fecha: string, on: boolean) => setCfg((c) => ({
    ...c,
    dias: c.dias.map((d) => {
      if (d.fecha !== fecha) return d
      if (!on) { const { canchas: _quitadas, ...resto } = d; return resto }
      return { ...d, canchas: porCancha(d, c.canchas) }
    }),
  }))
  const setCancha = (fecha: string, ci: number, cambio: Partial<VentanaCancha>) => setCfg((c) => ({
    ...c,
    dias: c.dias.map((d) => (d.fecha === fecha ? { ...d, canchas: porCancha(d, c.canchas).map((w, i) => (i === ci ? { ...w, ...cambio } : w)) } : d)),
  }))
  const setDur = (i: Instancia, v: number) => setCfg((c) => ({ ...c, duraciones: { ...c.duraciones, [i]: v } }))
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4">
        <Field label="Nombre de la fecha"><Input value={j.nombre} onChange={(e) => setJ((x) => ({ ...x, nombre: e.target.value }))} /></Field>
        <div>
          <p className="mb-1.5 text-sm font-medium">Torneos ({cats.length})</p>
          <ul className="divide-y divide-noche/5 rounded-lg ring-1 ring-noche/10">
            {cats.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorDe(c.id) }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.torneo}</span>
                  <span className="text-xs text-noche/55">{rangoFechas(c.fechaInicio, c.fechaFin)} · {c.parejas.length} parejas{c.parejas.length < MIN_PAREJAS ? ` (mínimo ${MIN_PAREJAS})` : ''}</span>
                </span>
                <button onClick={() => onQuitar(c.id)} className="p-1 text-noche/40 hover:text-red" aria-label={`Sacar ${c.torneo} de la fecha`} title="Sacar de la fecha (el torneo no se borra)"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          {paraSumar.length > 0 && (
            <Select className="mt-2 text-sm" value="" onChange={(e) => onSumar(e.target.value)}>
              <option value="">+ Sumar otro torneo…</option>
              {paraSumar.map((t) => <option key={t.id} value={t.id}>{t.torneo} ({rangoFechas(t.fechaInicio, t.fechaFin)})</option>)}
            </Select>
          )}
        </div>
        {repetidos.length > 0 && (
          <div className="rounded-lg bg-cancha-suave/60 p-3 text-sm ring-1 ring-cancha/15">
            <p className="mb-1 flex items-center gap-2 font-semibold"><Users className="h-4 w-4" aria-hidden /> Juegan en más de una categoría</p>
            <ul className="space-y-0.5 text-xs">{repetidos.map((r) => <li key={r.nombre}><strong>{r.nombre}</strong>: {r.torneos.join(' y ')}</li>)}</ul>
            <p className="mt-1 text-xs text-noche/60">Se tiene en cuenta solo: nunca les tocan dos partidos a la vez.</p>
          </div>
        )}
      </Card>
      <Card className="space-y-4">
        <Field label="Canchas disponibles">
          <Select value={cfg.canchas} onChange={(e) => setCfg((c) => ({ ...c, canchas: Number(e.target.value) }))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} cancha{n === 1 ? '' : 's'}</option>)}
          </Select>
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium">Horario de las canchas</p>
          <p className="mb-2 text-xs text-noche/60">Desde la hora del primer partido hasta la hora en que tiene que terminar el último (00:00 = medianoche). Si las canchas no abren y cierran a la misma hora, activá “Cancha por cancha” en ese día.</p>
          {!cfg.dias.length ? <Alerta tipo="aviso">Los torneos no tienen fechas cargadas.</Alerta> : (
            <ul className="space-y-2.5">
              {cfg.dias.map((d) => {
                const porC = !!d.canchas?.length
                return (
                  <li key={d.fecha} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-24 shrink-0 whitespace-nowrap font-display text-base font-semibold">{diaCorto(d.fecha)}</span>
                      {!porC && (
                        <>
                          <Input type="time" step={900} value={d.desde} onChange={(e) => setDia(d.fecha, 'desde', e.target.value)} className="!w-28 py-1.5" aria-label="Desde" />
                          <span className="text-noche/55">a</span>
                          <Input type="time" step={900} value={d.hasta} onChange={(e) => setDia(d.fecha, 'hasta', e.target.value)} className="!w-28 py-1.5" aria-label="Hasta" />
                        </>
                      )}
                      <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-noche/70">
                        <input type="checkbox" checked={porC} onChange={(e) => activarPorCancha(d.fecha, e.target.checked)} /> Cancha por cancha
                      </label>
                    </div>
                    {porC && (
                      <ul className="mt-1.5 space-y-1.5 border-l-2 border-cancha/25 pl-3">
                        {d.canchas!.map((w, ci) => (
                          <li key={ci} className="flex flex-wrap items-center gap-2">
                            <span className="w-20 shrink-0 text-xs font-semibold text-noche/70">Cancha {ci + 1}</span>
                            <Input type="time" step={900} value={w.desde} disabled={w.cerrada} onChange={(e) => setCancha(d.fecha, ci, { desde: e.target.value })} className="!w-28 py-1.5 disabled:opacity-40" aria-label={`Cancha ${ci + 1} desde`} />
                            <span className="text-noche/55">a</span>
                            <Input type="time" step={900} value={w.hasta} disabled={w.cerrada} onChange={(e) => setCancha(d.fecha, ci, { hasta: e.target.value })} className="!w-28 py-1.5 disabled:opacity-40" aria-label={`Cancha ${ci + 1} hasta`} />
                            <label className="flex cursor-pointer items-center gap-1 text-xs text-noche/60">
                              <input type="checkbox" checked={!!w.cerrada} onChange={(e) => setCancha(d.fecha, ci, { cerrada: e.target.checked })} /> No se usa
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Duración de los partidos (minutos)</p>
          <div className="grid grid-cols-3 gap-2">
            {INSTANCIAS.map((i) => (
              <label key={i.id} className="block text-xs text-noche/70">{i.nombre}
                <Input type="number" min={20} max={180} step={5} value={cfg.duraciones[i.id]} onChange={(e) => setDur(i.id, Math.max(20, Number(e.target.value) || 45))} className="mt-0.5 py-1.5" />
              </label>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descanso entre partidos" hint="Minutos libres entre dos partidos de una misma pareja.">
            <Input type="number" min={0} max={120} step={5} value={cfg.descanso} onChange={(e) => setCfg((c) => ({ ...c, descanso: Math.max(0, Number(e.target.value) || 0) }))} />
          </Field>
          <Field label="Antes del playoff" hint="Minutos entre el final de una zona y el playoff de sus clasificados.">
            <Input type="number" min={0} max={240} step={5} value={cfg.margenPlayoff} onChange={(e) => setCfg((c) => ({ ...c, margenPlayoff: Math.max(0, Number(e.target.value) || 0) }))} />
          </Field>
        </div>
      </Card>
    </div>
  )
}

// ------------------------------------------------------------------ paso 2: horarios de las parejas

function PasoParejas({ cats, cambiarCat, colorDe }: { cats: Categoria[]; cambiarCat: (id: string, f: (c: Categoria) => Categoria) => void; colorDe: (id: string) => string }) {
  const [editando, setEditando] = useState<{ cat: string; pareja: string } | null>(null)
  const [msg, setMsg] = useState('')
  const sinCargar = cats.flatMap((c) => c.parejas.filter((p) => p.horario?.trim() && !p.disponibilidad).map((p) => ({ c, p })))
  const setDisp = (catId: string, parejaId: string, d: Disponibilidad | undefined) =>
    cambiarCat(catId, (c) => ({ ...c, parejas: c.parejas.map((p) => (p.id === parejaId ? { ...p, disponibilidad: d } : p)) }))

  function interpretarTodos() {
    let ok = 0, no = 0
    for (const c of cats) {
      const dias = diasEntre(c.fechaInicio, c.fechaFin)
      const nuevas = c.parejas.map((p) => {
        if (!p.horario?.trim() || p.disponibilidad) return p
        const d = interpretarTexto(p.horario, dias)
        if (d) { ok++; return { ...p, disponibilidad: d } }
        no++
        return p
      })
      if (nuevas.some((p, i) => p !== c.parejas[i])) cambiarCat(c.id, (x) => ({ ...x, parejas: nuevas }))
    }
    setMsg(`Se interpretaron ${ok} pedido(s).${no ? ` ${no} no se entendieron: cargalos a mano (o marcá “Puede cualquier día y horario”).` : ''} Revisá que estén bien.`)
  }

  const cat = editando ? cats.find((c) => c.id === editando.cat) : undefined
  const pareja = cat?.parejas.find((p) => p.id === editando?.pareja)
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-noche/75">
          Revisá los días y horarios de cada pareja (se cargan al inscribirla) y corregí lo que haga falta tocando la pareja.
          {sinCargar.length > 0 && ' Las parejas cargadas antes, con el horario escrito en texto libre, se pasan solas con “Interpretar”.'}
        </p>
        {sinCargar.length > 0 && <Button onClick={interpretarTodos}><Sparkles className="h-4 w-4" aria-hidden /> Interpretar los {sinCargar.length} sin cargar</Button>}
      </Card>
      {msg && <Alerta tipo="info">{msg}</Alerta>}
      <div className="grid gap-4 lg:grid-cols-2">
        {cats.map((c) => {
          const dias = diasEntre(c.fechaInicio, c.fechaFin)
          return (
            <section key={c.id} className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
              <h3 className="px-4 py-2 font-display text-lg font-bold text-white" style={{ background: colorDe(c.id) }}>{c.torneo}</h3>
              <ul className="divide-y divide-noche/5">
                {c.parejas.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => setEditando({ cat: c.id, pareja: p.id })} className="flex w-full items-start gap-2 px-4 py-2 text-left hover:bg-vidrio">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{p.nombre}</span>
                        {p.horario && <span className="block text-xs text-noche/55">“{p.horario}”</span>}
                        <span className="mt-0.5 block"><ChipDisponibilidad valor={p.disponibilidad} dias={dias} texto={p.horario} /></span>
                      </span>
                      <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-noche/40" aria-hidden />
                    </button>
                  </li>
                ))}
                {!c.parejas.length && <li className="px-4 py-3 text-sm text-noche/55">Sin parejas inscriptas.</li>}
              </ul>
            </section>
          )
        })}
      </div>
      {cat && pareja && (
        <Modal abierto titulo={pareja.nombre} onCerrar={() => setEditando(null)}>
          <EditorDisponibilidad valor={pareja.disponibilidad} dias={diasEntre(cat.fechaInicio, cat.fechaFin)} texto={pareja.horario?.trim() || undefined}
            onChange={(d) => setDisp(cat.id, pareja.id, d)} />
          <div className="mt-4 flex justify-end"><Button onClick={() => setEditando(null)}>Listo</Button></div>
        </Modal>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ paso 3: zonas

function PasoZonas({ cats, cfg, colorDe, onZonas }: { cats: Categoria[]; cfg: ConfigFecha; colorDe: (id: string) => string; onZonas: (id: string, zonas: string[][]) => void }) {
  const libres = cats.filter((c) => !zonasBloqueadas(c).some(Boolean) && c.parejas.length >= MIN_PAREJAS)
  function armarTodos() {
    const conHorarios = libres.filter((c) => Object.keys(c.horariosZona).length || Object.keys(c.horariosPlayoff).length)
    if (libres.some((c) => c.zonas.flat().length) && !confirm(`Se rearman las zonas de ${libres.length} torneo(s)${conHorarios.length ? ' y se borran sus horarios cargados' : ''}. ¿Continuar?`)) return
    for (const c of libres) onZonas(c.id, zonasPorDisponibilidad(c, cfg))
  }
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-noche/75">
          Las zonas se arman juntando a las parejas que pueden jugar en los mismos días y horarios (zonas de 3 y de 4, como el sorteo).
          Si querés, después intercambiá parejas entre zonas. Los torneos que ya tienen resultados no se tocan.
        </p>
        <Button onClick={armarTodos} disabled={!libres.length}><Shuffle className="h-4 w-4" aria-hidden /> Armar zonas por horarios</Button>
      </Card>
      {cats.map((c) => <ZonasTorneo key={c.id} c={c} cfg={cfg} color={colorDe(c.id)} onZonas={(z) => onZonas(c.id, z)} />)}
    </div>
  )
}

function ZonasTorneo({ c, cfg, color, onZonas }: { c: Categoria; cfg: ConfigFecha; color: string; onZonas: (z: string[][]) => void }) {
  const bloqueado = zonasBloqueadas(c).some(Boolean)
  const dias = diasEntre(c.fechaInicio, c.fechaFin)
  const nombre = (id: string) => c.parejas.find((p) => p.id === id)?.nombre ?? '—'
  const armadas = zonasArmadas(c)
  const intercambiar = (a: string, b: string) => {
    if ((Object.keys(c.horariosZona).length || Object.keys(c.horariosPlayoff).length) && !confirm('Se borran los horarios cargados de este torneo (después se vuelven a armar en la grilla). ¿Continuar?')) return
    onZonas(c.zonas.map((z) => z.map((x) => (x === a ? b : x === b ? a : x))))
  }
  return (
    <section className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-white" style={{ background: color }}>
        <h3 className="font-display text-lg font-bold">{c.torneo} <span className="text-sm font-medium text-white/75">· {c.parejas.length} parejas</span></h3>
        {!bloqueado && c.parejas.length >= MIN_PAREJAS && (
          <button onClick={() => {
            if (c.zonas.flat().length && !confirm('Se rearman las zonas de este torneo (y se borran sus horarios cargados). ¿Continuar?')) return
            onZonas(zonasPorDisponibilidad(c, cfg))
          }} className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-1 text-xs font-semibold hover:bg-white/25"><Shuffle className="h-3.5 w-3.5" aria-hidden /> {armadas ? 'Rearmar' : 'Armar'}</button>
        )}
      </header>
      {bloqueado ? <p className="p-4 text-sm text-noche/60">Ya tiene resultados cargados: sus zonas no se modifican.</p>
        : c.parejas.length < MIN_PAREJAS ? <p className="p-4 text-sm text-noche/60">Necesita al menos {MIN_PAREJAS} parejas.</p>
        : !armadas ? <p className="p-4 text-sm text-noche/60">Sin zonas todavía: tocá “Armar”.</p> : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.zonas.map((z, zi) => {
              const malas = incompatiblesZona(c, z, cfg)
              return (
                <div key={zi} className={`rounded-lg ring-1 ${malas.length ? 'ring-amber-400' : 'ring-noche/10'}`}>
                  <p className="border-b border-noche/5 px-3 py-1.5 font-display text-base font-bold">Zona {LETRAS[zi]}</p>
                  <ol className="divide-y divide-noche/5">
                    {z.map((id, pi) => {
                      const p = c.parejas.find((x) => x.id === id)
                      return (
                        <li key={id} className="space-y-1 px-3 py-2">
                          <p className="text-sm"><span className="num mr-1.5 text-noche/40">{pi + 1}</span><span className="font-semibold">{nombre(id)}</span></p>
                          <ChipDisponibilidad valor={p?.disponibilidad} dias={dias} texto={p?.horario} />
                          {p?.horario && !p.disponibilidad && <ProblemaHorario texto={p.horario} compacto />}
                          <Select className="py-1 text-xs" value="" onChange={(e) => e.target.value && intercambiar(id, e.target.value)} aria-label={`Intercambiar ${nombre(id)}`}>
                            <option value="">Intercambiar con…</option>
                            {c.zonas.map((oz, ozi) => ozi === zi ? null : (
                              <optgroup key={ozi} label={`Zona ${LETRAS[ozi]}`}>
                                {oz.map((o) => <option key={o} value={o}>{nombre(o)}</option>)}
                              </optgroup>
                            ))}
                          </Select>
                        </li>
                      )
                    })}
                  </ol>
                  {malas.length > 0 && (
                    <p className="border-t border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                      No coinciden en ningún horario: {malas.map(([a, b]) => `${nombre(a).split(' / ')[0]} y ${nombre(b).split(' / ')[0]}`).join(' · ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
    </section>
  )
}
