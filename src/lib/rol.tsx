import { createContext, useContext, type ReactNode } from 'react'
import type { Rol } from './auth'

const RolContext = createContext<Rol>('admin')

/** El panel (#/admin) provee el rol de quien entró; abajo se consulta con useRol() */
export function ProveedorRol({ rol, children }: { rol: Rol; children: ReactNode }) {
  return <RolContext.Provider value={rol}>{children}</RolContext.Provider>
}

export const useRol = () => useContext(RolContext)
/** Editor: solo inscribe parejas y carga resultados */
export const useEsEditor = () => useContext(RolContext) === 'editor'
