import { useEffect, useState } from 'react'
import { Globe, LogOut } from 'lucide-react'
import { alCerrarSesion, salir, sesionActiva } from '../lib/auth'
import { vaciar } from '../lib/almacen'
import { Spinner } from '../components/ui'
import { nuevaCategoria, type Categoria } from '../lib/torneo'
import Login from './Login'
import Inicio from './Inicio'
import Editor from './Editor'
import { Firma, logoUrl } from '../App'

/** Panel de organizadores (#/admin): login + armado de torneos */
export default function Admin() {
  const [logueado, setLogueado] = useState<boolean | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  // torneo nuevo todavía sin guardar: se crea en la base recién con los datos obligatorios completos
  const [nuevo, setNuevo] = useState<Categoria | null>(null)
  const abrir = (id: string | null) => { setNuevo(null); setAbierta(id) }
  const crear = () => { const c = nuevaCategoria(); setNuevo(c); setAbierta(c.id) }

  useEffect(() => {
    sesionActiva().then(setLogueado)
    return alCerrarSesion(() => setLogueado(false))
  }, [])

  if (logueado === null) return <div className="grid min-h-screen place-items-center"><Spinner /></div>
  if (!logueado) {
    return (
      <>
        {/* volver a la página pública de torneos */}
        <a href="#/" className="fixed right-4 top-4 z-40 inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-noche shadow ring-1 ring-noche/10 hover:bg-white"
          style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
          <Globe className="h-4 w-4" aria-hidden /> Torneos
        </a>
        <Login onOk={() => setLogueado(true)} />
      </>
    )
  }
  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 bg-noche text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button onClick={async () => { await vaciar(); abrir(null) }} className="flex items-center gap-3 text-left">
            <img src={logoUrl()} alt="NODO Club de Pádel & Co." className="h-10 w-10 rounded-lg" />
            <span className="font-display text-xl font-bold leading-none">Generador de Torneos</span>
          </button>
          <div className="flex items-center gap-3">
            {/* volver a la página pública de torneos */}
            <button onClick={async () => { await vaciar(); window.location.hash = '#/' }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white/80 ring-1 ring-white/25 hover:bg-white/10 hover:text-white">
              <Globe className="h-4 w-4" aria-hidden /> Torneos
            </button>
            <button onClick={async () => { await vaciar(); await salir(); setLogueado(false) }} aria-label="Cerrar sesión" title="Cerrar sesión" className="text-white/70 hover:text-white">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {abierta ? <Editor key={abierta} id={abierta} inicial={nuevo ?? undefined} onVolver={() => abrir(null)} /> : <Inicio onAbrir={abrir} onNuevo={crear} />}
      </main>
      <Firma />
    </div>
  )
}
