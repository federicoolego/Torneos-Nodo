import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { FALTA_SQL_CATEGORIA, asignarCategoria, listarBase } from '../lib/jugadores'
import { CATEGORIAS_JUGADOR, esCategoriaJugador, rama, type CategoriaJugador } from '../lib/categorias'
import { claveJugador, nombrePropio } from '../lib/torneo'
import { ESTILO_CATEGORIA } from '../components/Categoria'
import { AccionesCategorias, EncabezadoCard, TODAS, useColapso, useCompartirCategorias, type GrupoImagen } from '../components/CardsCategorias'
import { Alerta, Input, Spinner, Titulo, Vacio } from '../components/ui'

interface Fila { id: string; nombre: string; categoria: CategoriaJugador | null }
const SIN = 'sin' as const
type Grupo = CategoriaJugador | typeof SIN

/** Todos los jugadores del complejo agrupados por categoría; el admin asigna o cambia la categoría de cada uno */
export default function Categorias() {
  const [lista, setLista] = useState<Fila[] | null>(null)
  const [conCategoria, setConCategoria] = useState(true)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null)
  const [texto, setTexto] = useState('')
  // jugadores que se están guardando (para deshabilitar su selector)
  const [guardando, setGuardando] = useState<Set<string>>(new Set())

  const refrescar = useCallback(async () => {
    try {
      const r = await listarBase()
      setLista(r.jugadores)
      setConCategoria(r.conCategoria)
    } catch (e) { setLista([]); setMsg({ tipo: 'error', txt: e instanceof Error ? e.message : 'No se pudo leer el padrón.' }) }
  }, [])
  useEffect(() => { void refrescar() }, [refrescar])

  async function cambiar(j: Fila, valor: string) {
    const nueva = esCategoriaJugador(valor) ? valor : null
    if (nueva === j.categoria) return
    setMsg(null)
    setGuardando((s) => new Set(s).add(j.id))
    // se mueve de card enseguida; si falla, vuelve
    setLista((l) => l?.map((x) => (x.id === j.id ? { ...x, categoria: nueva } : x)) ?? l)
    try {
      await asignarCategoria(j.id, nueva)
      setMsg({ tipo: 'ok', txt: `${nombrePropio(j.nombre)}: ${nueva ?? 'sin categoría'}.` })
    } catch (e) {
      setLista((l) => l?.map((x) => (x.id === j.id ? { ...x, categoria: j.categoria } : x)) ?? l)
      setMsg({ tipo: 'error', txt: e instanceof Error ? e.message : 'No se pudo guardar.' })
    } finally {
      setGuardando((s) => { const n = new Set(s); n.delete(j.id); return n })
    }
  }

  const palabras = claveJugador(texto).split(' ').filter(Boolean)
  const visibles = useMemo(() => (lista ?? []).filter((j) => !palabras.length || palabras.every((p) => claveJugador(j.nombre).includes(p))),
    [lista, texto]) // eslint-disable-line react-hooks/exhaustive-deps
  const porGrupo = useMemo(() => {
    const m = new Map<Grupo, Fila[]>([[SIN, []], ...CATEGORIAS_JUGADOR.map((c) => [c, []] as [Grupo, Fila[]])])
    for (const j of visibles) m.get(j.categoria ?? SIN)!.push(j)
    return m
  }, [visibles])
  const totalSin = (lista ?? []).filter((j) => !j.categoria).length
  // para las imágenes: siempre el grupo completo (no lo que coincide con la búsqueda), con los nombres como se muestran
  const completos = useMemo(() => {
    const m = new Map<Grupo, string[]>([[SIN, []], ...CATEGORIAS_JUGADOR.map((c) => [c, []] as [Grupo, string[]])])
    for (const j of lista ?? []) m.get(j.categoria ?? SIN)!.push(nombrePropio(j.nombre))
    for (const v of m.values()) v.sort((a, b) => a.localeCompare(b, 'es'))
    return m
  }, [lista])
  const grupoImagen = (g: Grupo): GrupoImagen => ({ titulo: g === SIN ? 'Sin categoría asignada' : g, rama: g === SIN ? null : rama(g), nombres: completos.get(g)! })

  const { colapsada, alternar, expandirTodas, colapsarTodas } = useColapso()
  const [generando, compartir] = useCompartirCategorias()
  // al entrar (y al limpiar la búsqueda) todo colapsado, salvo "Sin asignar" si hay jugadores pendientes de categoría;
  // al buscar se expanden todas, para ver las coincidencias
  const cargada = lista !== null
  const buscando = !!texto.trim()
  useEffect(() => {
    if (!cargada) return
    if (buscando) { expandirTodas(); return }
    const pendientes = (lista ?? []).some((j) => !j.categoria)
    colapsarTodas(pendientes ? [...CATEGORIAS_JUGADOR] : [SIN, ...CATEGORIAS_JUGADOR])
  }, [cargada, buscando, expandirTodas, colapsarTodas]) // eslint-disable-line react-hooks/exhaustive-deps
  const enPantalla: Grupo[] = [SIN, ...CATEGORIAS_JUGADOR].filter((g) => !palabras.length || (porGrupo.get(g)?.length ?? 0) > 0)
  const todasColapsadas = enPantalla.length > 0 && enPantalla.every((g) => colapsada(g))
  // "Compartir todas": solo las categorías (los jugadores sin asignar se comparten desde su card)
  const hayConCategoria = CATEGORIAS_JUGADOR.some((c) => completos.get(c)!.length)

  const card = (g: Grupo) => {
    const filas = porGrupo.get(g) ?? []
    // al buscar, se ocultan las categorías sin coincidencias
    if (palabras.length && !filas.length) return null
    const esSin = g === SIN
    const estilo = esSin ? null : ESTILO_CATEGORIA[rama(g)]
    return (
      <section key={g} className={`flex flex-col overflow-hidden rounded-xl bg-white ring-1 ${esSin ? 'ring-amber-300' : 'ring-noche/10'}`}>
        <EncabezadoCard titulo={esSin ? 'Sin asignar' : g} cantidad={filas.length} colapsada={colapsada(g)} onAlternar={() => alternar(g)}
          onCompartir={() => void compartir(g, [grupoImagen(g)], esSin ? 'Sin categoría asignada' : g)} generando={generando === g}
          clase={esSin ? 'bg-amber-50 text-amber-900' : estilo!.etiqueta} nivel="h2" />
        {colapsada(g) ? null : filas.length === 0 ? <p className="px-3 py-3 text-xs text-noche/45">{esSin ? 'Todos los jugadores tienen categoría.' : 'Sin jugadores.'}</p> : (
          <ul className={`overflow-y-auto ${esSin ? 'grid max-h-[28rem] sm:grid-cols-2 sm:gap-x-2 lg:grid-cols-3' : 'max-h-80'}`}>
            {filas.map((j) => (
              <li key={j.id} className="flex items-center gap-2 border-b border-noche/5 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-noche" title={nombrePropio(j.nombre)}>{nombrePropio(j.nombre)}</span>
                <select value={j.categoria ?? ''} disabled={!conCategoria || guardando.has(j.id)} onChange={(e) => void cambiar(j, e.target.value)}
                  aria-label={`Categoría de ${nombrePropio(j.nombre)}`}
                  className={`w-[8.5rem] shrink-0 rounded-md border-0 py-1 pl-2 pr-7 text-xs ring-1 ring-inset focus:ring-2 focus:ring-cancha disabled:opacity-50 ${esSin ? 'bg-amber-50 font-semibold text-amber-900 ring-amber-300' : 'bg-white text-noche ring-noche/15'}`}>
                  <option value="">{esSin ? 'Asignar…' : 'Sin asignar'}</option>
                  <optgroup label="Damas">{CATEGORIAS_JUGADOR.filter((c) => rama(c) === 'Damas').map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
                  <optgroup label="Caballeros">{CATEGORIAS_JUGADOR.filter((c) => rama(c) === 'Caballeros').map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  return (
    <>
      <Titulo bajada="Todos los jugadores del padrón de NODO por categoría. Elegí la categoría de cada jugador; se guarda al instante y se puede cambiar cuando haga falta (por ejemplo, si asciende). Se usa para validar las parejas al inscribirlas.">
        Categorías
      </Titulo>
      {!conCategoria && <div className="mb-4"><Alerta tipo="error">{FALTA_SQL_CATEGORIA}</Alerta></div>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre o apellido…" className="pl-9 pr-9" aria-label="Buscar jugador" />
          {texto && <button onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-noche/40"><X className="h-4 w-4" /></button>}
        </label>
        {lista && (
          <span className="text-xs text-noche/55">
            {palabras.length ? `${visibles.length} de ${lista.length} jugadores` : `${lista.length} jugadores`}{totalSin ? ` · ${totalSin} sin categoría` : ''}
          </span>
        )}
        {!!lista?.length && (
          <AccionesCategorias todasColapsadas={todasColapsadas} onColapsarTodas={() => colapsarTodas(enPantalla)} onExpandirTodas={expandirTodas}
            onCompartirTodas={() => void compartir(TODAS, CATEGORIAS_JUGADOR.map(grupoImagen), 'Categorías NODO')}
            generando={generando === TODAS} puedeCompartir={hayConCategoria} />
        )}
      </div>

      {msg && <div className="mb-3"><Alerta tipo={msg.tipo}>{msg.txt}</Alerta></div>}

      {lista === null ? <Spinner texto="Cargando jugadores…" /> : lista.length === 0 ? (
        <Vacio titulo="Todavía no hay jugadores">Se agregan en la pestaña Jugadores o al inscribir parejas en un torneo.</Vacio>
      ) : palabras.length && !visibles.length ? (
        <Vacio titulo="No hay jugadores con esa búsqueda" />
      ) : (
        <div className="space-y-5">
          {card(SIN)}
          {(['Damas', 'Caballeros'] as const).map((r) => {
            const cats = CATEGORIAS_JUGADOR.filter((c) => rama(c) === r)
            const cards = cats.map(card).filter(Boolean)
            if (!cards.length) return null
            // total de la rama: cambia al buscar (solo cuenta las coincidencias)
            const total = cats.reduce((n, c) => n + (porGrupo.get(c)?.length ?? 0), 0)
            return (
              <div key={r}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-noche/55">{r} <span className="num ml-1 rounded-full bg-noche/10 px-1.5 py-0.5 text-[11px] text-noche/70">{total}</span></h2>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
