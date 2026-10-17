import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { X, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-cancha text-white hover:bg-cancha-claro disabled:bg-cancha/50',
  secundario: 'bg-white text-noche ring-1 ring-inset ring-noche/15 hover:bg-vidrio disabled:text-noche/40',
  peligro: 'bg-white text-red ring-1 ring-inset ring-red/30 hover:bg-red/5 disabled:opacity-50',
  fantasma: 'text-cancha hover:bg-cancha-suave disabled:opacity-50',
}

export function Button({
  variante = 'primario',
  cargando,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cancha disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
    >
      {cargando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-noche">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-noche/60">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red">{error}</span>}
    </label>
  )
}

const baseInput =
  'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-noche ring-1 ring-inset ring-noche/15 placeholder:text-noche/40 focus:outline-none focus:ring-2 focus:ring-cancha disabled:bg-vidrio disabled:text-noche/60'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseInput} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${baseInput} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${baseInput} ${props.className ?? ''}`} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-white p-5 ring-1 ring-noche/10 ${className}`}>{children}</section>
}

type Tono = 'neutro' | 'azul' | 'verde' | 'rojo' | 'pelota' | 'ambar'
const TONOS: Record<Tono, string> = {
  neutro: 'bg-vidrio text-noche/70',
  azul: 'bg-cancha-suave text-cancha',
  verde: 'bg-emerald-50 text-emerald-800',
  rojo: 'bg-red/10 text-red',
  pelota: 'bg-pelota text-noche',
  ambar: 'bg-amber-50 text-amber-800',
}

export function Badge({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${TONOS[tono]}`}>{children}</span>
}

export function Alerta({ tipo = 'info', children }: { tipo?: 'info' | 'error' | 'ok' | 'aviso'; children: ReactNode }) {
  const estilos = {
    info: ['bg-cancha-suave text-noche', Info],
    error: ['bg-red/10 text-red', AlertTriangle],
    ok: ['bg-emerald-50 text-emerald-800', CheckCircle2],
    aviso: ['bg-amber-50 text-amber-900', AlertTriangle],
  } as const
  const [cls, Icono] = estilos[tipo]
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg px-3 py-2 text-sm ${cls}`}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

export function Spinner({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-noche/60" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {texto}
    </div>
  )
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-noche/20 bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-xl font-semibold text-noche">{titulo}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-noche/70">{children}</div>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

export function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!abierto) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-noche/50 p-0 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${ancho}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-noche">{titulo}</h2>
          <button onClick={onCerrar} className="rounded-md p-1 text-noche/60 hover:bg-vidrio" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { id: T; label: string; extra?: ReactNode }[]
  valor: T
  onChange: (v: T) => void
}) {
  return (
    // la línea de abajo va como sombra interna (no borde + margen negativo): así no aparece scroll vertical en las pestañas
    <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_rgba(4,45,41,0.1)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {opciones.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => onChange(o.id)}
          className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 font-display text-lg font-semibold tracking-wide transition-colors ${
            valor === o.id ? 'border-cancha text-cancha' : 'border-transparent text-noche/55 hover:text-noche'
          }`}
        >
          {o.label}
          {o.extra}
        </button>
      ))}
    </div>
  )
}

export function Titulo({ children, accion, bajada }: { children: ReactNode; accion?: ReactNode; bajada?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl font-bold leading-none text-noche">{children}</h1>
        {bajada && <p className="mt-2 max-w-2xl text-sm text-noche/70">{bajada}</p>}
      </div>
      {accion}
    </header>
  )
}
