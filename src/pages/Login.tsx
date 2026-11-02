import { useState, type FormEvent } from 'react'
import { ingresar, type Rol } from '../lib/auth'
import { Alerta, Button, Field, Input } from '../components/ui'
import { Firma, logoUrl } from '../App'

export default function Login({ onOk }: { onOk: (rol: Rol) => void }) {
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [intentos, setIntentos] = useState(0)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    // espera creciente ante intentos fallidos
    if (intentos > 2) await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * (intentos - 2))))
    const rol = await ingresar(usuario, pass)
    setCargando(false)
    if (rol) return onOk(rol)
    setIntentos(intentos + 1)
    setError('Usuario o contraseña incorrectos')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-noche px-4">
      <div className="w-full max-w-sm">
        <img src={logoUrl()} alt="NODO Club de Pádel & Co." className="mx-auto mb-6 w-56 rounded-2xl" />
        <form onSubmit={enviar} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <div>
            <h1 className="font-display text-3xl font-bold">Generador de torneos</h1>
            <p className="text-sm text-noche/65">Zonas y playoff listos para compartir.</p>
          </div>
          <Field label="Usuario"><Input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus /></Field>
          <Field label="Contraseña"><Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required /></Field>
          {error && <Alerta tipo="error">{error}</Alerta>}
          <Button type="submit" cargando={cargando} className="w-full">Ingresar</Button>
        </form>
        <div className="[&>p]:text-white/50"><Firma /></div>
      </div>
    </div>
  )
}
