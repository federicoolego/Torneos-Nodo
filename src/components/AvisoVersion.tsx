import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { BUILD, CADA_MS, recargar, versionPublicada, type InfoVersion } from '../lib/version'

/** Cartel abajo de la pantalla cuando se publicó una versión más nueva que la que se está usando */
export default function AvisoVersion({ admin = false }: { admin?: boolean }) {
  const [nueva, setNueva] = useState<InfoVersion | null>(null)
  const [cerrado, setCerrado] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const revisar = async () => {
      if (document.visibilityState !== 'visible') return
      const v = await versionPublicada()
      if (vivo && v && v.build !== BUILD) setNueva(v)
    }
    void revisar()
    const t = window.setInterval(revisar, CADA_MS)
    document.addEventListener('visibilitychange', revisar)
    window.addEventListener('online', revisar)
    return () => { vivo = false; window.clearInterval(t); document.removeEventListener('visibilitychange', revisar); window.removeEventListener('online', revisar) }
  }, [])

  // "Más tarde" lo oculta hasta que salga otra versión
  if (!nueva || cerrado === nueva.build) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-noche px-4 py-3 text-white shadow-xl">
        <RefreshCw className="h-5 w-5 shrink-0 text-pelota" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <strong>Hay una versión nueva{nueva.version ? ` (v${nueva.version})` : ''}.</strong>{' '}
          {admin ? 'Actualizá cuando termines de cargar lo que estás haciendo.' : 'Actualizá para ver los últimos cambios.'}
        </p>
        <button onClick={() => recargar(nueva.build)} className="shrink-0 rounded-lg bg-pelota px-3 py-1.5 text-sm font-bold text-noche hover:brightness-95">
          Actualizar
        </button>
        <button onClick={() => setCerrado(nueva.build)} aria-label="Más tarde" title="Más tarde" className="shrink-0 text-white/60 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
