import { useState, type ReactNode } from 'react'
import { CircleHelp, Lightbulb } from 'lucide-react'
import { Modal, Tabs } from './ui'

/** Instructivo de una pestaña: qué es, para qué sirve y cómo se usa */
export interface SeccionAyuda {
  id: string
  /** nombre de la pestaña, tal cual se ve en la app */
  titulo: string
  que: ReactNode
  para: ReactNode
  pasos: ReactNode[]
  tips?: ReactNode[]
}

/**
 * Botón "Ayuda" del header: abre el instructivo con una pestaña por sección,
 * arrancando en la que se está mirando (`actual` se evalúa al abrir).
 */
export default function BotonAyuda({ secciones, actual, titulo = 'Ayuda' }: {
  secciones: SeccionAyuda[]
  actual: () => string
  titulo?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [sel, setSel] = useState(secciones[0]?.id ?? '')
  const abrir = () => {
    const a = actual()
    setSel(secciones.some((s) => s.id === a) ? a : secciones[0]?.id ?? '')
    setAbierto(true)
  }
  const s = secciones.find((x) => x.id === sel) ?? secciones[0]

  return (
    <>
      <button onClick={abrir} aria-label="Ayuda" title="Ayuda: cómo se usa cada pestaña"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white/80 ring-1 ring-white/25 hover:bg-white/10 hover:text-white sm:px-3">
        <CircleHelp className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Ayuda</span>
      </button>
      <Modal abierto={abierto} titulo={titulo} onCerrar={() => setAbierto(false)} ancho="max-w-3xl">
        <div className="-mx-5 mb-4 px-5">
          <Tabs<string> opciones={secciones.map((x) => ({ id: x.id, label: x.titulo }))} valor={sel} onChange={setSel} />
        </div>
        {s && <Contenido s={s} />}
      </Modal>
    </>
  )
}

function Contenido({ s }: { s: SeccionAyuda }) {
  return (
    <div className="space-y-4 text-sm text-noche/80">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-vidrio p-3">
          <p className="mb-1 font-semibold text-noche">¿Qué es?</p>
          <div>{s.que}</div>
        </div>
        <div className="rounded-lg bg-cancha-suave/60 p-3 ring-1 ring-cancha/15">
          <p className="mb-1 font-semibold text-noche">¿Para qué sirve?</p>
          <div>{s.para}</div>
        </div>
      </div>
      <div>
        <p className="mb-2 font-semibold text-noche">¿Cómo se usa?</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          {s.pasos.map((p, i) => <li key={i}>{p}</li>)}
        </ol>
      </div>
      {!!s.tips?.length && (
        <div className="rounded-lg bg-pelota/25 p-3 ring-1 ring-pelota/60">
          <p className="mb-1.5 flex items-center gap-2 font-semibold text-noche"><Lightbulb className="h-4 w-4" aria-hidden /> Para tener en cuenta</p>
          <ul className="list-disc space-y-1 pl-5">
            {s.tips.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
