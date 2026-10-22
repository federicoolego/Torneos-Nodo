import { Fragment, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import type { EstadoTorneo } from '../lib/torneo'

type ClaveGrupo = 'activos' | 'finalizados' | 'cancelados'

/**
 * Grupos en el orden en que se muestran: Pendientes y En curso juntos, después Finalizados y por último Cancelados.
 * Cada encabezado lleva el color del tag de su estado (Badge de ui.tsx): En curso verde · Finalizado verde NODO · Cancelado rojo.
 */
const GRUPOS: { clave: ClaveGrupo; titulo: string; estados: EstadoTorneo[]; clase: string }[] = [
  { clave: 'activos', titulo: 'Pendientes y en curso', estados: ['en_curso', 'pendiente'], clase: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  { clave: 'finalizados', titulo: 'Finalizados', estados: ['finalizado'], clase: 'bg-cancha-suave text-cancha ring-cancha/25' },
  { clave: 'cancelados', titulo: 'Cancelados', estados: ['cancelado'], clase: 'bg-red/10 text-red ring-red/20' },
]

/**
 * Lista de torneos agrupada por estado, con cada grupo colapsable y un botón para expandir / colapsar todos.
 * Respeta el orden en que vienen los items (cada pantalla ordena a su manera dentro del grupo) y no muestra grupos vacíos.
 */
export function GruposEstado<T>({ items, estado, clave, render }: {
  items: T[]
  estado: (t: T) => EstadoTorneo
  clave: (t: T) => string
  /** cada item, como <li> */
  render: (t: T) => ReactNode
}) {
  // por defecto, solo Pendientes y en curso expandido: lo primero que se ve son los torneos que se están jugando o vienen
  const [colapsados, setColapsados] = useState<Set<ClaveGrupo>>(() => new Set<ClaveGrupo>(['finalizados', 'cancelados']))
  const grupos = GRUPOS.map((g) => ({ ...g, items: items.filter((t) => g.estados.includes(estado(t))) })).filter((g) => g.items.length)
  const todosColapsados = grupos.length > 0 && grupos.every((g) => colapsados.has(g.clave))
  const alternar = (k: ClaveGrupo) => setColapsados((s) => {
    const n = new Set(s)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  return (
    <div className="space-y-4">
      {grupos.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => setColapsados(todosColapsados ? new Set() : new Set(grupos.map((g) => g.clave)))}
            aria-label={todosColapsados ? 'Expandir todos los grupos' : 'Colapsar todos los grupos'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-noche ring-1 ring-inset ring-noche/15 hover:bg-vidrio">
            {todosColapsados ? <ChevronsUpDown className="h-4 w-4" aria-hidden /> : <ChevronsDownUp className="h-4 w-4" aria-hidden />}
            {todosColapsados ? 'Expandir todos' : 'Colapsar todos'}
          </button>
        </div>
      )}
      {grupos.map((g) => {
        const colapsado = colapsados.has(g.clave)
        return (
          <section key={g.clave}>
            <button onClick={() => alternar(g.clave)} aria-expanded={!colapsado} aria-label={`${colapsado ? 'Expandir' : 'Colapsar'} ${g.titulo}`}
              className={`flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left ring-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cancha ${g.clase}`}>
              <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${colapsado ? '-rotate-90' : ''}`} aria-hidden />
              <h2 className="min-w-0 flex-1 truncate font-display text-xl font-bold leading-none">{g.titulo}</h2>
              <span className="num text-sm font-semibold opacity-80">{g.items.length}</span>
            </button>
            {!colapsado && (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {g.items.map((t) => <Fragment key={clave(t)}>{render(t)}</Fragment>)}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
