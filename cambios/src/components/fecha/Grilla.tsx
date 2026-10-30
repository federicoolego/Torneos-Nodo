import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Lock, Pin, RotateCcw, Wand2 } from 'lucide-react'
import { diaCorto, diasEntre, type Categoria } from '../../lib/torneo'
import { aHora, aMinutos } from '../../lib/disponibilidad'
import { diaCerrado, programar, validar, ventana, ventanaCancha, type Asignacion, type Contexto, type DiaFecha, type Plan, type Problema, type Tarea } from '../../lib/programador'
import { Alerta, Button, Modal, Select, Input, Tabs } from '../ui'
import { ChipDisponibilidad } from '../Disponibilidad'

/** colores para distinguir los torneos en la grilla */
export const PALETA = ['#0F6B57', '#2463C2', '#C93A78', '#7A4BC9', '#B45309', '#0E7490', '#9F1239', '#4D7C0F']
const FILA = 16 // px por cada 15′

/** Plan con los horarios que ya tienen cargados los torneos */
export function planDesdeTorneos(ctx: Contexto): Plan {
  const out: Plan = {}
  for (const t of ctx.tareas) {
    const h = t.actual
    if (h?.fecha && h?.hora) out[t.id] = { fecha: h.fecha, hora: h.hora, cancha: Number(h.cancha) || 0 }
  }
  return out
}

interface Props {
  ctx: Contexto
  cats: Categoria[]
  plan: Plan
  onPlan: (p: Plan) => void
  onAplicar: () => Promise<void>
  colorDe: (torneoId: string) => string
  cortoDe: (torneoId: string) => string
}

export default function Grilla({ ctx, cats, plan, onPlan, onAplicar, colorDe, cortoDe }: Props) {
  const { cfg } = ctx
  const problemas = useMemo(() => validar(ctx, plan), [ctx, plan])
  const porTarea = useMemo(() => {
    const m = new Map<string, Problema[]>()
    for (const p of problemas) m.set(p.tarea, [...(m.get(p.tarea) ?? []), p])
    return m
  }, [problemas])
  const errores = problemas.filter((p) => p.tipo === 'error')
  const avisos = problemas.filter((p) => p.tipo === 'aviso')
  const [dia, setDia] = useState(cfg.dias[0]?.fecha ?? '')
  const diaCfg = cfg.dias.find((d) => d.fecha === dia) ?? cfg.dias[0]
  const [editando, setEditando] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [respetar, setRespetar] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const pendientes = ctx.tareas.filter((t) => !t.jugado)
  const sinLugar = pendientes.filter((t) => !plan[t.id] || !plan[t.id].cancha)
  const fijados = Object.values(plan).filter((a) => a.fijo).length
  const hayCargados = ctx.tareas.some((t) => !t.jugado && t.actual?.fecha && t.actual?.hora)

  function generar() {
    if (Object.keys(plan).length && !confirm(`Se arma una propuesta nueva${fijados ? ` (se mantienen los ${fijados} partidos fijados)` : ''}. ¿Continuar?`)) return
    setGenerando(true)
    setTimeout(() => {
      const fijos = Object.fromEntries(Object.entries(plan).filter(([, a]) => a.fijo))
      const r = programar(ctx, { fijos, respetarCargados: respetar, ms: 1800 })
      onPlan(r.plan)
      setGenerando(false)
    }, 40)
  }
  async function aplicar() {
    const n = pendientes.filter((t) => plan[t.id]).length
    const torneos = new Set(pendientes.filter((t) => plan[t.id]).map((t) => t.torneoId)).size
    const extra = errores.length ? `\n\nAtención: quedan ${errores.length} problema(s) marcados en rojo.` : ''
    if (!confirm(`Se cargan día, hora y cancha de ${n} partidos en ${torneos} torneo(s). Los resultados no se tocan.${extra}\n\n¿Continuar?`)) return
    setAplicando(true)
    try { await onAplicar() } finally { setAplicando(false) }
  }

  if (!cfg.dias.length) return <Alerta tipo="aviso">Los torneos no tienen fechas: completalas en cada torneo.</Alerta>
  if (!ctx.tareas.length) return <Alerta tipo="aviso">Todavía no hay partidos: armá las zonas en el paso anterior.</Alerta>

  const [abre, cierra] = ventana(diaCfg)
  const filas = Math.max(1, Math.ceil((cierra - abre) / 15))
  const delDia = pendientes.concat(ctx.tareas.filter((t) => t.jugado)).filter((t) => plan[t.id]?.fecha === diaCfg.fecha && plan[t.id]?.cancha)
  const inicio = (a: Asignacion) => { let m = aMinutos(a.hora) ?? 0; if (m < 6 * 60 && abre >= 6 * 60) m += 1440; return m }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-noche/10">
        <div className="text-sm">
          <p className="font-display text-xl font-bold">{pendientes.length - sinLugar.length} de {pendientes.length} partidos con horario y cancha</p>
          <p className="text-noche/65">
            {errores.length ? <span className="font-semibold text-red">{errores.length} para corregir</span> : <span className="font-semibold text-emerald-700">Sin choques</span>}
            {' · '}{avisos.length ? <span className="font-semibold text-amber-700">{avisos.length} pedidos de horario sin respetar</span> : 'todos los pedidos de horario respetados'}
            {fijados ? ` · ${fijados} fijado(s)` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hayCargados && (
            <label className="flex items-center gap-1.5 text-xs text-noche/70" title="Los partidos que ya tienen día y hora en el torneo no se mueven">
              <input type="checkbox" checked={respetar} onChange={(e) => setRespetar(e.target.checked)} /> Mantener los ya cargados
            </label>
          )}
          {hayCargados && <Button variante="secundario" onClick={() => confirm('Se reemplaza la grilla por los horarios que tienen hoy los torneos. ¿Continuar?') && onPlan(planDesdeTorneos(ctx))}><RotateCcw className="h-4 w-4" aria-hidden /> Traer de los torneos</Button>}
          <Button onClick={generar} cargando={generando}><Wand2 className="h-4 w-4" aria-hidden /> {Object.keys(plan).length ? 'Volver a armar' : 'Armar horarios'}</Button>
          <Button variante="secundario" onClick={aplicar} cargando={aplicando} disabled={!Object.keys(plan).length}><Download className="h-4 w-4" aria-hidden /> Aplicar a los torneos</Button>
        </div>
      </div>

      {generando && <Alerta tipo="info">Probando combinaciones de zonas, canchas y horarios…</Alerta>}

      {problemas.length > 0 && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-noche/10">
          <p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> Para revisar <span className="text-xs font-normal text-noche/55">(tocá uno para moverlo)</span></p>
          <ul className="space-y-1 text-sm">
            {[...errores, ...avisos].slice(0, verTodos ? undefined : 12).map((p, i) => {
              const t = ctx.porId.get(p.tarea)!
              return (
                <li key={i}>
                  <button onClick={() => { if (plan[t.id]) setDia(plan[t.id].fecha); setEditando(t.id) }} className="flex w-full gap-2 rounded-md px-2 py-1 text-left hover:bg-vidrio">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${p.tipo === 'error' ? 'bg-red' : 'bg-amber-500'}`} aria-hidden />
                    <span><strong style={{ color: colorDe(t.torneoId) }}>{cortoDe(t.torneoId)}</strong> · {t.titulo}{plan[t.id] ? ` (${diaCorto(plan[t.id].fecha).slice(0, 3)} ${plan[t.id].hora})` : ''}: {p.texto}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {problemas.length > 12 && <button onClick={() => setVerTodos(!verTodos)} className="mt-1 text-xs font-semibold text-cancha hover:underline">{verTodos ? 'Ver menos' : `Ver los ${problemas.length}`}</button>}
        </div>
      )}
      {!problemas.length && Object.keys(plan).length > 0 && <Alerta tipo="ok">Todo cierra: sin choques de canchas ni jugadores y con los pedidos de horario respetados. Revisala y tocá “Aplicar a los torneos”.</Alerta>}

      {cfg.dias.length > 1 && (
        <Tabs opciones={cfg.dias.map((d) => ({ id: d.fecha, label: diaCorto(d.fecha), extra: diaCerrado(d) ? <span className="text-xs text-noche/45">sin canchas</span> : <span className="num text-sm text-noche/45">{pendientes.filter((t) => plan[t.id]?.fecha === d.fecha).length}</span> }))} valor={diaCfg.fecha} onChange={setDia} />
      )}

      {diaCerrado(diaCfg) ? (
        <Alerta tipo="info">No hay canchas el {diaCorto(diaCfg.fecha)} (se configura en el paso 1). {delDia.length ? 'Los partidos que quedaron cargados ese día figuran como problema arriba: movelos a otro día o volvé a armar los horarios.' : 'No se programa ningún partido ese día.'}</Alerta>
      ) : (
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-noche/10">
        <div className="grid min-w-[22rem]" style={{ gridTemplateColumns: `2.75rem repeat(${cfg.canchas}, minmax(7.5rem, 1fr))` }}>
          <div className="sticky top-0 border-b border-noche/10 bg-white" />
          {Array.from({ length: cfg.canchas }, (_, i) => (
            <div key={i} className="border-b border-l border-noche/10 bg-noche py-1.5 text-center font-display text-base font-bold text-white">Cancha {i + 1}</div>
          ))}
          {/* horas */}
          <div className="relative" style={{ height: filas * FILA }}>
            {Array.from({ length: filas }, (_, i) => abre + i * 15).filter((m) => m % 60 === 0 || m === abre).map((m) => (
              <span key={m} className="num absolute right-1 -translate-y-1/2 text-[10px] text-noche/50" style={{ top: ((m - abre) / 15) * FILA }}>{aHora(m)}</span>
            ))}
          </div>
          {Array.from({ length: cfg.canchas }, (_, ci) => (
            <div key={ci} className="relative border-l border-noche/10" style={{ height: filas * FILA, backgroundImage: `repeating-linear-gradient(to bottom, rgba(4,45,41,.07) 0 1px, transparent 1px ${FILA * 4}px)`, backgroundPosition: `0 ${(((60 - (abre % 60)) % 60) / 15) * FILA}px` }}>
              {/* fuera del horario de esta cancha (o cancha sin uso ese día): en gris */}
              {(() => {
                const w = ventanaCancha(diaCfg, ci + 1)
                const sombras = !w ? [[abre, cierra]] : [[abre, w[0]], [w[1], cierra]].filter(([x, y]) => y > x)
                return sombras.map(([x, y], k) => (
                  <div key={k} className="pointer-events-none absolute inset-x-0 bg-noche/[0.08]" aria-hidden
                    style={{ top: ((x - abre) / 15) * FILA, height: ((y - x) / 15) * FILA, backgroundImage: 'repeating-linear-gradient(135deg, rgba(4,45,41,.10) 0 4px, transparent 4px 9px)' }} />
                ))
              })()}
              {delDia.filter((t) => plan[t.id].cancha === ci + 1).map((t) => {
                const a = plan[t.id]
                const ini = inicio(a)
                const pr = porTarea.get(t.id) ?? []
                const err = pr.some((p) => p.tipo === 'error'), av = pr.some((p) => p.tipo === 'aviso')
                const color = colorDe(t.torneoId)
                return (
                  <button key={t.id} onClick={() => setEditando(t.id)} title={`${cortoDe(t.torneoId)} · ${t.titulo}\n${t.a} vs ${t.b}${pr.length ? `\n${pr.map((p) => p.texto).join('\n')}` : ''}`}
                    className={`absolute inset-x-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[10.5px] leading-tight ring-1 transition hover:z-10 hover:shadow-md focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cancha ${err ? 'ring-2 ring-red' : av ? 'ring-2 ring-amber-400' : 'ring-noche/10'} ${t.jugado ? 'opacity-55' : ''}`}
                    style={{ top: ((ini - abre) / 15) * FILA + 1, height: (t.dur / 15) * FILA - 2, background: `${color}14`, borderLeft: `4px solid ${color}` }}>
                    <span className="flex items-center gap-1 font-bold" style={{ color }}>
                      <span className="num">{a.hora}</span> <span className="truncate">{cortoDe(t.torneoId)}</span>
                      {a.fijo && <Pin className="h-2.5 w-2.5 shrink-0" aria-label="Fijado" />}
                      {t.jugado && <Lock className="h-2.5 w-2.5 shrink-0" aria-label="Jugado" />}
                    </span>
                    <span className="block truncate font-semibold text-noche">{t.titulo}</span>
                    <span className="block truncate text-noche/70">{t.a} · {t.b}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      )}
      <p className="text-xs text-noche/55">Horario de las canchas el {diaCorto(diaCfg.fecha)}: {textoHorarioCanchas(diaCfg, cfg.canchas)}. Rayado gris: cancha cerrada. Rojo: choque (cancha, jugador, orden de partidos u horario). Ámbar: no se respetó lo que pidió una pareja. <Pin className="inline h-3 w-3" aria-hidden /> fijado: no se mueve al volver a armar.</p>

      {sinLugar.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="mb-2 font-semibold text-amber-900">Sin lugar ({sinLugar.length}) — no entraron en las canchas y horarios configurados</p>
          <div className="flex flex-wrap gap-2">
            {sinLugar.map((t) => (
              <button key={t.id} onClick={() => setEditando(t.id)} className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-amber-300 hover:bg-amber-100">
                <span style={{ color: colorDe(t.torneoId) }}>{cortoDe(t.torneoId)}</span> · {t.titulo}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-900/80">Probá alargar el horario de algún día (paso 1), bajar la duración de los partidos, o ubicalos a mano.</p>
        </div>
      )}

      {editando && ctx.porId.get(editando) && (
        <EditarPartido t={ctx.porId.get(editando)!} ctx={ctx} cats={cats} plan={plan} cortoDe={cortoDe} colorDe={colorDe}
          onCerrar={() => setEditando(null)}
          onGuardar={(a) => {
            const n = { ...plan }
            if (a) n[editando] = a
            else delete n[editando]
            onPlan(n)
            if (a) setDia(a.fecha)
            setEditando(null)
          }} />
      )}
    </div>
  )
}

function EditarPartido({ t, ctx, cats, plan, cortoDe, colorDe, onCerrar, onGuardar }: {
  t: Tarea; ctx: Contexto; cats: Categoria[]; plan: Plan; cortoDe: (id: string) => string; colorDe: (id: string) => string
  onCerrar: () => void; onGuardar: (a: Asignacion | null) => void
}) {
  const { cfg } = ctx
  const actual = plan[t.id]
  const [a, setA] = useState<Asignacion>(actual ?? { fecha: t.dias[0] ?? cfg.dias[0]?.fecha ?? '', hora: '', cancha: 1, fijo: true })
  const borrador = a.fecha && a.hora ? { ...plan, [t.id]: a } : plan
  const pr = validar(ctx, borrador).filter((p) => p.tarea === t.id)
  const cat = cats.find((c) => c.id === t.torneoId)
  const dias = cat ? diasEntre(cat.fechaInicio, cat.fechaFin) : []
  const parejas = (t.tipo === 'zona' ? t.parejas : []).map((id) => cat?.parejas.find((p) => p.id === id)).filter(Boolean)

  return (
    <Modal abierto titulo={t.titulo} onCerrar={onCerrar}>
      <div className="space-y-4 text-sm">
        <p><strong style={{ color: colorDe(t.torneoId) }}>{cortoDe(t.torneoId)}</strong> · {t.a} vs {t.b} · {t.dur}′</p>
        {parejas.length > 0 && (
          <ul className="space-y-1.5 rounded-lg bg-vidrio p-3">
            {parejas.map((p) => (
              <li key={p!.id}>
                <p className="font-semibold">{p!.nombre}</p>
                {p!.horario && <p className="text-xs text-noche/60">“{p!.horario}”</p>}
                <ChipDisponibilidad valor={p!.disponibilidad} dias={dias} texto={p!.horario} />
              </li>
            ))}
          </ul>
        )}
        {t.tipo === 'playoff' && <p className="text-xs text-noche/60">Todavía no se sabe quiénes lo juegan: se tienen en cuenta los horarios de las parejas que pueden llegar.</p>}
        {t.jugado ? <Alerta tipo="info">Ya tiene resultado: no se mueve.</Alerta> : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-xs font-medium">Día
                <Select value={a.fecha} onChange={(e) => setA({ ...a, fecha: e.target.value })} className="mt-1 py-1.5">
                  {cfg.dias.filter((d) => t.dias.includes(d.fecha) || d.fecha === a.fecha).map((d) => <option key={d.fecha} value={d.fecha}>{diaCorto(d.fecha)}{diaCerrado(d) ? ' (sin canchas)' : ''}</option>)}
                </Select>
              </label>
              <label className="block text-xs font-medium">Hora
                <Input type="time" step={900} value={a.hora} onChange={(e) => setA({ ...a, hora: e.target.value })} className="mt-1 py-1.5" />
              </label>
              <label className="block text-xs font-medium">Cancha
                <Select value={a.cancha} onChange={(e) => setA({ ...a, cancha: Number(e.target.value) })} className="mt-1 py-1.5">
                  {Array.from({ length: cfg.canchas }, (_, i) => <option key={i} value={i + 1}>Cancha {i + 1}</option>)}
                </Select>
              </label>
            </div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!a.fijo} onChange={(e) => setA({ ...a, fijo: e.target.checked })} /> <Pin className="h-3.5 w-3.5" aria-hidden /> Fijar: no moverlo al volver a armar</label>
            {a.hora && (pr.length ? (
              <ul className="space-y-1">{pr.map((p, i) => <li key={i} className={`flex gap-1.5 text-xs ${p.tipo === 'error' ? 'text-red' : 'text-amber-800'}`}><AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {p.texto}</li>)}</ul>
            ) : <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Sin choques en ese horario.</p>)}
            <div className="flex flex-wrap justify-between gap-2 pt-1">
              {actual ? <Button variante="peligro" onClick={() => onGuardar(null)}>Sacar de la grilla</Button> : <span />}
              <div className="flex gap-2">
                <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
                <Button onClick={() => onGuardar(a)} disabled={!a.fecha || !a.hora}>Guardar</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** "10:00 a 23:00" si todas las canchas igual; si no, "Cancha 1 10:00 a 23:00 · Cancha 2 12:00 a 22:00 · Cancha 3 no disponible" */
function textoHorarioCanchas(d: DiaFecha, n: number): string {
  const tx = (c: number) => { const w = ventanaCancha(d, c); return w ? `${aHora(w[0])} a ${aHora(w[1])}` : 'no disponible' }
  const todas = Array.from({ length: n }, (_, i) => tx(i + 1))
  return todas.every((x) => x === todas[0]) ? todas[0] : todas.map((x, i) => `Cancha ${i + 1} ${x}`).join(' · ')
}
