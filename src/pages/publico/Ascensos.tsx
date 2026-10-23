import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, History, Search, TrendingUp, X } from 'lucide-react'
import { MOSTRAR_RECATEGORIZACIONES_PUBLICAS, ascensosPublicos, type MovimientoPublico, type TandaPublica } from '../../lib/publico'
import { CATEGORIAS_JUGADOR, esCategoriaJugador, rama, type CategoriaJugador, type Rama } from '../../lib/categorias'
import { claveJugador, nombrePropio } from '../../lib/torneo'
import { ESTILO_CATEGORIA } from '../../components/Categoria'
import { EncabezadoCard, compartirArchivos, useColapso } from '../../components/CardsCategorias'
import { Alerta, Input, Spinner, Vacio } from '../../components/ui'

interface Mov { nombre: string; anterior: CategoriaJugador; nueva: CategoriaJugador; tipo: MovimientoPublico['tipo'] }
interface Tanda { id: string; nombre: string; vigencia: string; movimientos: Mov[] }
interface Grupo { tipo: Mov['tipo']; categoria: CategoriaJugador; movimientos: Mov[] }
type FiltroRama = 'todas' | Rama

const num = (c: string) => c.split(' ')[0]
/** 2026-11-01 → 01/11/2026 */
const fechaCorta = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-'); return a && m && d ? `${d}/${m}/${a}` : iso }
/** 2026-11-01 → Noviembre 2026 */
const mesAnio = (iso: string) => {
  const s = new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Agrupa por tipo (primero ascensos) y por categoría nueva, en el orden de las categorías */
function agrupar(movs: Mov[]): Grupo[] {
  const out: Grupo[] = []
  for (const tipo of ['ascenso', 'recategorizacion'] as const) {
    for (const c of CATEGORIAS_JUGADOR) {
      const m = movs.filter((x) => x.tipo === tipo && x.nueva === c)
      if (m.length) out.push({ tipo, categoria: c, movimientos: m })
    }
  }
  return out
}

/**
 * Ascensos y recategorizaciones que publicó el club, de la tanda más nueva a la más vieja (historial).
 * `cargar` se puede reemplazar (vista previa con datos de ejemplo).
 */
export default function AscensosPublicos({ cargar = ascensosPublicos }: { cargar?: () => Promise<TandaPublica[]> }) {
  const [tandas, setTandas] = useState<Tanda[] | null>(null)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [filtroRama, setFiltroRama] = useState<FiltroRama>('todas')
  // tandas abiertas: por defecto, solo la última
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())
  const { colapsada, alternar } = useColapso()
  const [generando, setGenerando] = useState<string | null>(null)

  useEffect(() => {
    cargar()
      .then((l) => {
        const ts = l.map((t): Tanda => ({
          id: t.id, nombre: t.nombre, vigencia: t.vigencia,
          movimientos: t.movimientos
            .filter((m) => esCategoriaJugador(m.anterior) && esCategoriaJugador(m.nueva))
            .filter((m) => MOSTRAR_RECATEGORIZACIONES_PUBLICAS || m.tipo === 'ascenso')
            .map((m) => ({ ...m, nombre: nombrePropio(m.nombre), anterior: m.anterior as CategoriaJugador, nueva: m.nueva as CategoriaJugador }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        })).filter((t) => t.movimientos.length)
        setTandas(ts)
        if (ts[0]) setAbiertas(new Set([ts[0].id]))
      })
      .catch(() => { setError('No se pudieron cargar los ascensos.'); setTandas([]) })
  }, [cargar])

  // todas las palabras tienen que aparecer, en cualquier orden ("grego massot" encuentra a "Massot Grego")
  const palabras = claveJugador(texto).split(' ').filter(Boolean)
  const buscando = palabras.length > 0
  const coincide = (n: string) => palabras.every((p) => claveJugador(n).includes(p))

  const visibles = useMemo(() => (tandas ?? [])
    .map((t) => ({ ...t, movimientos: t.movimientos.filter((m) => (filtroRama === 'todas' || rama(m.nueva) === filtroRama) && (!buscando || coincide(m.nombre))) }))
    .filter((t) => t.movimientos.length),
  [tandas, filtroRama, texto]) // eslint-disable-line react-hooks/exhaustive-deps

  // historial de cada jugador que coincide con la búsqueda (hasta 3, si no la búsqueda es muy amplia)
  const historiales = useMemo(() => {
    if (!buscando) return []
    const m = new Map<string, { tanda: Tanda; mov: Mov }[]>()
    for (const t of visibles) for (const mov of t.movimientos) m.set(mov.nombre, [...(m.get(mov.nombre) ?? []), { tanda: t, mov }])
    return m.size <= 3 ? [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')) : []
  }, [visibles, buscando])

  const abierta = (id: string) => buscando || abiertas.has(id)
  const alternarTanda = (id: string) => setAbiertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function compartir(clave: string, g: Grupo, t: Tanda) {
    setGenerando(clave)
    try {
      // se carga recién al compartir (no suma peso a la página)
      const { imagenesAscenso, imagenesRecategorizacion } = await import('../../lib/imagenes')
      // siempre la categoría completa de la tanda (no solo lo que coincide con la búsqueda)
      const completa = tandas?.find((x) => x.id === t.id)?.movimientos.filter((m) => m.tipo === g.tipo && m.nueva === g.categoria) ?? g.movimientos
      const datos = { categoria: g.categoria, rama: rama(g.categoria), tanda: t.nombre, vigencia: fechaCorta(t.vigencia), jugadores: completa.map((m) => ({ nombre: m.nombre, antes: m.anterior })) }
      const blobs = g.tipo === 'ascenso' ? await imagenesAscenso(datos) : await imagenesRecategorizacion(datos)
      const base = `${g.tipo === 'ascenso' ? 'Ascensos' : 'Recategorización'} ${g.categoria}`.replace(/[\\/:*?"<>|]+/g, '')
      await compartirArchivos(blobs.map((b, i) => new File([b], `${base}${blobs.length > 1 ? ` (${i + 1} de ${blobs.length})` : ''}.png`, { type: 'image/png' })), base)
    } catch { alert('No se pudo generar la imagen.') } finally { setGenerando(null) }
  }

  const total = (tandas ?? []).reduce((n, t) => n + t.movimientos.filter((m) => m.tipo === 'ascenso').length, 0)

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Ascensos</h1>
        <p className="mt-2 max-w-prose text-sm text-noche/70">
          {MOSTRAR_RECATEGORIZACIONES_PUBLICAS ? 'Los ascensos y recategorizaciones que publicó NODO en cada corte' : 'Los ascensos que publicó NODO en cada corte'}, del más nuevo al más viejo. Buscá tu nombre para ver tu historial.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscá por nombre o apellido…" className="pl-9 pr-9" aria-label="Buscar jugador" />
          {texto && <button onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-noche/40"><X className="h-4 w-4" /></button>}
        </label>
        <div role="radiogroup" aria-label="Rama" className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-noche/10">
          {(['todas', 'Damas', 'Caballeros'] as const).map((r) => (
            <button key={r} role="radio" aria-checked={filtroRama === r} onClick={() => setFiltroRama(r)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cancha ${
                filtroRama === r ? (r === 'todas' ? 'bg-noche text-white' : ESTILO_CATEGORIA[r].activo) : 'text-noche/60 hover:text-noche'}`}>
              {r === 'todas' ? 'Todas' : r}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}

      {tandas === null ? <Spinner texto="Cargando ascensos…" /> : tandas.length === 0 ? (
        !error && <Vacio titulo="Todavía no hay ascensos publicados">Cuando el club publique los ascensos de un corte, los vas a ver acá.</Vacio>
      ) : visibles.length === 0 ? (
        <Vacio titulo={buscando ? 'No hay ascensos con esa búsqueda' : 'No hay ascensos en esta rama'}>
          <button className="font-semibold text-cancha" onClick={() => { setTexto(''); setFiltroRama('todas') }}>Ver todos</button>
        </Vacio>
      ) : (
        <>
          {!buscando && filtroRama === 'todas' && (
            <p className="-mt-2 mb-4 text-xs text-noche/55">{plural(tandas.length, 'corte publicado', 'cortes publicados')}, {plural(total, 'ascenso', 'ascensos')} en total</p>
          )}

          {historiales.length > 0 && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              {historiales.map(([nombre, items]) => (
                <section key={nombre} className="rounded-xl bg-noche p-4 text-white">
                  <h2 className="flex items-center gap-2 font-display text-2xl font-bold leading-none">
                    <History className="h-5 w-5 shrink-0 text-pelota" aria-hidden /> {nombre}
                  </h2>
                  <p className="mt-1 text-xs text-white/60">Historial de cambios de categoría</p>
                  <ol className="mt-3 space-y-2">
                    {items.map(({ tanda, mov }) => (
                      <li key={tanda.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{mesAnio(tanda.vigencia)}</span>
                          <span className="block truncate text-xs text-white/55">{tanda.nombre}</span>
                        </span>
                        <span className="num inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold">
                          <span className="text-white/60">{num(mov.anterior)}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-white/50" aria-hidden />
                          <span className={`rounded-md px-1.5 py-0.5 ${mov.tipo === 'ascenso' ? 'bg-pelota text-noche' : 'bg-white/15 text-white'}`}>{mov.nueva}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          )}

          {/* línea de tiempo: un corte por fila, del más nuevo al más viejo */}
          <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[0.4375rem] before:top-2 before:w-px before:bg-noche/15">
            {visibles.map((t, i) => {
              const ascensos = t.movimientos.filter((m) => m.tipo === 'ascenso')
              const recats = t.movimientos.filter((m) => m.tipo === 'recategorizacion')
              const grupos = agrupar(t.movimientos)
              const ultima = i === 0 && t.id === tandas[0].id
              const open = abierta(t.id)
              return (
                <li key={t.id} className="relative pl-7">
                  <span aria-hidden className={`absolute left-0 top-4 h-[0.9375rem] w-[0.9375rem] rounded-full ring-4 ring-vidrio ${ultima ? 'bg-pelota' : 'bg-cancha'}`} />
                  <section className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
                    <button onClick={() => alternarTanda(t.id)} aria-expanded={open} disabled={buscando}
                      className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cancha disabled:cursor-default">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-display text-3xl font-bold leading-none text-noche">{mesAnio(t.vigencia)}</span>
                          {ultima && <span className="rounded-md bg-pelota px-1.5 py-0.5 text-[11px] font-bold text-noche">Último corte</span>}
                        </span>
                        <span className="mt-1 block text-sm text-noche/65">{t.nombre}, vigente desde el {fechaCorta(t.vigencia)}</span>
                        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {ascensos.length > 0 && <span className="inline-flex items-center gap-1 font-semibold text-cancha"><TrendingUp className="h-4 w-4" aria-hidden />{plural(ascensos.length, 'ascenso', 'ascensos')}</span>}
                          {recats.length > 0 && <span className="font-semibold text-noche/55">{plural(recats.length, 'recategorización', 'recategorizaciones')}</span>}
                        </span>
                      </span>
                      {!buscando && <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-noche/40 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden />}
                    </button>

                    {open && (
                      <div className="space-y-4 border-t border-noche/5 bg-vidrio/60 p-3 sm:p-4">
                        {(['ascenso', 'recategorizacion'] as const).map((tipo) => {
                          const gs = grupos.filter((g) => g.tipo === tipo)
                          if (!gs.length) return null
                          return (
                            <div key={tipo}>
                              <h3 className="mb-2 font-display text-lg font-bold text-noche">{tipo === 'ascenso' ? 'Ascienden' : 'Se recategorizan'}</h3>
                              <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {gs.map((g) => {
                                  const clave = `${t.id}:${g.tipo}:${g.categoria}`
                                  return (
                                    <section key={clave} className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
                                      <EncabezadoCard titulo={g.categoria} cantidad={g.movimientos.length} colapsada={colapsada(clave)} onAlternar={() => alternar(clave)}
                                        onCompartir={() => void compartir(clave, g, t)} generando={generando === clave} clase={ESTILO_CATEGORIA[rama(g.categoria)].etiqueta} nivel="h3" />
                                      {!colapsada(clave) && (
                                        <ul>
                                          {g.movimientos.map((m) => (
                                            <li key={m.nombre} className="flex items-center gap-2 border-b border-noche/5 px-3 py-1.5 last:border-0">
                                              <span className="min-w-0 flex-1 truncate text-sm text-noche">{m.nombre}</span>
                                              <span className="num inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-noche/50">
                                                {num(m.anterior)} <ArrowRight className="h-3 w-3" aria-hidden />
                                                <span className={`rounded px-1.5 py-0.5 ${tipo === 'ascenso' ? 'bg-pelota text-noche' : 'bg-vidrio text-noche/70'}`}>{num(m.nueva)}</span>
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </section>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </>
  )
}
