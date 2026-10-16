import type { CategoriaTorneo } from '../lib/torneo'

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
