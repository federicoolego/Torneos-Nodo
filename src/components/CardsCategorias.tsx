// Piezas compartidas de las cards de categorías (admin y página pública): colapsar / expandir y compartir como imagen
import { useCallback, useState } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Loader2, Share2 } from 'lucide-react'

export interface GrupoImagen { titulo: string; rama: 'Damas' | 'Caballeros' | null; nombres: string[] }

const nombreArchivo = (titulo: string, i: number, n: number) =>
  `${`Categoría ${titulo}${n > 1 ? ` (${i + 1} de ${n})` : ''}`.replace(/[\\/:*?"<>|]+/g, '').trim()}.png`

/** Genera las imágenes de los grupos (una o más por categoría, según la cantidad de jugadores) */
async function generar(grupos: GrupoImagen[]): Promise<File[]> {
  // se carga recién al compartir (no suma peso a la página)
  const { imagenesCategoria } = await import('../lib/imagenes')
  const files: File[] = []
  for (const g of grupos) {
    const blobs = await imagenesCategoria(g)
    blobs.forEach((b, i) => files.push(new File([b], nombreArchivo(g.titulo, i, blobs.length), { type: 'image/png' })))
  }
  return files
}

/** Comparte los archivos (menú nativo: WhatsApp…) o, si el navegador no deja, los descarga */
export async function compartirArchivos(files: File[], titulo: string) {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: titulo })
      return
    } catch (e) {
      // canceló: no se hace nada. Si el navegador no dejó abrir el menú (por ejemplo, Safari tras generar la imagen), se descargan
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  files.forEach((f, i) => setTimeout(() => {
    const url = URL.createObjectURL(f)
    const a = document.createElement('a')
    a.href = url
    a.download = f.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }, i * 400))
}

/**
 * Arma y comparte las imágenes. `generando` es la clave de lo que se está generando
 * (una categoría o TODAS), para mostrar la ruedita en el botón que corresponde
 */
export const TODAS = '__todas__'
export function useCompartirCategorias(): [string | null, (clave: string, grupos: GrupoImagen[], titulo: string) => Promise<void>] {
  const [generando, setGenerando] = useState<string | null>(null)
  const compartir = useCallback(async (clave: string, grupos: GrupoImagen[], titulo: string) => {
    const conJugadores = grupos.filter((g) => g.nombres.length)
    if (!conJugadores.length) return
    setGenerando(clave)
    try { await compartirArchivos(await generar(conJugadores), titulo) } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudieron generar las imágenes.')
    } finally { setGenerando(null) }
  }, [])
  return [generando, compartir]
}

/** Qué cards están colapsadas (por defecto, todas expandidas) */
export function useColapso() {
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
  const alternar = useCallback((k: string) => setColapsadas((s) => {
    const n = new Set(s)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  }), [])
  const expandirTodas = useCallback(() => setColapsadas((s) => (s.size ? new Set() : s)), [])
  const colapsarTodas = useCallback((claves: string[]) => setColapsadas(new Set(claves)), [])
  return { colapsada: (k: string) => colapsadas.has(k), alternar, expandirTodas, colapsarTodas, hayColapsadas: colapsadas.size > 0 }
}

/** Botones generales: colapsar / expandir todas y compartir todas las categorías */
export function AccionesCategorias({ todasColapsadas, onColapsarTodas, onExpandirTodas, onCompartirTodas, generando, puedeCompartir }: {
  todasColapsadas: boolean; onColapsarTodas: () => void; onExpandirTodas: () => void
  onCompartirTodas: () => void; generando: boolean; puedeCompartir: boolean
}) {
  const clase = 'inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-noche ring-1 ring-inset ring-noche/15 hover:bg-vidrio disabled:cursor-wait disabled:opacity-60'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={todasColapsadas ? onExpandirTodas : onColapsarTodas} className={clase}
        aria-label={todasColapsadas ? 'Expandir todas las categorías' : 'Colapsar todas las categorías'}>
        {todasColapsadas ? <ChevronsUpDown className="h-4 w-4" aria-hidden /> : <ChevronsDownUp className="h-4 w-4" aria-hidden />}
        {todasColapsadas ? 'Expandir todas' : 'Colapsar todas'}
      </button>
      {puedeCompartir && (
        <button onClick={onCompartirTodas} disabled={generando} className={clase} title="Compartir todas las categorías como imágenes">
          {generando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
          Compartir todas
        </button>
      )}
    </div>
  )
}

/** Encabezado de la card: al tocarlo colapsa / expande; a la derecha, el botón para compartir la categoría */
export function EncabezadoCard({ titulo, cantidad, colapsada, onAlternar, onCompartir, generando, clase, nivel = 'h3' }: {
  titulo: string; cantidad: number; colapsada: boolean; onAlternar: () => void
  onCompartir?: () => void; generando?: boolean; clase: string; nivel?: 'h2' | 'h3'
}) {
  const H = nivel
  return (
    <header className={`flex items-center gap-1 pr-1.5 ${clase}`}>
      <button onClick={onAlternar} aria-expanded={!colapsada} aria-label={`${colapsada ? 'Expandir' : 'Colapsar'} ${titulo}`}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cancha">
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${colapsada ? '-rotate-90' : ''}`} aria-hidden />
        <H className="min-w-0 flex-1 truncate font-display text-lg font-bold leading-none">{titulo}</H>
        <span className="num text-sm font-semibold opacity-80">{cantidad}</span>
      </button>
      {onCompartir && cantidad > 0 && (
        <button onClick={onCompartir} disabled={generando} title={`Compartir ${titulo} como imagen`} aria-label={`Compartir ${titulo} como imagen`}
          className="shrink-0 rounded-md p-1.5 opacity-75 hover:bg-white/60 hover:opacity-100 disabled:cursor-wait">
          {generando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
        </button>
      )}
    </header>
  )
}
