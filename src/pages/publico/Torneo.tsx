import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, CalendarDays, Check, Info, Link2, ListChecks, MessageCircle, Search, Share2, Ticket, Trophy, Users, X } from 'lucide-react'
import { cargarPublico, linkInscripcion, normalizarTexto } from '../../lib/publico'
import { LETRAS, formatoPesos, nombreEstado, nombreInstancia, rangoFechas, textoHorario, type Categoria, type EstadoTorneo, type Horario, type Instancia } from '../../lib/torneo'
import { estadoTorneo, instanciasDelTorneo, resolverTorneo, textoFormatos, type Partido, type ZonaResuelta } from '../../lib/resultados'
import { Alerta, Badge, Input, Spinner, Tabs, Vacio } from '../../components/ui'
import { BadgeCategoria } from '../../components/Categoria'
import { tonoEstado } from './Lista'

type Pestana = 'zonas' | 'partidos' | 'playoff'
const CADA = 60_000 // se actualiza solo cada 1 minuto mientras la página está a la vista

/** Torneo publicado: Zonas, Partidos y Playoff (solo lectura, para jugadores) */
export default function TorneoPublico({ id }: { id: string }) {
  const [cat, setCat] = useState<Categoria | null>(null)
  const [estadoCarga, setEstadoCarga] = useState<'cargando' | 'ok' | 'no-existe' | 'error'>('cargando')
  const [actualizado, setActualizado] = useState<Date | null>(null)
  // desde el calendario se llega con ?p=partidos (y la búsqueda del jugador, si había)
  const [pestana, setPestana] = useState<Pestana>(() => (parametro('p') === 'partidos' ? 'partidos' : parametro('p') === 'playoff' ? 'playoff' : 'zonas'))
  const [busqueda, setBusqueda] = useState(() => parametro('q'))

  const cargar = useCallback(async () => {
    try {
      const c = await cargarPublico(id)
      if (!c) { setEstadoCarga('no-existe'); return }
      setCat(c)
      setEstadoCarga('ok')
      setActualizado(new Date())
    } catch {
      // si ya había datos, se sigue mostrando lo último que se cargó
      setEstadoCarga((e) => (e === 'ok' ? 'ok' : 'error'))
    }
  }, [id])

  useEffect(() => {
    void cargar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void cargar() }, CADA)
    const alVolver = () => { if (document.visibilityState === 'visible') void cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver) }
  }, [cargar])

  const res = useMemo(() => (cat ? resolverTorneo(cat) : null), [cat])
  useEffect(() => { if (cat) document.title = `${cat.torneo} · Torneos NODO` }, [cat])

  if (estadoCarga === 'cargando') return <Spinner texto="Cargando torneo…" />
  if (estadoCarga === 'no-existe' || estadoCarga === 'error' || !cat || !res) {
    return (
      <div className="space-y-4">
        <Volver />
        <Vacio titulo={estadoCarga === 'error' ? 'No se pudo cargar el torneo' : 'Este torneo no está disponible'}>
          {estadoCarga === 'error' ? 'Revisá la conexión y probá de nuevo.' : 'Puede que el link esté mal o que el torneo ya no esté publicado.'}
        </Vacio>
      </div>
    )
  }

  const estado = estadoTorneo(cat, res.campeon)
  // publicado "solo info": datos del torneo + inscripción (las zonas y los partidos se muestran cuando el club lo decida)
  if (cat.soloInfo) return <InfoTorneo cat={cat} estado={estado} />
  const q = normalizarTexto(busqueda)
  const nombre = (pid: string | null) => (pid ? cat.parejas.find((p) => p.id === pid)?.nombre ?? '—' : '—')

  return (
    <div className="space-y-5">
      <Volver />

      {/* encabezado */}
      <header className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <BadgeCategoria categoria={cat.categoria} />
          <Badge tono={tonoEstado(estado)}>{nombreEstado(estado)}</Badge>
        </div>
        <h1 className="font-display text-4xl font-bold leading-none text-noche">{cat.torneo}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-noche/70">
          {cat.fechaInicio && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden />{rangoFechas(cat.fechaInicio, cat.fechaFin)}</span>}
          <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" aria-hidden />{cat.parejas.length} parejas</span>
          {cat.inscripcion && <span className="inline-flex items-center gap-1"><Ticket className="h-4 w-4" aria-hidden />Inscripción {formatoPesos(cat.inscripcion)} por jugador</span>}
          {cat.premio && <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" aria-hidden />Premio: {cat.premio}</span>}
        </div>
        {(cat.observacion || cat.zonas.length > 0) && (
          <p className="flex gap-1.5 text-xs text-noche/60"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {[cat.observacion.trim(), textoFormatos(cat, instanciasDelTorneo(cat))].filter(Boolean).join(' · ')}
          </p>
        )}
        <Compartir titulo={cat.torneo} />
      </header>

      {res.campeon && <Campeon nombre={nombre(res.campeon)} />}

      {/* buscador de jugador */}
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="¿Dónde juego? Buscá tu nombre o apellido" className="pl-9 pr-9" aria-label="Buscar jugador" />
        {busqueda && <button onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-noche/40"><X className="h-4 w-4" /></button>}
      </label>

      <Tabs<Pestana>
        opciones={[{ id: 'zonas', label: 'Zonas' }, { id: 'partidos', label: 'Partidos' }, { id: 'playoff', label: 'Playoff' }]}
        valor={pestana}
        onChange={setPestana}
      />

      {pestana === 'zonas' && (
        cat.zonas.length === 0 ? <Vacio titulo="Las zonas todavía no están armadas" /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {res.zonas.map((z) => <TablaZona key={z.zona} z={z} cat={cat} nombre={nombre} q={q} />)}
          </div>
        )
      )}

      {pestana === 'partidos' && <Partidos cat={cat} zonas={res.zonas} playoff={res.playoff} q={q} />}

      {pestana === 'playoff' && (
        !res.playoff ? <Vacio titulo="El playoff todavía no está armado">Se arma cuando terminan las zonas.</Vacio> : <Cuadro playoff={res.playoff} cat={cat} q={q} />
      )}

      {actualizado && (
        <p className="text-center text-[11px] text-noche/45">
          Actualizado {actualizado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })} · se actualiza solo cada 1 minuto
        </p>
      )}
    </div>
  )
}

/** Instancias que se muestran en el formato de un torneo "solo info" (todavía no se sabe cuántas parejas habrá: 16avos casi nunca se juega) */
const INSTANCIAS_INFO: Instancia[] = ['zonas', 'octavos', 'cuartos', 'semifinal', 'final']

/** Torneo publicado "solo info": cuándo es, formato, inscripción, premio y el link para inscribirse por WhatsApp */
function InfoTorneo({ cat, estado }: { cat: Categoria; estado: EstadoTorneo }) {
  const fechas = rangoFechas(cat.fechaInicio, cat.fechaFin)
  const abierta = estado === 'pendiente'
  return (
    <div className="space-y-5">
      <Volver />
      <header className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <BadgeCategoria categoria={cat.categoria} />
          <Badge tono={tonoEstado(estado)}>{nombreEstado(estado)}</Badge>
          {abierta && <Badge tono="pelota">Inscripción abierta</Badge>}
        </div>
        <h1 className="font-display text-4xl font-bold leading-none text-noche">{cat.torneo}</h1>
        <Compartir titulo={cat.torneo} />
      </header>

      <section className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-noche/10">
        {fechas && (
          <Dato icono={<CalendarDays className="h-5 w-5" aria-hidden />} titulo="Cuándo">{fechas}</Dato>
        )}
        <Dato icono={<ListChecks className="h-5 w-5" aria-hidden />} titulo="Formato">
          <span className="block">{textoFormatos(cat, INSTANCIAS_INFO)}</span>
          {cat.observacion.trim() && <span className="mt-1 block whitespace-pre-line text-noche/70">{cat.observacion.trim()}</span>}
        </Dato>
        {cat.inscripcion && (
          <Dato icono={<Ticket className="h-5 w-5" aria-hidden />} titulo="Inscripción">{formatoPesos(cat.inscripcion)} por jugador</Dato>
        )}
        {cat.premio && (
          <Dato icono={<Trophy className="h-5 w-5" aria-hidden />} titulo="Premio">{cat.premio}</Dato>
        )}
      </section>

      {abierta && (
        <section className="rounded-xl bg-[#1FA855]/10 p-4 ring-1 ring-[#1FA855]/30">
          <p className="font-display text-2xl font-bold leading-tight text-noche">Inscripciones</p>
          <p className="mt-1 text-sm text-noche/75">Para anotarte con tu pareja, escribinos por WhatsApp.</p>
          <a href={linkInscripcion(cat.torneo, fechas)} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#1FA855] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#18914A]">
            <MessageCircle className="h-4 w-4" aria-hidden /> Inscribirme por WhatsApp
          </a>
        </section>
      )}

      <p className="flex gap-1.5 text-xs text-noche/60">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Las zonas, los horarios y el playoff se publican en esta misma página cuando cierre la inscripción.
      </p>
    </div>
  )
}

function Dato({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-cancha">{icono}</span>
      <div className="min-w-0 text-sm text-noche">
        <p className="text-xs font-semibold uppercase tracking-wide text-noche/50">{titulo}</p>
        {children}
      </div>
    </div>
  )
}

/** parámetro del link del torneo (#/torneo/<id>?p=partidos&q=garcia) */
function parametro(clave: string): string {
  const i = window.location.hash.indexOf('?')
  return i < 0 ? '' : new URLSearchParams(window.location.hash.slice(i + 1)).get(clave) ?? ''
}

/** vuelve a la pestaña de donde se llegó (Calendario si se entró desde un partido del calendario) */
function Volver() {
  const desdeCalendario = window.location.hash.includes('?p=')
  return (
    <a href={desdeCalendario ? '#/calendario' : '#/'} className="inline-flex items-center gap-1 text-sm font-semibold text-cancha">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {desdeCalendario ? 'Calendario' : 'Torneos'}
    </a>
  )
}

function Campeon({ nombre }: { nombre: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-noche p-4 text-white">
      <Trophy className="h-8 w-8 shrink-0 text-pelota" aria-hidden />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Campeones</p>
        <p className="font-display text-2xl font-bold leading-tight">{nombre}</p>
      </div>
    </div>
  )
}

function Compartir({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false)
  // sin los parámetros del calendario (?p=…&q=…): se comparte el torneo tal cual
  const url = window.location.href.replace(/\?.*$/, '')
  const compartir = async () => {
    if (navigator.share) { try { await navigator.share({ title: titulo, text: `${titulo} · Torneos NODO`, url }) } catch { /* canceló */ } return }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${titulo} · Torneos NODO\n${url}`)}`, '_blank')
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { prompt('Copiá el link:', url) }
  }
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button onClick={compartir} className="inline-flex items-center gap-2 rounded-lg bg-[#1FA855] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#18914A]">
        <Share2 className="h-4 w-4" aria-hidden /> Compartir
      </button>
      <button onClick={copiar} className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold text-cancha ring-1 ring-cancha/30 hover:bg-cancha-suave">
        {copiado ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />} {copiado ? 'Copiado' : 'Copiar link'}
      </button>
    </div>
  )
}

/** Resalta la pareja si coincide con lo buscado */
const coincide = (texto: string, q: string) => !!q && normalizarTexto(texto).includes(q)

// ------------------------------------------------------------------ zonas

function TablaZona({ z, cat, nombre, q }: { z: ZonaResuelta; cat: Categoria; nombre: (id: string | null) => string; q: string }) {
  const { tabla } = z
  const clasifican = (cat.zonas[z.zona]?.length ?? 0) === 4 ? 3 : 2
  const jugados = z.partidos.filter((p) => p.estado === 'jugado').length
  return (
    <section className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
      <header className="flex items-center justify-between bg-noche px-3 py-2 text-white">
        <h2 className="font-display text-xl font-bold">Zona {LETRAS[z.zona]}</h2>
        <span className="text-xs text-white/70">{tabla.completa ? 'Terminada' : `${jugados} de ${z.partidos.length} partidos`}</span>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-vidrio text-[11px] uppercase tracking-wide text-noche/60">
          <tr><th className="w-8 px-2 py-1.5 text-center">#</th><th className="px-2 py-1.5 text-left">Pareja</th><th className="px-1.5 text-center">PJ</th><th className="px-1.5 text-center">PG</th><th className="px-1.5 text-center">Sets</th><th className="px-1.5 text-center">Games</th></tr>
        </thead>
        <tbody className="divide-y divide-noche/5">
          {tabla.filas.map((f, i) => {
            const pos = tabla.posiciones[i] === f.id ? i + 1 : null
            const clasifica = pos !== null && pos <= clasifican
            const n = nombre(f.id)
            return (
              <tr key={f.id} className={clasifica ? 'bg-pelota/15' : ''}>
                <td className="num px-2 py-2 text-center font-display text-base font-bold text-noche/70">{pos ?? '–'}</td>
                <td className={`px-2 py-2 font-medium ${coincide(n, q) ? 'bg-pelota/40' : ''}`}>{n}</td>
                <td className="num px-1.5 text-center">{f.pj}</td>
                <td className="num px-1.5 text-center font-semibold">{f.pg}</td>
                <td className="num px-1.5 text-center">{f.sf}-{f.sc}</td>
                <td className="num px-1.5 text-center">{f.gf}-{f.gc}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {tabla.completa && <p className="px-3 py-1.5 text-[11px] text-noche/50">Clasifican {clasifican} {clasifican === 3 ? '(zona de 4)' : ''} al playoff.</p>}
    </section>
  )
}

// ------------------------------------------------------------------ partidos

function Partidos({ cat, zonas, playoff, q }: { cat: Categoria; zonas: ZonaResuelta[]; playoff: Partido[][] | null; q: string }) {
  const filtrar = (ps: Partido[]) => ps.filter((p) => !p.bye && (!q || coincide(p.etiquetaA, q) || coincide(p.etiquetaB, q)))
  const grupos: { titulo: string; partidos: Partido[]; horarios: Record<string, Horario> }[] = [
    ...zonas.map((z) => ({ titulo: `Zona ${LETRAS[z.zona]}`, partidos: filtrar(z.partidos), horarios: cat.horariosZona })),
    ...(playoff ?? []).map((r) => ({ titulo: nombreInstancia(r[0].instancia), partidos: filtrar(r), horarios: cat.horariosPlayoff })),
  ].filter((g) => g.partidos.length)

  if (!cat.zonas.length) return <Vacio titulo="Todavía no hay partidos" />
  if (!grupos.length) return <Vacio titulo="No encontramos partidos con ese nombre" />
  return (
    <div className="space-y-4">
      {!playoff && !q && <Alerta tipo="info">Los partidos del playoff aparecen cuando se arma el cuadro.</Alerta>}
      {grupos.map((g) => (
        <section key={g.titulo} className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
          <h2 className="border-b border-noche/10 px-3 py-2 font-display text-xl font-bold text-noche">{g.titulo}</h2>
          <ul className="divide-y divide-noche/5">
            {g.partidos.map((p) => <li key={p.key}><FilaPartido p={p} h={g.horarios[p.key]} q={q} /></li>)}
          </ul>
        </section>
      ))}
    </div>
  )
}

function FilaPartido({ p, h, q }: { p: Partido; h: Horario | undefined; q: string }) {
  const jugado = p.estado === 'jugado' && !!p.resultado
  const [dia, hora] = h?.fecha || h?.hora ? textoHorario(h, true).split(' · ') : ['A confirmar', '']
  const lado = (id: string | null, etiqueta: string) => {
    const gano = jugado && id === p.ganador
    return (
      <span className={`block truncate ${!id ? 'italic text-noche/45' : gano ? 'font-bold text-noche' : jugado ? 'text-noche/55' : 'font-medium text-noche'} ${coincide(etiqueta, q) ? 'rounded bg-pelota/40 px-1' : ''}`}>
        {etiqueta}
      </span>
    )
  }
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${jugado ? 'bg-emerald-50/40' : ''}`}>
      <div className="w-20 shrink-0 text-xs leading-tight text-noche/60">
        <span className={`block ${dia === 'A confirmar' ? 'italic' : 'font-semibold text-noche/80'}`}>{dia}</span>
        {hora && <span className="block">{hora} hs</span>}
      </div>
      <div className="min-w-0 flex-1 text-sm leading-snug">
        {lado(p.a, p.etiquetaA)}
        <span className="block text-[10px] uppercase text-noche/35">vs</span>
        {lado(p.b, p.etiquetaB)}
      </div>
      <Marcador p={p} />
    </div>
  )
}

/** Marcador set por set (o W.O.); si no se jugó, el estado */
function Marcador({ p }: { p: Partido }) {
  if (p.estado !== 'jugado' || !p.resultado) return <Badge>{p.estado === 'esperando' ? 'A definir' : 'A jugar'}</Badge>
  if (p.resultado.wo) return <Badge tono="pelota">W.O.</Badge>
  return (
    <div className="flex gap-1">
      {p.resultado.sets.map(([x, y], i) => (
        <span key={i} className="num grid w-7 rounded bg-vidrio py-0.5 text-center text-sm leading-tight">
          <span className={x > y ? 'font-bold' : 'text-noche/50'}>{x}</span>
          <span className={y > x ? 'font-bold' : 'text-noche/50'}>{y}</span>
        </span>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ playoff (cuadro)

function Cuadro({ playoff, cat, q }: { playoff: Partido[][]; cat: Categoria; q: string }) {
  // si la primera ronda es toda de parejas que pasan directo, arranca en la siguiente
  const rondas = playoff[0].every((p) => p.bye) ? playoff.slice(1) : playoff
  const alto = Math.max(rondas[0].length * 118, 240)
  return (
    <div className="overflow-x-auto rounded-xl bg-white p-3 ring-1 ring-noche/10">
      <div className="flex gap-4" style={{ minWidth: rondas.length * 236 }}>
        {rondas.map((r, ri) => (
          <div key={ri} className="flex flex-1 flex-col">
            <p className="mb-2 rounded-full bg-vidrio py-1 text-center font-display text-sm font-bold uppercase tracking-wide text-cancha">{nombreInstancia(r[0].instancia)}</p>
            <div className="flex flex-1 flex-col justify-around gap-3" style={{ minHeight: alto }}>
              {r.map((p) => <CajaCruce key={p.key} p={p} h={cat.horariosPlayoff[p.key]} q={q} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CajaCruce({ p, h, q }: { p: Partido; h: Horario | undefined; q: string }) {
  const jugado = p.estado === 'jugado' && !!p.resultado
  const fila = (k: 0 | 1) => {
    const id = k === 0 ? p.a : p.b
    const etiqueta = k === 0 ? p.etiquetaA : p.etiquetaB
    const gano = (jugado || p.bye) && !!id && id === p.ganador
    const sets = jugado && p.resultado && !p.resultado.wo ? p.resultado.sets.map((s) => s[k]) : []
    return (
      <div className={`flex items-center gap-2 px-2 py-1.5 ${gano ? 'border-l-4 border-pelota pl-1.5' : ''}`}>
        <span className={`min-w-0 flex-1 truncate text-[13px] ${!id ? 'italic text-noche/45' : gano ? 'font-bold' : jugado ? 'text-noche/55' : 'font-medium'} ${coincide(etiqueta, q) ? 'rounded bg-pelota/40 px-1' : ''}`}>
          {etiqueta}
        </span>
        {sets.map((v, i) => {
          const otro = p.resultado!.sets[i][1 - k]
          return <span key={i} className={`num w-4 text-center text-[13px] ${v > otro ? 'font-bold' : 'text-noche/45'}`}>{v}</span>
        })}
        {jugado && p.resultado?.wo && gano && <span className="text-[11px] font-bold text-cancha">W.O.</span>}
      </div>
    )
  }
  if (p.bye) {
    return (
      <div className="rounded-lg bg-vidrio/60 ring-1 ring-noche/5">
        {fila(p.a ? 0 : 1)}
        <p className="px-2 pb-1.5 text-[10px] uppercase text-noche/40">Pasa directo</p>
      </div>
    )
  }
  return (
    <div className={`overflow-hidden rounded-lg ring-1 ${p.instancia === 'final' ? 'ring-2 ring-pelota' : jugado ? 'ring-cancha/30' : 'ring-noche/10'}`}>
      <p className="bg-vidrio px-2 py-1 text-[11px] text-noche/60">{textoHorario(h, true)}</p>
      {fila(0)}
      <div className="mx-2 border-t border-noche/10" />
      {fila(1)}
    </div>
  )
}
