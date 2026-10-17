import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsRight, Search, X } from 'lucide-react'
import { cargarCalendario, normalizarTexto } from '../../lib/publico'
import { CATEGORIAS, hoyLocal, type Categoria, type CategoriaTorneo, type Horario } from '../../lib/torneo'
import { esAmericano, resolverTorneo, type Partido } from '../../lib/resultados'
import { Alerta, Badge, Input, Spinner, Vacio } from '../../components/ui'
import { ESTILO_CATEGORIA } from '../../components/Categoria'

/** se actualiza solo cada 1 minuto mientras la página está a la vista */
const CADA = 60_000
/** días que se traen hacia atrás y hacia adelante de lo que se está mirando */
const ATRAS = 14, ADELANTE = 42

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// ------------------------------------------------------------------ fechas ('YYYY-MM-DD', siempre en hora local)
const dos = (n: number) => String(n).padStart(2, '0')
const aFecha = (f: string) => new Date(`${f}T12:00:00`)
const aTexto = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
const sumar = (f: string, dias: number) => { const d = aFecha(f); d.setDate(d.getDate() + dias); return aTexto(d) }
/** lunes de la semana de esa fecha */
const lunes = (f: string) => { const d = aFecha(f); return sumar(f, -((d.getDay() + 6) % 7)) }
const tituloDia = (f: string) => { const d = aFecha(f); return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}` }

// ------------------------------------------------------------------ partidos del calendario
type EstadoCal = 'proximo' | 'en_juego' | 'finalizado' | 'sin_resultado'
interface Item {
  id: string
  cat: Categoria
  p: Partido
  fecha: string
  hora: string
  orden: number
}

function itemsDe(cats: Categoria[]): Item[] {
  const out: Item[] = []
  cats.forEach((c, ci) => {
    const res = resolverTorneo(c)
    let orden = 0
    const add = (p: Partido, h: Horario | undefined) => {
      if (p.bye || !h?.fecha) return
      out.push({ id: `${c.id}|${p.tipo}|${p.key}`, cat: c, p, fecha: h.fecha, hora: h.hora ?? '', orden: ci * 100000 + orden++ })
    }
    for (const z of res.zonas) for (const p of z.partidos) add(p, c.horariosZona[p.key])
    for (const r of res.playoff ?? []) for (const p of r) add(p, c.horariosPlayoff[p.key])
  })
  // por hora (sin hora, al final del día); a igual hora, por torneo y partido
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ? 0 : 1) - (b.hora ? 0 : 1) || a.hora.localeCompare(b.hora) || a.orden - b.orden)
}

/** duración estimada (la misma del cronograma): americano 45′, al mejor de 3 sets 1 h */
const minutos = (p: Partido) => (esAmericano(p.formato) ? 45 : 60)
function estadoDe(it: Item, ahora: number): EstadoCal {
  if (it.p.estado === 'jugado' && it.p.resultado) return 'finalizado'
  const inicio = it.hora ? new Date(`${it.fecha}T${it.hora}:00`).getTime() : aFecha(it.fecha).getTime()
  if (!it.hora) return it.fecha < hoyLocal() ? 'sin_resultado' : 'proximo'
  if (ahora < inicio) return 'proximo'
  if (ahora < inicio + minutos(it.p) * 60_000) return 'en_juego'
  return 'sin_resultado'
}
const ETIQUETA: Record<EstadoCal, { texto: string; tono: 'neutro' | 'verde' | 'azul' | 'ambar' | 'pelota' }> = {
  proximo: { texto: 'Próximo', tono: 'neutro' },
  en_juego: { texto: 'En juego', tono: 'pelota' },
  finalizado: { texto: 'Finalizado', tono: 'azul' },
  sin_resultado: { texto: 'Resultado pendiente', tono: 'ambar' },
}

/** Calendario público: todos los partidos de los torneos publicados, por día y horario */
export default function Calendario() {
  const hoy = hoyLocal()
  const [dia, setDia] = useState<string | null>(null)
  const [cats, setCats] = useState<Categoria[] | null>(null)
  const [error, setError] = useState('')
  const [rango, setRango] = useState({ desde: sumar(hoy, -ATRAS), hasta: sumar(hoy, ADELANTE) })
  const [ahora, setAhora] = useState(Date.now())
  const [mes, setMes] = useState(false)
  // filtros
  const [categoria, setCategoria] = useState<'' | CategoriaTorneo>('')
  const [texto, setTexto] = useState('')
  const [sinFinalizados, setSinFinalizados] = useState(false)

  // ---------------------------------------------------------------- datos
  const rangoRef = useRef(rango)
  rangoRef.current = rango
  const cargar = useCallback(async () => {
    try {
      const { desde, hasta } = rangoRef.current
      setCats(await cargarCalendario(desde, hasta))
      setError('')
      setAhora(Date.now())
    } catch (e) {
      // si ya había datos, se sigue mostrando lo último que se cargó
      setError(e instanceof Error ? e.message : 'No se pudo cargar el calendario.')
      setCats((c) => c ?? [])
    }
  }, [])
  useEffect(() => { void cargar() }, [cargar, rango])
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void cargar() }, CADA)
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [cargar])

  const items = useMemo(() => (cats ? itemsDe(cats) : []), [cats])
  const q = normalizarTexto(texto)
  const filtrados = useMemo(() => items
    .filter((i) => !categoria || i.cat.categoria === categoria)
    .filter((i) => !q || normalizarTexto(`${i.p.etiquetaA} ${i.p.etiquetaB}`).includes(q))
    .filter((i) => !sinFinalizados || estadoDe(i, ahora) !== 'finalizado'), [items, categoria, q, sinFinalizados, ahora])
  const porDia = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of filtrados) m.set(i.fecha, (m.get(i.fecha) ?? 0) + 1)
    return m
  }, [filtrados])

  // día inicial: hoy si hay partidos; si no, el próximo con partidos; si no, el último que hubo
  useEffect(() => {
    if (dia !== null || !cats) return
    const fechas = [...new Set(items.map((i) => i.fecha))]
    setDia(fechas.includes(hoy) ? hoy : fechas.find((f) => f > hoy) ?? fechas[fechas.length - 1] ?? hoy)
  }, [dia, cats, items, hoy])
  const actual = dia ?? hoy

  // si se navega fuera de lo que ya se trajo, se trae más (agrandando el rango)
  const ir = (f: string) => {
    setDia(f)
    const ini = lunes(mes ? `${f.slice(0, 7)}-01` : f)
    const fin = sumar(ini, mes ? 41 : 6)
    if (ini < rango.desde || fin > rango.hasta) {
      const desde = ini < rango.desde ? sumar(ini, -ATRAS) : rango.desde
      const hasta = fin > rango.hasta ? sumar(fin, ADELANTE) : rango.hasta
      // la base acepta hasta ~6 meses por consulta: si se fue muy lejos, se arranca de nuevo alrededor de lo que se mira
      const dias = (aFecha(hasta).getTime() - aFecha(desde).getTime()) / 864e5
      setRango(dias > 180 ? { desde: sumar(ini, -ATRAS), hasta: sumar(fin, ADELANTE) } : { desde, hasta })
    }
  }
  const proximoConPartidos = useMemo(() => [...porDia.keys()].filter((f) => f > actual).sort()[0] ?? null, [porDia, actual])

  const delDia = filtrados.filter((i) => i.fecha === actual)
  const grupos = useMemo(() => {
    const g: { hora: string; items: Item[] }[] = []
    for (const i of delDia) {
      const ult = g[g.length - 1]
      if (ult && ult.hora === i.hora) ult.items.push(i)
      else g.push({ hora: i.hora, items: [i] })
    }
    return g
  }, [delDia])

  const semana = Array.from({ length: 7 }, (_, i) => sumar(lunes(actual), i))
  const hayFiltros = !!(categoria || q || sinFinalizados)

  if (!cats) return <Spinner texto="Cargando calendario…" />
  return (
    <div className="space-y-4">
      <p className="text-sm text-noche/70">Todos los partidos de los torneos de NODO por día y horario: los que vienen, los que se están jugando y los resultados.</p>

      {/* ------------------------------------------------ filtros */}
      <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-noche/10">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="¿Cuándo juego? Buscá tu nombre o apellido" className="pl-9 pr-9" aria-label="Buscar jugador" />
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

      {error && <Alerta tipo="error">{error}</Alerta>}

      {/* ------------------------------------------------ navegación de días */}
      <div className="rounded-xl bg-white p-3 ring-1 ring-noche/10">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button onClick={() => ir(mes ? `${sumar(`${actual.slice(0, 7)}-01`, -1).slice(0, 7)}-01` : sumar(actual, -7))} aria-label={mes ? 'Mes anterior' : 'Semana anterior'}
            className="rounded-lg p-1.5 text-noche/60 hover:bg-vidrio hover:text-noche"><ChevronLeft className="h-5 w-5" /></button>
          <p className="font-display text-lg font-bold capitalize text-noche">{MESES[aFecha(actual).getMonth()]} {actual.slice(0, 4)}</p>
          <div className="flex items-center gap-1">
            {actual !== hoy && <button onClick={() => ir(hoy)} className="rounded-lg px-2 py-1 text-xs font-semibold text-cancha hover:bg-cancha-suave">Hoy</button>}
            <button onClick={() => setMes(!mes)} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${mes ? 'bg-noche text-white ring-noche' : 'text-noche/70 ring-noche/15 hover:bg-vidrio'}`}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Mes
            </button>
            <button onClick={() => ir(mes ? `${sumar(`${actual.slice(0, 7)}-01`, 32).slice(0, 7)}-01` : sumar(actual, 7))} aria-label={mes ? 'Mes siguiente' : 'Semana siguiente'}
              className="rounded-lg p-1.5 text-noche/60 hover:bg-vidrio hover:text-noche"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
        {mes ? <Mes actual={actual} hoy={hoy} porDia={porDia} onDia={(f) => { ir(f); setMes(false) }} /> : (
          <div className="grid grid-cols-7 gap-1">
            {semana.map((f) => <DiaBoton key={f} f={f} hoy={hoy} elegido={f === actual} n={porDia.get(f) ?? 0} onClick={() => ir(f)} />)}
          </div>
        )}
      </div>

      {/* ------------------------------------------------ partidos del día */}
      <section className="space-y-3">
        <h2 className="border-l-[6px] border-pelota pl-2 font-display text-2xl font-bold leading-tight text-noche">
          {actual === hoy ? 'Hoy · ' : ''}{tituloDia(actual)}
          <span className="ml-2 text-sm font-normal text-noche/50">{delDia.length} partido{delDia.length === 1 ? '' : 's'}</span>
        </h2>
        {!delDia.length ? (
          <Vacio titulo={hayFiltros ? 'No hay partidos con esos filtros este día' : 'No hay partidos este día'}>
            {proximoConPartidos && (
              <button onClick={() => ir(proximoConPartidos)} className="inline-flex items-center gap-1 font-semibold text-cancha">
                Ir al próximo día con partidos <ChevronsRight className="h-4 w-4" aria-hidden />
              </button>
            )}
          </Vacio>
        ) : grupos.map((g) => (
          <div key={g.hora || 'sin'} className="flex gap-3">
            <div className="w-14 shrink-0 pt-2 text-center">
              <p className="num font-display text-xl font-bold leading-none text-noche">{g.hora || '—'}</p>
              {!g.hora && <p className="mt-0.5 text-[10px] leading-tight text-noche/50">a confirmar</p>}
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {g.items.map((it) => <li key={it.id}><Fila it={it} estado={estadoDe(it, ahora)} q={q} /></li>)}
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}

function DiaBoton({ f, hoy, elegido, n, onClick }: { f: string; hoy: string; elegido: boolean; n: number; onClick: () => void }) {
  const d = aFecha(f)
  return (
    <button onClick={onClick} aria-pressed={elegido} aria-label={`${tituloDia(f)}: ${n} partido${n === 1 ? '' : 's'}`}
      className={`flex flex-col items-center rounded-lg py-1.5 ring-1 transition ${elegido ? 'bg-noche text-white ring-noche' : f === hoy ? 'bg-pelota/25 text-noche ring-pelota' : 'bg-white text-noche ring-noche/10 hover:bg-vidrio'} ${!n && !elegido ? 'opacity-55' : ''}`}>
      <span className="text-[10px] font-semibold uppercase">{DIAS[d.getDay()]}</span>
      <span className="num font-display text-xl font-bold leading-none">{d.getDate()}</span>
      <span className={`num mt-0.5 h-4 text-[10px] font-bold ${elegido ? 'text-pelota' : 'text-cancha'}`}>{n || ''}</span>
    </button>
  )
}

function Mes({ actual, hoy, porDia, onDia }: { actual: string; hoy: string; porDia: Map<string, number>; onDia: (f: string) => void }) {
  const primero = `${actual.slice(0, 7)}-01`
  const ini = lunes(primero)
  const celdas = Array.from({ length: 42 }, (_, i) => sumar(ini, i))
  // si la última fila es toda del mes siguiente, no se muestra
  const visibles = celdas[35].slice(0, 7) !== actual.slice(0, 7) ? celdas.slice(0, 35) : celdas
  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <span key={d} className="pb-1 text-[10px] font-semibold uppercase text-noche/50">{d}</span>)}
      {visibles.map((f) => {
        const n = porDia.get(f) ?? 0
        const otro = f.slice(0, 7) !== actual.slice(0, 7)
        return (
          <button key={f} onClick={() => onDia(f)}
            className={`flex aspect-square flex-col items-center justify-center rounded-lg text-sm ring-1 ${f === actual ? 'bg-noche text-white ring-noche' : f === hoy ? 'bg-pelota/25 ring-pelota' : 'ring-noche/10 hover:bg-vidrio'} ${otro ? 'opacity-35' : ''}`}>
            <span className="num font-semibold">{Number(f.slice(8))}</span>
            {n > 0 && <span className={`num rounded-full px-1.5 text-[10px] font-bold ${f === actual ? 'bg-pelota text-noche' : 'bg-cancha-suave text-cancha'}`}>{n}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Fila({ it, estado, q }: { it: Item; estado: EstadoCal; q: string }) {
  const { p, cat } = it
  const jugado = estado === 'finalizado'
  const coincide = (t: string) => !!q && normalizarTexto(t).includes(q)
  const lado = (id: string | null, etiqueta: string) => (
    <span className={`block truncate ${!id ? 'italic text-noche/45' : jugado && id === p.ganador ? 'font-bold text-noche' : jugado ? 'text-noche/55' : 'font-medium text-noche'} ${coincide(etiqueta) ? 'rounded bg-pelota/40 px-1' : ''}`}>{etiqueta}</span>
  )
  const e = ETIQUETA[estado]
  const link = `#/torneo/${cat.id}?p=partidos${q ? `&q=${encodeURIComponent(q)}` : ''}`
  return (
    <a href={link} className={`block rounded-xl bg-white p-3 ring-1 transition hover:ring-cancha/40 ${estado === 'en_juego' ? 'ring-2 ring-pelota' : 'ring-noche/10'} border-l-[6px] ${ESTILO_CATEGORIA[cat.categoria]?.borde ?? 'border-l-noche/20'}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className="min-w-0 truncate text-xs font-semibold text-noche/60">
          <span className="font-bold text-noche/80">{cat.torneo}</span> · {p.titulo}
        </p>
        <Badge tono={e.tono}>{estado === 'en_juego' && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-noche" aria-hidden />}{e.texto}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-sm leading-snug">
          {lado(p.a, p.etiquetaA)}
          <span className="block text-[10px] uppercase text-noche/35">vs</span>
          {lado(p.b, p.etiquetaB)}
        </div>
        {jugado && p.resultado && (p.resultado.wo ? <Badge tono="pelota">W.O.</Badge> : (
          <div className="flex gap-1">
            {p.resultado.sets.map(([x, y], i) => (
              <span key={i} className="num grid w-7 rounded bg-vidrio py-0.5 text-center text-sm leading-tight">
                <span className={x > y ? 'font-bold' : 'text-noche/50'}>{x}</span>
                <span className={y > x ? 'font-bold' : 'text-noche/50'}>{y}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </a>
  )
}
