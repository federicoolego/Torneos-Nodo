import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, UserPlus } from 'lucide-react'
import { claveJugador, nombrePropio } from '../lib/torneo'

/**
 * Buscador de jugadores del padrón. Si el jugador no existe, se agrega desde acá mismo
 * (se da de alta en la base al guardar la pareja). Busca sin importar mayúsculas ni tildes.
 */
export default function SelectorJugador({ id, valor, onChange, padron, excluir, disabled, placeholder = 'Buscá o agregá un jugador', permitirNuevo = true }: {
  id?: string
  valor: string
  onChange: (nombre: string) => void
  /** jugadores conocidos (con mayúscula inicial) */
  padron: string[]
  /** el otro jugador de la pareja: no se ofrece */
  excluir?: string
  disabled?: boolean
  placeholder?: string
  /** ofrecer "Agregar … como jugador nuevo" */
  permitirNuevo?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const caja = useRef<HTMLDivElement>(null)
  const q = claveJugador(valor)
  const exacto = padron.find((j) => claveJugador(j) === q)

  const opciones = useMemo(() => {
    const ex = excluir ? claveJugador(excluir) : ''
    // primero los que empiezan con lo escrito, después los que lo contienen (en cualquier palabra)
    const lista = padron.filter((j) => { const k = claveJugador(j); return k !== ex && (!q || k.includes(q)) })
    lista.sort((a, b) => Number(!claveJugador(a).startsWith(q)) - Number(!claveJugador(b).startsWith(q)) || a.localeCompare(b, 'es'))
    return lista.slice(0, 8)
  }, [padron, q, excluir])
  const puedeAgregar = permitirNuevo && !!q && !exacto && q.length >= 3
  const total = opciones.length + (puedeAgregar ? 1 : 0)

  useEffect(() => { setActivo(0) }, [q])
  useEffect(() => {
    const f = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('mousedown', f)
    return () => document.removeEventListener('mousedown', f)
  }, [])

  const elegir = (nombre: string) => { onChange(nombrePropio(nombre)); setAbierto(false) }

  return (
    <div ref={caja} className="relative">
      <div className="relative">
        <input
          id={id}
          value={valor}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          role="combobox"
          aria-expanded={abierto}
          aria-autocomplete="list"
          onFocus={() => setAbierto(true)}
          onChange={(e) => { onChange(e.target.value); setAbierto(true) }}
          onBlur={() => { if (exacto && exacto !== valor) onChange(exacto) }}
          onKeyDown={(e) => {
            if (!abierto && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setAbierto(true); return }
            if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, total - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Escape') setAbierto(false)
            else if (e.key === 'Enter' && abierto && total > 0) {
              e.preventDefault()
              elegir(activo < opciones.length ? opciones[activo] : valor)
            }
          }}
          className="block w-full rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm text-noche shadow-sm ring-1 ring-inset ring-noche/15 placeholder:text-noche/40 focus:ring-2 focus:ring-inset focus:ring-cancha disabled:bg-vidrio disabled:text-noche/40"
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
      </div>
      {abierto && !disabled && total > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-noche/10">
          {opciones.map((j, i) => (
            <li key={j} role="option" aria-selected={i === activo}
              onMouseDown={(e) => { e.preventDefault(); elegir(j) }} onMouseEnter={() => setActivo(i)}
              className={`flex cursor-pointer items-center justify-between px-3 py-2 ${i === activo ? 'bg-cancha-suave' : ''}`}>
              {j}
              {exacto === j && <Check className="h-4 w-4 text-cancha" aria-hidden />}
            </li>
          ))}
          {puedeAgregar && (
            <li role="option" aria-selected={activo === opciones.length}
              onMouseDown={(e) => { e.preventDefault(); elegir(valor) }} onMouseEnter={() => setActivo(opciones.length)}
              className={`flex cursor-pointer items-center gap-2 border-t border-noche/5 px-3 py-2 font-semibold text-cancha ${activo === opciones.length ? 'bg-cancha-suave' : ''}`}>
              <UserPlus className="h-4 w-4" aria-hidden /> Agregar “{nombrePropio(valor)}” como jugador nuevo
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
