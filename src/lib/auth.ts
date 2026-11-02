/**
 * Acceso con Supabase Auth. Hay dos usuarios, los dos se escriben como "NODO" en el login:
 *   · admin:  nodo@generador.nodo.com.ar          (en torneos_nodo_usuarios)  → todo el panel
 *   · editor: nodo.editor@generador.nodo.com.ar   (en torneos_nodo_editores) → solo inscribir parejas y cargar resultados
 * La app prueba la contraseña primero con el admin y, si no es esa, con el editor: el rol lo define la contraseña.
 * Los permisos reales los pone la base (RLS + triggers, ver supabase/torneos_nodo_editor.sql); acá solo se decide qué se muestra.
 */
import { supabase } from './supabase'

export const DOMINIO = 'generador.nodo.com.ar'
/** Usuario del login que se traduce a las dos cuentas (admin y editor) */
const USUARIO_NODO = 'nodo'
const EMAIL_EDITOR = `nodo.editor@${DOMINIO}`

export type Rol = 'admin' | 'editor'

const aEmail = (u: string) => {
  const x = u.trim().toLowerCase()
  return x.includes('@') ? x : `${x}@${DOMINIO}`
}

/** Cuentas a probar para un usuario: NODO prueba admin y después editor */
const candidatos = (usuario: string): string[] => {
  const email = aEmail(usuario)
  return usuario.trim().toLowerCase() === USUARIO_NODO ? [email, EMAIL_EDITOR] : [email]
}

/** Rol de la sesión abierta, según la base (null si no hay sesión o el usuario no está habilitado) */
export async function rolActual(): Promise<Rol | null> {
  const { data, error } = await supabase.rpc('torneos_nodo_rol')
  if (!error && (data === 'admin' || data === 'editor')) return data
  if (error && /torneos_nodo_rol/.test(error.message)) {
    // base sin el SQL del rol Editor (torneos_nodo_editor.sql): solo existe el admin
    const r = await supabase.rpc('torneos_nodo_es_usuario')
    return r.data === true ? 'admin' : null
  }
  return null
}

/** Devuelve el rol con el que se entró, o null si el usuario o la contraseña no sirven */
export async function ingresar(usuario: string, pass: string): Promise<Rol | null> {
  for (const email of candidatos(usuario)) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) continue
    // que además esté habilitado para estas tablas
    const rol = await rolActual()
    if (rol) return rol
    await supabase.auth.signOut()
  }
  return null
}

/** Rol de la sesión guardada en este navegador (null si no hay sesión o ya no es válida) */
export async function sesionActiva(): Promise<Rol | null> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const rol = await rolActual()
  if (!rol) await supabase.auth.signOut()
  return rol
}

/** Avisa cuando se cierra la sesión (vencida o desde otra pestaña). Devuelve la función para dejar de escuchar */
export function alCerrarSesion(cb: () => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (!s) cb() })
  return () => data.subscription.unsubscribe()
}

export async function salir() {
  await supabase.auth.signOut()
}
