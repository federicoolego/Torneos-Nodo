import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, Download, FileText, Pencil, Printer, RefreshCw, Share2, Trash2, Trophy } from 'lucide-react'
import { LETRAS, nombreFormato, nombreInstancia, textoHorario, type Categoria, type Horario, type Resultado } from '../../lib/torneo'
import { esAmericano, evaluar, resolverTorneo, setsMax, textoResultado, type Partido, type ZonaResuelta } from '../../lib/resultados'
import { docWord, filasCronograma, htmlCronograma, logoPng } from '../../lib/cronograma'
import { logoUrl } from '../../App'
import { Alerta, Button, Card } from '../ui'
import { SelectorFormato } from '../Formato'
import { EditorHorario } from '../Horarios'

// Colores del documento (los de la marca del complejo)
const COLORES = { oscuro: '#042D29', acento: '#C8DC3C', suave: '#F2F6F4' }

type Cambiar = (f: (c: Categoria) => Categoria) => void
type Props = { cat: Categoria; cambiar: Cambiar; onRecargar: () => Promise<void> }

/** Carga de resultados (zonas → posiciones → cruces) y cronograma imprimible */
export default function PasoPartidos({ cat, cambiar, onRecargar }: Props) {
  const res = useMemo(() => resolverTorneo(cat), [cat])
  const nombre = (id: string | null) => (id ? cat.parejas.find((p) => p.id === id)?.nombre ?? '—' : '—')
  const [recargando, setRecargando] = useState(false)

  const setResultado = (p: Partido, r: Resultado | null) =>
    cambiar((c) => {
      const campo = p.tipo === 'zona' ? 'resultadosZona' : 'resultadosPlayoff'
      const nuevo = { ...c[campo] }
      if (r) nuevo[p.key] = r
      else delete nuevo[p.key]
      return { ...c, [campo]: nuevo }
    })
  /** Reprogramar: mismo partido (mismos rivales), otro día/hora */
  const setHorario = (p: Partido, h: Horario) =>
    cambiar((c) => (p.tipo === 'zona'
      ? { ...c, horariosZona: { ...c.horariosZona, [p.key]: h } }
      : { ...c, horariosPlayoff: { ...c.horariosPlayoff, [p.key]: h } }))

  const jugados = [...res.zonas.flatMap((z) => z.partidos), ...(res.playoff ?? []).flat()].filter((p) => p.estado === 'jugado').length
  const total = [...res.zonas.flatMap((z) => z.partidos), ...(res.playoff ?? []).flat()].filter((p) => !p.bye).length

  return (
    <div className="space-y-6">
      <Cronograma cat={cat} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-noche/70">
          <strong className="num">{jugados}</strong> de <span className="num">{total}</span> partidos con resultado. Las posiciones y los cruces se completan solos.
        </p>
        <Button variante="secundario" cargando={recargando} onClick={async () => { setRecargando(true); try { await onRecargar() } finally { setRecargando(false) } }}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Traer cambios
        </Button>
      </div>

      {res.campeon && (
        <div className="flex items-center gap-3 rounded-xl bg-noche p-4 text-white">
          <Trophy className="h-8 w-8 shrink-0 text-pelota" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Campeones</p>
            <p className="font-display text-2xl font-bold leading-tight">{nombre(res.campeon)}</p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <EncabezadoInstancia titulo="Zonas" cat={cat} cambiar={cambiar} instancia="zonas" />
        <div className="grid gap-4 lg:grid-cols-2">
          {res.zonas.map((z) => (
            <ZonaCard key={z.zona} z={z} cat={cat} cambiar={cambiar} nombre={nombre} onResultado={setResultado} onHorario={setHorario} />
          ))}
        </div>
      </section>

      {!res.playoff ? (
        <Alerta tipo="aviso">Todavía no hay un playoff válido: armalo en el paso “Playoff” para cargar sus resultados.</Alerta>
      ) : (
        res.playoff.map((ronda, ri) => {
          const visibles = ronda.filter((p) => !p.bye)
          if (!visibles.length) return null
          return (
            <section key={ri} className="space-y-3">
              <EncabezadoInstancia titulo={nombreInstancia(ronda[0].instancia)} cat={cat} cambiar={cambiar} instancia={ronda[0].instancia} />
              <ul className="grid gap-3 md:grid-cols-2">
                {visibles.map((p) => (
                  <li key={p.key}><CargaPartido p={p} horario={cat.horariosPlayoff[p.key]} onGuardar={(r) => setResultado(p, r)} onHorario={(h) => setHorario(p, h)} desde={cat.fechaInicio} hasta={cat.fechaFin} /></li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

function EncabezadoInstancia({ titulo, cat, cambiar, instancia }: { titulo: string; cat: Categoria; cambiar: Cambiar; instancia: Partido['instancia'] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-noche/10 pb-2">
      <h3 className="font-display text-2xl font-bold">{titulo}</h3>
      <SelectorFormato cat={cat} cambiar={cambiar} instancia={instancia} />
    </div>
  )
}

// ------------------------------------------------------------------ zona: tabla + partidos

function ZonaCard({ z, cat, cambiar, nombre, onResultado, onHorario }: {
  z: ZonaResuelta; cat: Categoria; cambiar: Cambiar; nombre: (id: string | null) => string
  onResultado: (p: Partido, r: Resultado | null) => void; onHorario: (p: Partido, h: Horario) => void
}) {
  const { tabla } = z
  const clasifican = (cat.zonas[z.zona]?.length ?? 0) === 4 ? 3 : 2
  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
      <header className="flex items-center justify-between bg-noche px-3 py-2 text-white">
        <p className="font-display text-lg font-bold">Zona {LETRAS[z.zona]}</p>
        <span className="text-xs text-white/70">{tabla.completa ? (tabla.posiciones.every(Boolean) ? 'Terminada' : 'Falta definir empate') : 'En juego'}</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-vidrio text-[11px] uppercase tracking-wide text-noche/60">
            <tr><th className="w-8 px-2 py-1.5 text-center">#</th><th className="px-2 py-1.5 text-left">Pareja</th><th className="px-2 text-center">PJ</th><th className="px-2 text-center">PG</th><th className="px-2 text-center">Sets</th><th className="px-2 text-center">Games</th></tr>
          </thead>
          <tbody className="divide-y divide-noche/5">
            {tabla.filas.map((f, i) => {
              const pos = tabla.posiciones[i] === f.id ? i + 1 : null
              const clasifica = pos !== null && pos <= clasifican
              return (
                <tr key={f.id} className={clasifica ? 'bg-pelota/15' : ''}>
                  <td className="num px-2 py-1.5 text-center font-display text-base font-bold text-noche/70">{pos ?? '–'}</td>
                  <td className="px-2 py-1.5 font-medium">{nombre(f.id)}</td>
                  <td className="num px-2 text-center">{f.pj}</td>
                  <td className="num px-2 text-center font-semibold">{f.pg}</td>
                  <td className="num px-2 text-center">{f.sf}-{f.sc}</td>
                  <td className="num px-2 text-center">{f.gf}-{f.gc}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {tabla.empatados.length > 0 && <Desempate zi={z.zona} ids={tabla.empatados} nombre={nombre} cambiar={cambiar} />}
      {tabla.desempateManual && (
        <p className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-noche/60">
          Empate total definido a mano (sorteo).
          <button className="font-semibold text-cancha" onClick={() => cambiar((c) => { const d = { ...c.desempates }; delete d[String(z.zona)]; return { ...c, desempates: d } })}>Cambiar</button>
        </p>
      )}
      <ul className="space-y-2 border-t border-noche/10 bg-vidrio/50 p-3">
        {z.partidos.map((p) => (
          <li key={p.key}><CargaPartido p={p} horario={cat.horariosZona[p.key]} onGuardar={(r) => onResultado(p, r)} onHorario={(h) => onHorario(p, h)} desde={cat.fechaInicio} hasta={cat.fechaFin} /></li>
        ))}
      </ul>
    </div>
  )
}

/** Empate total (mismos partidos, sets y games): se ordena a mano según el sorteo */
function Desempate({ zi, ids, nombre, cambiar }: { zi: number; ids: string[]; nombre: (id: string | null) => string; cambiar: Cambiar }) {
  const [orden, setOrden] = useState(ids)
  useEffect(() => setOrden(ids), [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const mover = (i: number, d: -1 | 1) => setOrden((o) => { const c = [...o]; [c[i], c[i + d]] = [c[i + d], c[i]]; return c })
  return (
    <div className="m-3 space-y-2 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
      <p className="font-semibold text-amber-900">Empate total: mismos partidos ganados, diferencia de sets y de games. Ordenalos según el sorteo:</p>
      <ol className="space-y-1">
        {orden.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded bg-white px-2 py-1">
            <span className="num w-4 font-bold text-noche/50">{i + 1}</span>
            <span className="flex-1">{nombre(id)}</span>
            <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="p-1 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
            <button onClick={() => mover(i, 1)} disabled={i === orden.length - 1} aria-label="Bajar" className="p-1 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
          </li>
        ))}
      </ol>
      <Button className="py-1.5" onClick={() => cambiar((c) => ({ ...c, desempates: { ...c.desempates, [String(zi)]: orden } }))}>Confirmar orden</Button>
    </div>
  )
}

// ------------------------------------------------------------------ carga de un partido

type Borrador = { sets: [string, string][]; wo: '' | 'a' | 'b' }
const borradorDe = (r: Resultado | undefined, n: number): Borrador => ({
  sets: Array.from({ length: n }, (_, i) => (r && !r.wo && r.sets[i] ? [String(r.sets[i][0]), String(r.sets[i][1])] : ['', ''])),
  wo: r?.wo ?? '',
})

/** Carga / edición del resultado de un partido (también la usa el cronograma unificado) */
export function CargaPartido({ p, horario, onGuardar, onHorario, desde, hasta }: {
  p: Partido; horario: Horario | undefined; onGuardar: (r: Resultado | null) => void; onHorario: (h: Horario) => void
  /** fechas del torneo */
  desde?: string; hasta?: string
}) {
  const [editando, setEditando] = useState(false)
  const [reprogramando, setReprogramando] = useState(false)
  const jugado = p.estado === 'jugado' || (p.estado === 'invalido' && !!p.resultado)
  const n = setsMax(p.formato)
  const [b, setB] = useState<Borrador>(() => borradorDe(p.resultado, n))
  useEffect(() => { if (!editando) setB(borradorDe(p.resultado, n)) }, [p.resultado, n, editando])

  // resultado armado con lo que se escribió (sets completos, en orden)
  let sets: [number, number][] = []
  for (const [x, y] of b.sets) { if (x === '' || y === '') break; sets.push([Number(x), Number(y)]) }
  // el 3er set solo se habilita (y se tiene en cuenta) si los 2 primeros quedaron 1-1
  const unoYuno = !esAmericano(p.formato) && sets.length >= 2 && (sets[0][0] > sets[0][1]) !== (sets[1][0] > sets[1][1])
  if (!esAmericano(p.formato) && !unoYuno) sets = sets.slice(0, 2)
  const borrador: Resultado = { a: p.a ?? '', b: p.b ?? '', sets: b.wo ? [] : sets, ...(b.wo ? { wo: b.wo } : {}) }
  const ev = evaluar(p.formato, borrador)

  const guardar = () => { if (ev.ok && p.a && p.b) { onGuardar(borrador); setEditando(false) } }
  const set = (i: number, k: 0 | 1, v: string) => setB((x) => {
    const s = x.sets.map((q) => [...q] as [string, string])
    s[i][k] = v.replace(/\D/g, '').slice(0, 2)
    return { ...x, sets: s }
  })

  const ganador = p.estado === 'jugado' ? p.ganador : null
  const lado = (id: string | null, etiqueta: string) => (
    <span className={`min-w-0 truncate ${ganador && id === ganador ? 'font-bold text-noche' : ganador ? 'text-noche/55' : 'font-medium'} ${!id ? 'italic text-noche/45' : ''}`}>{etiqueta}</span>
  )

  return (
    <div className={`rounded-lg bg-white p-3 ring-1 ${p.estado === 'desactualizado' || p.estado === 'invalido' ? 'ring-amber-400' : 'ring-noche/10'}`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs text-noche/55">
        <span className="font-semibold text-cancha">{p.titulo}</span>
        <span className="flex items-center gap-2">
          {textoHorario(horario, true)}
          {!jugado && !editando && (
            <button onClick={() => setReprogramando(!reprogramando)} title="Reprogramar" aria-label="Reprogramar"
              className={`rounded p-0.5 hover:bg-cancha-suave ${reprogramando ? 'text-cancha' : 'text-noche/45'}`}>
              <CalendarClock className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>
      {reprogramando && !jugado && (
        <div className="mb-2 space-y-1 rounded-md bg-vidrio p-2">
          <p className="text-[11px] font-semibold text-noche/60">Reprogramar (mismos rivales, fecha y hora futuras)</p>
          <EditorHorario valor={horario} onChange={onHorario} desde={desde} hasta={hasta} />
        </div>
      )}

      {!editando ? (
        <div className="flex items-center gap-3">
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            {lado(p.a, p.etiquetaA)}
            {lado(p.b, p.etiquetaB)}
          </div>
          {p.estado === 'jugado' && p.resultado && (
            <div className="flex gap-1">
              {p.resultado.wo ? <span className="rounded bg-pelota px-2 py-1 text-xs font-bold">W.O.</span> :
                p.resultado.sets.map(([x, y], i) => (
                  <span key={i} className="num grid w-7 rounded bg-vidrio py-0.5 text-center text-sm leading-tight">
                    <span className={x > y ? 'font-bold' : 'text-noche/50'}>{x}</span>
                    <span className={y > x ? 'font-bold' : 'text-noche/50'}>{y}</span>
                  </span>
                ))}
            </div>
          )}
          {p.estado !== 'esperando' && p.a && p.b && (
            <button onClick={() => { setB(borradorDe(p.estado === 'jugado' || p.estado === 'invalido' ? p.resultado : undefined, n)); setEditando(true) }}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-cancha hover:bg-cancha-suave">
              <Pencil className="h-3.5 w-3.5" aria-hidden /> {p.estado === 'pendiente' ? 'Cargar' : 'Editar'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid items-center gap-x-2 gap-y-1" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${n}, 2.75rem)` }}>
            <span />
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="text-center text-[10px] font-semibold uppercase text-noche/50">
                {esAmericano(p.formato) ? 'Games' : i === 2 && p.formato === 'mejor_de_3_stb' ? 'S. TB 11' : `Set ${i + 1}`}
              </span>
            ))}
            {(['a', 'b'] as const).map((l, k) => (
              <Fila key={l} etiqueta={l === 'a' ? p.etiquetaA : p.etiquetaB}>
                {b.sets.map((s, i) => (
                  <input key={i} inputMode="numeric" value={s[k]} onChange={(e) => set(i, k as 0 | 1, e.target.value)} disabled={!!b.wo || (i === 2 && !unoYuno)}
                    aria-label={`${l === 'a' ? p.etiquetaA : p.etiquetaB}, ${i + 1}`}
                    className="num w-full rounded-md border-0 py-1.5 text-center text-base font-semibold ring-1 ring-inset ring-noche/20 focus:ring-2 focus:ring-cancha disabled:bg-vidrio disabled:text-noche/30" />
                ))}
              </Fila>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-noche/70">
            W.O.:
            <select value={b.wo} onChange={(e) => setB((x) => ({ ...x, wo: e.target.value as Borrador['wo'] }))} className="rounded-md border-0 py-1 text-xs ring-1 ring-inset ring-noche/15">
              <option value="">No</option>
              <option value="a">Gana {p.etiquetaA}</option>
              <option value="b">Gana {p.etiquetaB}</option>
            </select>
          </label>
          {!ev.ok && (sets.length > 0 || b.wo) && <p className="text-xs text-red">{ev.error}</p>}
          <p className="text-[11px] text-noche/50">{nombreFormato(p.formato)}</p>
          <div className="flex flex-wrap gap-2">
            <Button className="py-1.5" onClick={guardar} disabled={!ev.ok}>Guardar</Button>
            <Button className="py-1.5" variante="secundario" onClick={() => setEditando(false)}>Cancelar</Button>
            {p.resultado && (
              <Button className="ml-auto py-1.5" variante="peligro" onClick={() => { if (confirm('¿Borrar el resultado?')) { onGuardar(null); setEditando(false) } }}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Borrar
              </Button>
            )}
          </div>
        </div>
      )}

      {p.estado === 'desactualizado' && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <span>El resultado cargado ({textoResultado(p.resultado)}) era de otras parejas: cambió un resultado anterior o las zonas.</span>
          <button className="shrink-0 font-semibold underline" onClick={() => onGuardar(null)}>Quitar</button>
        </div>
      )}
      {p.estado === 'invalido' && !editando && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          {textoResultado(p.resultado)} no es válido para {nombreFormato(p.formato).toLowerCase()}: {p.eval?.error} Editalo.
        </p>
      )}
    </div>
  )
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <>
      <span className="truncate text-sm font-medium">{etiqueta}</span>
      {children}
    </>
  )
}

// ------------------------------------------------------------------ cronograma (PDF / imprimir / Word)

function Cronograma({ cat }: { cat: Categoria }) {
  const [logo, setLogo] = useState<string | null>(null)
  useEffect(() => { logoPng(logoUrl()).then(setLogo) }, [])
  const filas = useMemo(() => filasCronograma(cat), [cat])
  const html = useMemo(() => htmlCronograma(cat, logo, COLORES), [cat, logo])
  const sinHorario = filas.filter((f) => !f.fecha || !f.hora).length
  const nombreArchivo = `Partidos - ${[cat.torneo].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, '')}`
  const [verPrevia, setVerPrevia] = useState(false)
  // el PDF se arma de antemano: compartir tiene que ejecutarse enseguida después del toque
  const [pdf, setPdf] = useState<File | null>(null)
  useEffect(() => {
    let vigente = true
    setPdf(null)
    if (!filas.length) return
    const t = setTimeout(() => {
      import('../../lib/cronogramaPdf')
        .then(({ pdfCronograma }) => { if (vigente) setPdf(new File([pdfCronograma(cat, logo, COLORES)], `${nombreArchivo}.pdf`, { type: 'application/pdf' })) })
        .catch(() => { /* sin PDF: quedan imprimir y Word */ })
    }, 400)
    return () => { vigente = false; clearTimeout(t) }
  }, [cat, logo, filas.length, nombreArchivo])
  const puedeCompartir = !!pdf && typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdf] })

  function descargarPdf() {
    if (!pdf) return
    const url = URL.createObjectURL(pdf)
    const a = document.createElement('a')
    a.href = url
    a.download = pdf.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function compartirPdf() {
    if (!pdf) return
    if (!puedeCompartir) return descargarPdf()
    try { await navigator.share({ files: [pdf], title: `Partidos · ${cat.torneo}` }) } catch { /* canceló */ }
  }
  function imprimir() {
    const w = window.open('', '_blank')
    if (!w) return alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio.')
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.onload = () => setTimeout(() => w.print(), 300)
  }
  function word() {
    const url = URL.createObjectURL(docWord(htmlCronograma(cat, null, COLORES)))
    const a = document.createElement('a')
    a.href = url
    a.download = `${nombreArchivo}.doc`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-noche/75">
          Cronograma de todos los partidos en orden, con los <strong>resultados ya cargados</strong> y lugar para anotar los que faltan.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={compartirPdf} disabled={!pdf}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1FA855] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18914A] disabled:opacity-50">
            <Share2 className="h-4 w-4" aria-hidden /> {puedeCompartir ? 'Compartir PDF' : 'Descargar PDF'}
          </button>
          {puedeCompartir && <Button variante="secundario" onClick={descargarPdf}><Download className="h-4 w-4" aria-hidden /> PDF</Button>}
          <Button variante="secundario" onClick={imprimir} disabled={!filas.length}><Printer className="h-4 w-4" aria-hidden /> Imprimir</Button>
          <Button variante="secundario" onClick={word} disabled={!filas.length}><FileText className="h-4 w-4" aria-hidden /> Word</Button>
          <Button variante="fantasma" onClick={() => setVerPrevia(!verPrevia)}>{verPrevia ? 'Ocultar vista previa' : 'Vista previa'}</Button>
        </div>
      </div>
      {sinHorario > 0 && <Alerta tipo="aviso">{sinHorario} partido(s) no tienen día u horario: aparecen al final, en “Sin día asignado”.</Alerta>}
      {verPrevia && (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
          <iframe title="Vista previa del cronograma" srcDoc={html} className="h-[70vh] w-full" />
        </div>
      )}
    </Card>
  )
}
