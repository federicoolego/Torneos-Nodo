import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ChevronsRight, List, MessageCircle, Search, Ticket, Trophy, Users, X } from 'lucide-react'
import { normalizarTexto, type ResumenPublico } from '../../lib/publico'
import { CATEGORIAS, formatoPesos, hoyLocal, nombreEstado, rangoFechas, type CategoriaTorneo } from '../../lib/torneo'
import { Badge, Input, Vacio } from '../../components/ui'
import { BadgeCategoria, ESTILO_CATEGORIA, bordeCategoria } from '../../components/Categoria'

export type VistaTorneos = 'semana' | 'mes' | 'lista'

const tonoEstado = (e: ResumenPublico['estado']) => (e === 'en_curso' ? 'celeste' : e === 'finalizado' ? 'azul' : e === 'cancelado' ? 'rojo' : 'ambar') as 'celeste' | 'azul' | 'rojo' | 'ambar'
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// ------------------------------------------------------------------ fechas ('YYYY-MM-DD', siempre en hora local)
const dos = (n: number) => String(n).padStart(2, '0')
const aFecha = (f: string) => new Date(`${f}T12:00:00`)
const aTexto = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
const sumar = (f: string, n: number) => { const d = aFecha(f); d.setDate(d.getDate() + n); return aTexto(d) }
/** lunes de la semana de esa fecha */
const lunes = (f: string) => sumar(f, -((aFecha(f).getDay() + 6) % 7))
const entre = (a: string, b: string) => Math.round((aFecha(b).getTime() - aFecha(a).getTime()) / 864e5)
const tituloDia = (f: string) => { const d = aFecha(f); return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` }
const inicio = (t: ResumenPublico) => t.fecha_inicio as string
const fin = (t: ResumenPublico) => t.fecha_fin || (t.fecha_inicio as string)
/** el torneo se juega (al menos en parte) entre esas dos fechas */
const cruza = (t: ResumenPublico, desde: string, hasta: string) => inicio(t) <= hasta && fin(t) >= desde

/** color de la barra: pleno pendiente / en curso; claro finalizado; gris tachado cancelado */
const BARRA: Record<CategoriaTorneo, { fuerte: string; suave: string; muestra: string }> = {
  Damas: { fuerte: 'bg-damas text-white', suave: 'bg-damas-suave text-damas', muestra: 'bg-damas' },
  Caballeros: { fuerte: 'bg-caballeros text-white', suave: 'bg-caballeros-suave text-caballeros', muestra: 'bg-caballeros' },
  Mixto: { fuerte: 'bg-mixto text-white', suave: 'bg-mixto-suave text-mixto', muestra: 'bg-mixto' },
}
const claseBarra = (t: ResumenPublico) => {
  const c = BARRA[t.categoria] ?? BARRA.Damas
  return t.estado === 'cancelado' ? 'bg-noche/10 text-noche/45 line-through' : t.estado === 'finalizado' ? c.suave : c.fuerte
}

/** pantalla angosta (celular): barras más finas y más carriles visibles */
function useAngosto() {
  const q = '(max-width: 639px)'
  const [angosto, setAngosto] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const f = () => setAngosto(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return angosto
}

interface Tramo { t: ResumenPublico; ini: number; fin: number; corteIzq: boolean; corteDer: boolean; carril: number }

/** tramos de cada torneo dentro de una semana (columna 0 = lunes), en carriles para que no se pisen */
function tramosSemana(lun: string, torneos: ResumenPublico[]): Tramo[] {
  const dom = sumar(lun, 6)
  const tramos: Tramo[] = torneos.filter((t) => cruza(t, lun, dom)).map((t) => ({
    t,
    ini: inicio(t) < lun ? 0 : entre(lun, inicio(t)),
    fin: fin(t) > dom ? 6 : entre(lun, fin(t)),
    corteIzq: inicio(t) < lun,
    corteDer: fin(t) > dom,
    carril: 0,
  }))
  // los que empiezan antes primero; a igual inicio, los más largos arriba
  tramos.sort((a, b) => a.ini - b.ini || (b.fin - b.ini) - (a.fin - a.ini) || a.t.nombre.localeCompare(b.t.nombre))
  const ocupados: Set<number>[] = []
  for (const s of tramos) {
    let c = 0
    while (ocupados[c] && [...Array(s.fin - s.ini + 1).keys()].some((i) => ocupados[c].has(s.ini + i))) c++
    ocupados[c] ??= new Set()
    for (let d = s.ini; d <= s.fin; d++) ocupados[c].add(d)
    s.carril = c
  }
  return tramos
}

/**
 * Torneos publicados en modo calendario, con un tramo por torneo (de su primer a su último día).
 * Mes: abajo la agenda del mes por fin de semana o, si se toca un día, los torneos de ese día.
 * Semana (como el calendario de partidos): los 7 días con la cantidad de torneos y abajo los torneos del día elegido (arranca en hoy).
 */
export default function TorneosCalendario({ lista, vista, onVista }: { lista: ResumenPublico[]; vista: 'semana' | 'mes'; onVista: (v: VistaTorneos) => void }) {
  const hoy = hoyLocal()
  const angosto = useAngosto()
  const semanal = vista === 'semana'
  const [mes, setMes] = useState(hoy.slice(0, 7))
  const [dia, setDia] = useState<string | null>(semanal ? hoy : null)
  // al cambiar de vista se sigue mirando la misma fecha: a Semana, el día elegido (o hoy si es este mes, o el 1° del mes);
  // a Mes, el mes de ese día (con el día todavía elegido)
  const montado = useRef(false)
  useEffect(() => {
    if (!montado.current) { montado.current = true; return }
    if (semanal) setDia((d) => d ?? (mes === hoy.slice(0, 7) ? hoy : `${mes}-01`))
    else if (dia) setMes(dia.slice(0, 7))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanal])
  // filtros
  const [categoria, setCategoria] = useState<'' | CategoriaTorneo>('')
  const [texto, setTexto] = useState('')
  const [sinFinalizados, setSinFinalizados] = useState(false)

  const q = normalizarTexto(texto)
  const conFecha = useMemo(() => lista.filter((t) => t.fecha_inicio), [lista])
  const filtrados = useMemo(() => conFecha
    .filter((t) => !categoria || t.categoria === categoria)
    .filter((t) => !q || normalizarTexto(t.nombre).includes(q))
    .filter((t) => !sinFinalizados || t.estado !== 'finalizado'), [conFecha, categoria, q, sinFinalizados])
  const sinFecha = lista.length - conFecha.length
  const hayFiltros = !!(categoria || q || sinFinalizados)

  const primero = `${mes}-01`
  const ultimo = sumar(`${sumar(primero, 32).slice(0, 7)}-01`, -1)
  // 5 o 6 semanas: la sexta solo si tiene días del mes
  const semanas = Array.from({ length: 6 }, (_, i) => sumar(lunes(primero), i * 7)).filter((l) => l <= ultimo)

  const ordenar = (a: ResumenPublico, b: ResumenPublico) => inicio(a).localeCompare(inicio(b)) || a.nombre.localeCompare(b.nombre)
  const delMes = filtrados.filter((t) => cruza(t, primero, ultimo)).sort(ordenar)
  const delDia = dia ? filtrados.filter((t) => cruza(t, dia, dia)).sort(ordenar) : []
  const proximo = filtrados.filter((t) => inicio(t) > ultimo).sort(ordenar)[0]
  const anterior = filtrados.filter((t) => fin(t) < primero).sort(ordenar).reverse()[0]

  // agenda del mes: por semana (en NODO se juega de viernes a domingo, así queda una "fecha" por grupo)
  const grupos = useMemo(() => {
    const g: { lun: string; ts: ResumenPublico[] }[] = []
    for (const t of delMes) {
      const k = lunes(inicio(t) < primero ? primero : inicio(t))
      const ult = g[g.length - 1]
      if (ult && ult.lun === k) ult.ts.push(t)
      else g.push({ lun: k, ts: [t] })
    }
    return g
  }, [delMes, primero])

  const irMes = (m: string) => { setMes(m); setDia(null) }
  /** elige un día (vista Semana) y deja el mes en ese día */
  const irDia = (f: string) => { setDia(f); setMes(f.slice(0, 7)) }
  const diaSemana = dia ?? hoy
  const lunSemana = lunes(diaSemana)
  const proximoDia = dia ? filtrados.filter((t) => inicio(t) > dia).sort(ordenar)[0] : undefined
  const irA = (t: ResumenPublico) => irMes(inicio(t).slice(0, 7))
  const MAX = angosto ? 4 : 3
  const nombreMes = MESES[aFecha(semanal ? diaSemana : primero).getMonth()]
  const anioVisto = (semanal ? diaSemana : primero).slice(0, 4)
  const cuantos = (dia ? delDia : delMes).length

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ filtros (como el calendario de partidos) */}
      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-noche/10">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar torneo…" className="pl-9 pr-9" aria-label="Buscar torneo" />
          {texto && <button onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-noche/40"><X className="h-4 w-4" /></button>}
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {(['', ...CATEGORIAS] as ('' | CategoriaTorneo)[]).map((c) => (
            <button key={c || 'todas'} onClick={() => setCategoria(c)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${categoria === c ? (c ? `${ESTILO_CATEGORIA[c].activo} ring-transparent` : 'bg-noche text-white ring-noche') : 'bg-white text-noche/65 ring-noche/15 hover:bg-vidrio'}`}>
              {c || 'Todas'}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-semibold text-noche/70">
            <input type="checkbox" checked={sinFinalizados} onChange={(e) => setSinFinalizados(e.target.checked)} className="h-4 w-4 accent-[#0F6B57]" />
            Ocultar finalizados
          </label>
        </div>
      </div>

      {/* ------------------------------------------------ mes */}
      <div className="rounded-xl bg-white p-3 ring-1 ring-noche/10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button onClick={() => (semanal ? irDia(sumar(diaSemana, -7)) : irMes(sumar(primero, -1).slice(0, 7)))} aria-label={semanal ? 'Semana anterior' : 'Mes anterior'} className="rounded-lg p-1.5 text-noche/60 hover:bg-vidrio hover:text-noche"><ChevronLeft className="h-5 w-5" /></button>
          <p className="font-display text-lg font-bold capitalize text-noche">{nombreMes} {anioVisto}</p>
          <div className="flex items-center gap-1">
            {(semanal ? dia !== hoy : mes !== hoy.slice(0, 7) || dia) && <button onClick={() => (semanal ? irDia(hoy) : irMes(hoy.slice(0, 7)))} className="rounded-lg px-2 py-1 text-xs font-semibold text-cancha hover:bg-cancha-suave">Hoy</button>}
            <SelectorVista vista={vista} onVista={onVista} angosto={angosto} />
            <button onClick={() => (semanal ? irDia(sumar(diaSemana, 7)) : irMes(sumar(primero, 32).slice(0, 7)))} aria-label={semanal ? 'Semana siguiente' : 'Mes siguiente'} className="rounded-lg p-1.5 text-noche/60 hover:bg-vidrio hover:text-noche"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
        {semanal ? (
          <Semana lun={lunSemana} dia={diaSemana} hoy={hoy} torneos={filtrados} angosto={angosto} onDia={irDia} />
        ) : <>
        <div className="grid grid-cols-7 text-center">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <span key={d} className="pb-1 text-[10px] font-semibold uppercase text-noche/50">{d}</span>)}
        </div>
        <div className="overflow-hidden rounded-lg ring-1 ring-noche/10">
          {semanas.map((lun) => {
            const tramos = tramosSemana(lun, filtrados)
            const dias = Array.from({ length: 7 }, (_, i) => sumar(lun, i))
            const carriles = Math.min(MAX, Math.max(1, ...tramos.map((s) => s.carril + 1)))
            // torneos que no entran en los carriles visibles: "+N" en cada día que ocupan
            const ocultos = dias.map((_, i) => tramos.filter((s) => s.carril >= MAX && s.ini <= i && s.fin >= i).length)
            return (
              <div key={lun} className="relative border-b border-noche/10 last:border-b-0">
                <div className="grid grid-cols-7">
                  {dias.map((f, i) => {
                    const n = filtrados.filter((t) => cruza(t, f, f)).length
                    const elegido = f === dia
                    return (
                      <button key={f} onClick={() => setDia(elegido ? null : f)} aria-pressed={elegido}
                        aria-label={`${tituloDia(f)}: ${n} torneo${n === 1 ? '' : 's'}`}
                        className={`relative flex flex-col items-start border-r border-noche/10 text-left last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cancha ${angosto ? 'px-1 pt-1' : 'px-1.5 pt-1.5'} ${elegido ? 'bg-cancha-suave' : i >= 4 ? 'bg-vidrio/60 hover:bg-vidrio' : 'bg-white hover:bg-vidrio'}`}
                        style={{ minHeight: angosto ? 30 + carriles * 18 + (ocultos.some(Boolean) ? 12 : 0) : 42 + carriles * 28 + (ocultos.some(Boolean) ? 16 : 0) }}>
                        <span className={`num grid h-6 min-w-6 place-items-center rounded-full px-1 text-sm font-semibold ${f === hoy ? 'bg-pelota text-noche' : elegido ? 'bg-noche text-white' : f.slice(0, 7) !== mes ? 'text-noche/30' : 'text-noche/80'}`}>{Number(f.slice(8))}</span>
                        {ocultos[i] > 0 && <span className="num absolute bottom-0.5 left-1 text-[10px] font-bold text-cancha">+{ocultos[i]}</span>}
                      </button>
                    )
                  })}
                </div>
                {/* tramos: tocar uno abre el torneo; los clics sobre el resto pasan al día */}
                <div className={`pointer-events-none absolute inset-x-0 grid grid-cols-7 ${angosto ? 'top-7 gap-y-0.5' : 'top-9 gap-y-1'}`}>
                  {tramos.filter((s) => s.carril < MAX).map((s) => (
                    <a key={s.t.id} href={`#/torneo/${s.t.id}`} title={`${s.t.nombre} · ${rangoFechas(inicio(s.t), s.t.fecha_fin ?? '')} · ${nombreEstado(s.t.estado)}`}
                      style={{ gridColumn: `${s.ini + 1} / ${s.fin + 2}`, gridRow: s.carril + 1 }}
                      className={`pointer-events-auto mx-0.5 flex min-w-0 items-center gap-1 font-semibold leading-none ${angosto ? 'h-4 px-1 text-[10px]' : 'h-6 px-2 text-xs'} ${claseBarra(s.t)} ${s.corteIzq ? '' : 'rounded-l-md'} ${s.corteDer ? '' : 'rounded-r-md'} ${s.t.estado === 'en_curso' ? 'ring-2 ring-pelota ring-offset-1' : ''}`}>
                      {s.t.estado === 'en_curso' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pelota" aria-hidden />}
                      {s.t.estado === 'finalizado' && s.t.campeon && !angosto && <Trophy className="h-3 w-3 shrink-0" aria-hidden />}
                      <span className="truncate">{angosto ? s.t.nombre.replace(/^Fecha\s*\d+\s*[·\-–]\s*/i, '') : s.t.nombre}</span>
                    </a>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        </>}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-noche/60">
          {CATEGORIAS.map((c) => <span key={c} className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${BARRA[c].muestra}`} aria-hidden />{c}</span>)}
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-noche/15" aria-hidden />Claro = finalizado</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-pelota ring-1 ring-noche/30" aria-hidden />En curso</span>
        </div>
      </div>

      {/* ------------------------------------------------ torneos del día elegido o agenda del mes */}
      <section className="space-y-3">
        <h2 className="border-l-[6px] border-pelota pl-2 font-display text-2xl font-bold leading-tight text-noche">
          {dia ? <>{dia === hoy ? 'Hoy · ' : ''}{tituloDia(dia)}</> : <>Torneos de {nombreMes}</>}
          <span className="ml-2 text-sm font-normal text-noche/50">{cuantos} torneo{cuantos === 1 ? '' : 's'}</span>
          {dia && !semanal && <button onClick={() => setDia(null)} className="ml-3 align-middle font-sans text-sm font-semibold text-cancha">Ver todo el mes</button>}
        </h2>

        {!cuantos ? (
          <Vacio titulo={dia ? (hayFiltros ? 'No hay torneos con esos filtros este día' : 'No hay torneos este día') : hayFiltros ? 'No hay torneos con esos filtros este mes' : 'No hay torneos este mes'}>
            {semanal ? (proximoDia && (
              <button onClick={() => irDia(inicio(proximoDia))} className="inline-flex items-center gap-1 font-semibold text-cancha">
                Ir al próximo día con torneos ({rangoFechas(inicio(proximoDia), '')}) <ChevronsRight className="h-4 w-4" aria-hidden />
              </button>
            )) : dia ? (
              <button onClick={() => setDia(null)} className="font-semibold text-cancha">Ver los torneos del mes</button>
            ) : proximo ? (
              <button onClick={() => irA(proximo)} className="inline-flex items-center gap-1 font-semibold text-cancha">
                Ir al próximo torneo ({rangoFechas(inicio(proximo), proximo.fecha_fin ?? '')}) <ChevronsRight className="h-4 w-4" aria-hidden />
              </button>
            ) : anterior ? (
              <button onClick={() => irA(anterior)} className="font-semibold text-cancha">Ir al último torneo ({rangoFechas(inicio(anterior), anterior.fecha_fin ?? '')})</button>
            ) : 'Cuando el club publique un torneo, lo vas a ver acá.'}
          </Vacio>
        ) : dia ? (
          <ul className="grid gap-3 sm:grid-cols-2">{delDia.map((t) => <li key={t.id}><Tarjeta t={t} /></li>)}</ul>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => {
              const a = g.ts.reduce((m, t) => (inicio(t) < m ? inicio(t) : m), inicio(g.ts[0]))
              const b = g.ts.reduce((m, t) => (fin(t) > m ? fin(t) : m), fin(g.ts[0]))
              return (
                <div key={g.lun}>
                  <p className="mb-1.5 font-display text-lg font-bold text-noche/70">{rangoFechas(a, b)}</p>
                  <ul className="divide-y divide-noche/10 overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
                    {g.ts.map((t) => <li key={t.id}><Fila t={t} angosto={angosto} /></li>)}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
        {sinFecha > 0 && (
          <p className="text-xs text-noche/55">
            {sinFecha} torneo{sinFecha === 1 ? '' : 's'} todavía sin fecha: {' '}
            <button onClick={() => onVista('lista')} className="font-semibold text-cancha">verlos en la lista</button>
          </p>
        )}
      </section>
    </div>
  )
}

/** Semana | Mes | Lista (en el celular, solo íconos) */
export function SelectorVista({ vista, onVista, angosto = false }: { vista: VistaTorneos; onVista: (v: VistaTorneos) => void; angosto?: boolean }) {
  const op = (v: VistaTorneos, Icono: typeof List, label: string) => (
    <button onClick={() => onVista(v)} aria-pressed={vista === v} aria-label={`Ver en ${label.toLowerCase()}`} title={label}
      className={`inline-flex items-center gap-1 px-2 py-1 ${vista === v ? 'bg-noche text-white' : 'text-noche/70 hover:bg-vidrio'}`}>
      <Icono className="h-3.5 w-3.5" aria-hidden />{!angosto && label}
    </button>
  )
  return (
    <span className="inline-flex overflow-hidden rounded-lg text-xs font-semibold ring-1 ring-noche/15">
      {op('semana', CalendarRange, 'Semana')}
      {op('mes', CalendarDays, 'Mes')}
      {op('lista', List, 'Lista')}
    </span>
  )
}

/** Vista Semana: los 7 días (con la cantidad de torneos de cada uno) y debajo los tramos de la semana, más altos y con el nombre completo */
function Semana({ lun, dia, hoy, torneos, angosto, onDia }: { lun: string; dia: string; hoy: string; torneos: ResumenPublico[]; angosto: boolean; onDia: (f: string) => void }) {
  const dias = Array.from({ length: 7 }, (_, i) => sumar(lun, i))
  const tramos = tramosSemana(lun, torneos)
  return (
    <>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((f) => {
          const d = aFecha(f)
          const n = torneos.filter((t) => cruza(t, f, f)).length
          const elegido = f === dia
          return (
            <button key={f} onClick={() => onDia(f)} aria-pressed={elegido} aria-label={`${tituloDia(f)}: ${n} torneo${n === 1 ? '' : 's'}`}
              className={`flex flex-col items-center rounded-lg py-1.5 ring-1 transition ${elegido ? 'bg-noche text-white ring-noche' : f === hoy ? 'bg-pelota/25 text-noche ring-pelota' : 'bg-white text-noche ring-noche/10 hover:bg-vidrio'} ${!n && !elegido ? 'opacity-55' : ''}`}>
              <span className="text-[10px] font-semibold uppercase">{DIAS_LARGOS[d.getDay()].slice(0, 3)}</span>
              <span className="num font-display text-xl font-bold leading-none">{d.getDate()}</span>
              <span className={`num mt-0.5 h-4 text-[10px] font-bold ${elegido ? 'text-pelota' : 'text-cancha'}`}>{n || ''}</span>
            </button>
          )
        })}
      </div>
      {tramos.length > 0 && (
        <div className="mt-2 grid grid-cols-7 gap-y-1">
          {tramos.map((s) => (
            <a key={s.t.id} href={`#/torneo/${s.t.id}`} title={`${s.t.nombre} · ${rangoFechas(inicio(s.t), s.t.fecha_fin ?? '')} · ${nombreEstado(s.t.estado)}`}
              style={{ gridColumn: `${s.ini + 1} / ${s.fin + 2}`, gridRow: s.carril + 1 }}
              className={`mx-0.5 flex min-w-0 items-center gap-1 font-semibold leading-none ${angosto ? 'h-5 px-1.5 text-[11px]' : 'h-7 px-2.5 text-sm'} ${claseBarra(s.t)} ${s.corteIzq ? '' : 'rounded-l-md'} ${s.corteDer ? '' : 'rounded-r-md'} ${s.t.estado === 'en_curso' ? 'ring-2 ring-pelota ring-offset-1' : ''}`}>
              {s.t.estado === 'en_curso' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pelota" aria-hidden />}
              {s.t.estado === 'finalizado' && s.t.campeon && <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{angosto ? s.t.nombre.replace(/^Fecha\s*\d+\s*[·\-–]\s*/i, '') : s.t.nombre}</span>
            </a>
          ))}
        </div>
      )}
    </>
  )
}

/** fila compacta de la agenda del mes */
function Fila({ t, angosto }: { t: ResumenPublico; angosto: boolean }) {
  const finalizado = t.estado === 'finalizado'
  const abierta = t.solo_info && t.estado === 'pendiente'
  return (
    <a href={`#/torneo/${t.id}`} className={`flex items-center gap-3 px-3 py-2.5 transition hover:bg-vidrio ${bordeCategoria(t.categoria)}`}>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-display text-lg font-bold leading-tight ${finalizado || t.estado === 'cancelado' ? 'text-noche/70' : 'text-noche'} ${t.estado === 'cancelado' ? 'line-through' : ''}`}>{t.nombre}</p>
        <p className="flex flex-wrap items-center gap-x-3 text-xs text-noche/60">
          <span>{rangoFechas(inicio(t), t.fecha_fin ?? '')}</span>
          {finalizado && t.campeon ? <span className="inline-flex items-center gap-1 font-semibold text-noche/75"><Trophy className="h-3 w-3 text-cancha" aria-hidden />{t.campeon}</span>
            : abierta ? <span className="inline-flex items-center gap-1 font-semibold text-[#18914A]"><MessageCircle className="h-3 w-3" aria-hidden />Inscripción por WhatsApp</span>
            : !t.solo_info ? <span>{t.parejas} parejas</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        {!angosto && <BadgeCategoria categoria={t.categoria} />}
        {abierta ? <Badge tono="pelota">Inscripción abierta</Badge> : <Badge tono={tonoEstado(t.estado)}>{nombreEstado(t.estado)}</Badge>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-noche/30" aria-hidden />
    </a>
  )
}

/** tarjeta completa (torneos del día elegido), igual a la de la lista */
function Tarjeta({ t }: { t: ResumenPublico }) {
  return (
    <a href={`#/torneo/${t.id}`} className={`flex h-full items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-noche/10 transition hover:ring-cancha/40 ${bordeCategoria(t.categoria)}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap gap-1">
          <BadgeCategoria categoria={t.categoria} />
          <Badge tono={tonoEstado(t.estado)}>{nombreEstado(t.estado)}</Badge>
          {t.solo_info && t.estado === 'pendiente' && <Badge tono="pelota">Inscripción abierta</Badge>}
        </div>
        <p className="font-display text-2xl font-bold leading-tight text-noche">{t.nombre}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-noche/65">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{rangoFechas(inicio(t), t.fecha_fin ?? '')}</span>
          {!t.solo_info && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{t.parejas} parejas</span>}
          {t.inscripcion ? <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" aria-hidden />{formatoPesos(String(t.inscripcion))}</span> : null}
        </div>
        {t.premio && <p className="text-sm text-noche/65">Premio: {t.premio}</p>}
        {t.solo_info && t.estado === 'pendiente' && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#18914A]"><MessageCircle className="h-4 w-4" aria-hidden /> Inscripciones por WhatsApp · tocá para ver la info</p>
        )}
        {t.estado === 'finalizado' && t.campeon && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-noche"><Trophy className="h-4 w-4 text-cancha" aria-hidden /> {t.campeon}</p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-noche/30" aria-hidden />
    </a>
  )
}
