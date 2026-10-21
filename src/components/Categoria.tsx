import type { CategoriaTorneo } from '../lib/torneo'
import { corta, rama, type CategoriaJugador } from '../lib/categorias'

/**
 * Color de cada categoría (definidos en tailwind.config.js: damas / caballeros / mixto).
 * Las clases van escritas completas para que Tailwind las incluya en el build.
 */
export const ESTILO_CATEGORIA: Record<CategoriaTorneo, { borde: string; etiqueta: string; activo: string }> = {
  Damas: { borde: 'border-l-damas', etiqueta: 'bg-damas-suave text-damas', activo: 'bg-damas text-white' },
  Caballeros: { borde: 'border-l-caballeros', etiqueta: 'bg-caballeros-suave text-caballeros', activo: 'bg-caballeros text-white' },
  Mixto: { borde: 'border-l-mixto', etiqueta: 'bg-mixto-suave text-mixto', activo: 'bg-mixto text-white' },
}

/** Borde izquierdo de color para las tarjetas de torneo */
export const bordeCategoria = (c: CategoriaTorneo) => `border-l-[6px] ${ESTILO_CATEGORIA[c]?.borde ?? 'border-l-noche/20'}`

/** Etiqueta de la categoría con su color */
export function BadgeCategoria({ categoria }: { categoria: CategoriaTorneo }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO_CATEGORIA[categoria]?.etiqueta ?? 'bg-vidrio text-noche/70'}`}>
      {categoria}
    </span>
  )
}

/** Etiqueta de la categoría de un jugador (color de Damas / Caballeros); sin categoría, en ámbar */
export function BadgeCategoriaJugador({ categoria, compacta = false }: { categoria: CategoriaJugador | null; compacta?: boolean }) {
  if (!categoria) return <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">Sin categoría</span>
  return (
    <span title={categoria} className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${ESTILO_CATEGORIA[rama(categoria)].etiqueta}`}>
      {compacta ? corta(categoria) : categoria}
    </span>
  )
}
