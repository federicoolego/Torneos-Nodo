// Fechas ("jornadas"): varios torneos que se juegan juntos en las mismas canchas.
// Se guarda la configuración (canchas, horarios, duraciones) y la última propuesta de horarios.
import { supabase, T } from './supabase'
import type { ConfigFecha, Plan } from './programador'

export interface Jornada {
  id: string
  nombre: string
  torneos: string[]
  config: Partial<ConfigFecha>
  plan: Plan | null
  actualizado?: string
}

const chequear = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message) }

export async function listarJornadas(): Promise<Jornada[]> {
  const r = await supabase.from(T.jornadas).select('id, nombre, torneos, config, plan, actualizado').order('creado', { ascending: false })
  chequear(r)
  return (r.data ?? []) as Jornada[]
}

export async function guardarJornada(j: Jornada): Promise<void> {
  chequear(await supabase.from(T.jornadas).upsert({ id: j.id, nombre: j.nombre, torneos: j.torneos, config: j.config, plan: j.plan }))
}

export async function eliminarJornada(id: string): Promise<void> {
  chequear(await supabase.from(T.jornadas).delete().eq('id', id))
}
