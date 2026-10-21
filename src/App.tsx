import { lazy, Suspense, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { configurado } from './lib/supabase'
import { Alerta, Spinner } from './components/ui'
import ListaPublica from './pages/publico/Lista'
import TorneoPublico from './pages/publico/Torneo'
import AvisoVersion from './components/AvisoVersion'
import { BUILD, FECHA_BUILD, VERSION, recargarSiFaltanArchivos } from './lib/version'

// si quedó abierta una versión vieja y le faltan archivos (por ejemplo, el panel de admin), recarga sola
recargarSiFaltanArchivos()

// El panel de organizadores se carga solo al entrar a #/admin: la página pública queda liviana
const Admin = lazy(() => import('./pages/Admin'))

export const logoUrl = () => `${import.meta.env.BASE_URL}logo-nodo.webp`

export function Firma() {
  const fecha = new Date(FECHA_BUILD).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <div className="py-4 text-center text-xs text-noche/45">
      <p><span aria-hidden>🎾</span> Desarrollado por Federico Olego <span aria-hidden>🎾</span></p>
      <p className="num mt-0.5 text-[10px] text-noche/35" title={`Build ${BUILD} · ${fecha}`}>v{VERSION}</p>
    </div>
  )
}

/** Ruta actual: '#/' (torneos publicados) · '#/calendario' · '#/estadisticas' · '#/torneo/<id>' · '#/admin' */
export function useRuta() {
  const [ruta, setRuta] = useState(window.location.hash)
  useEffect(() => {
    const f = () => { setRuta(window.location.hash); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return ruta
}

export default function App() {
  const ruta = useRuta()
  const admin = ruta.startsWith('#/admin')
  useEffect(() => { document.title = admin ? 'Torneos · NODO · Admin' : 'Torneos · NODO' }, [admin])

  if (!configurado) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Alerta tipo="error">Falta configurar la base de datos: definí VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</Alerta>
      </div>
    )
  }
  if (admin) {
    return <><Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner /></div>}><Admin /></Suspense><AvisoVersion admin /></>
  }
  const m = ruta.match(/^#\/torneo\/([0-9a-f-]{36})/i)
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-noche text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <a href="#/" className="flex min-w-0 items-center gap-3">
            <img src={logoUrl()} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
            <span className="font-display text-lg font-bold leading-tight sm:text-xl">NODO Club de Pádel &amp; Co</span>
          </a>
          <a href="#/admin" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 ring-1 ring-white/25 hover:bg-white/10 hover:text-white">
            <Lock className="h-4 w-4" aria-hidden /> Admin
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {m ? <TorneoPublico key={m[1]} id={m[1]} /> : <ListaPublica />}
      </main>
      <footer className="pb-4"><Firma /></footer>
      <AvisoVersion />
    </div>
  )
}
