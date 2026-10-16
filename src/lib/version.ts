// Versión de la app y aviso de versión nueva.
// En cada build se publica version.json (ver vite.config.ts); la app lo consulta cada tanto y,
// si el "build" publicado es distinto del que está corriendo, avisa para refrescar.

export const VERSION = __APP_VERSION__
export const BUILD = __APP_BUILD__
export const FECHA_BUILD = __APP_FECHA__

/** Cada cuánto se consulta si hay versión nueva (además de al volver a la pestaña) */
export const CADA_MS = 5 * 60 * 1000

export interface InfoVersion { version: string; build: string; fecha: string }

/** version.json publicado (sin caché). null si no se pudo leer (sin conexión, en desarrollo, etc.) */
export async function versionPublicada(): Promise<InfoVersion | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const v = (await r.json()) as Partial<InfoVersion>
    return v?.build ? { version: String(v.version ?? ''), build: String(v.build), fecha: String(v.fecha ?? '') } : null
  } catch {
    return null
  }
}

/**
 * Recarga trayendo la versión nueva: agrega ?v=<build> a la URL para saltear la caché del index.html
 * (GitHub Pages lo cachea unos minutos) y conserva la ruta (#/torneo/…, #/admin…).
 */
export function recargar(build?: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('v', build || String(Date.now()))
  window.location.replace(url.toString())
}

/**
 * Si un archivo de la versión anterior ya no existe en el servidor (por ejemplo, el panel de admin
 * se carga aparte y cambió con el deploy), Vite dispara 'vite:preloadError': recargamos una sola vez.
 */
export function recargarSiFaltanArchivos() {
  const MARCA = 'torneos-nodo:recarga-por-version'
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault()
    if (sessionStorage.getItem(MARCA)) return // ya se intentó: no entrar en un bucle de recargas
    sessionStorage.setItem(MARCA, '1')
    recargar()
  })
  // si la app arrancó bien, se limpia la marca para la próxima vez
  window.setTimeout(() => sessionStorage.removeItem(MARCA), 10_000)
}
