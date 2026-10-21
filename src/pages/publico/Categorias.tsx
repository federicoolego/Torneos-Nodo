import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { categoriasPublicas } from '../../lib/publico'
import { CATEGORIAS_JUGADOR, esCategoriaJugador, rama, type CategoriaJugador } from '../../lib/categorias'
import { claveJugador, nombrePropio } from '../../lib/torneo'
import { ESTILO_CATEGORIA } from '../../components/Categoria'
import { Alerta, Input, Spinner, Vacio } from '../../components/ui'

interface Fila { nombre: string; categoria: CategoriaJugador }

/** Categorías de los jugadores de NODO (solo lectura). No se muestran los jugadores sin categoría */
export default function CategoriasPublicas() {
  const [lista, setLista] = useState<Fila[] | null>(null)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')

  useEffect(() => {
    categoriasPublicas()
      .then((l) => setLista(l.filter((j): j is Fila => esCategoriaJugador(j.categoria))
        .map((j) => ({ ...j, nombre: nombrePropio(j.nombre) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))))
      .catch(() => { setError('No se pudieron cargar las categorías.'); setLista([]) })
  }, [])

  // todas las palabras tienen que aparecer, en cualquier orden ("grego massot" encuentra a "Massot Grego")
  const palabras = claveJugador(texto).split(' ').filter(Boolean)
  const visibles = useMemo(() => (lista ?? []).filter((j) => palabras.every((p) => claveJugador(j.nombre).includes(p))),
    [lista, texto]) // eslint-disable-line react-hooks/exhaustive-deps
  const porCategoria = useMemo(() => {
    const m = new Map<CategoriaJugador, string[]>(CATEGORIAS_JUGADOR.map((c) => [c, []]))
    for (const j of visibles) m.get(j.categoria)!.push(j.nombre)
    return m
  }, [visibles])

  return (
    <>
      <header className="mb-5">
        <h1 className="font-display text-4xl font-bold leading-none text-noche">Categorías</h1>
        <p className="mt-2 text-sm text-noche/70">Categoría actual de cada jugador de NODO.</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscá por nombre o apellido…" className="pl-9 pr-9" aria-label="Buscar jugador" />
          {texto && <button onClick={() => setTexto('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-noche/40"><X className="h-4 w-4" /></button>}
        </label>
        {!!lista?.length && <span className="text-xs text-noche/55">{palabras.length ? `${visibles.length} de ${lista.length}` : lista.length} jugadores</span>}
      </div>

      {error && <div className="mb-4"><Alerta tipo="error">{error}</Alerta></div>}
      {lista === null ? <Spinner texto="Cargando categorías…" /> : lista.length === 0 ? (
        !error && <Vacio titulo="Todavía no hay categorías cargadas">Cuando el club asigne las categorías, las vas a ver acá.</Vacio>
      ) : visibles.length === 0 ? (
        <Vacio titulo="No hay jugadores con esa búsqueda" />
      ) : (
        <div className="space-y-5">
          {(['Damas', 'Caballeros'] as const).map((r) => {
            // solo las categorías con jugadores (o con coincidencias, si se está buscando)
            const cats = CATEGORIAS_JUGADOR.filter((c) => rama(c) === r && porCategoria.get(c)!.length)
            if (!cats.length) return null
            return (
              <div key={r}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-noche/55">{r}</h2>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {cats.map((c) => {
                    const nombres = porCategoria.get(c)!
                    return (
                      <section key={c} className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
                        <header className={`flex items-center justify-between gap-2 px-3 py-2 ${ESTILO_CATEGORIA[r].etiqueta}`}>
                          <h3 className="font-display text-lg font-bold leading-none">{c}</h3>
                          <span className="num text-sm font-semibold opacity-80">{nombres.length}</span>
                        </header>
                        <ul className="max-h-80 overflow-y-auto">
                          {nombres.map((n) => <li key={n} className="border-b border-noche/5 px-3 py-1.5 text-sm text-noche last:border-0">{n}</li>)}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
