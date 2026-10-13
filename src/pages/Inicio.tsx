import { useCallback, useEffect, useState } from 'react'
import { CloudUpload, Copy, Plus, Trash2 } from 'lucide-react'
import { duplicar, eliminar, listar, migrarLocales, torneosLocales, type ResumenTorneo } from '../lib/almacen'
import { nombreEstado, rangoFechas } from '../lib/torneo'
import { Alerta, Badge, Button, Spinner, Titulo, Vacio } from '../components/ui'
import Instructivo from '../components/Instructivo'

export default function Inicio({ onAbrir, onNuevo }: { onAbrir: (id: string) => void; onNuevo: () => void }) {
  const [lista, setLista] = useState<ResumenTorneo[] | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [locales, setLocales] = useState(torneosLocales)

  const refrescar = useCallback(async () => {
    try { setLista(await listar()) } catch (e) { setLista([]); setMsg({ tipo: 'error', txt: `No se pudo leer la base: ${e instanceof Error ? e.message : e}` }) }
  }, [])
  useEffect(() => { void refrescar() }, [refrescar])

  /** Corre una acción mostrando el error si falla */
  async function accion(f: () => Promise<void>) {
    setOcupado(true)
    try { await f() } catch (e) { setMsg({ tipo: 'error', txt: e instanceof Error ? e.message : 'Algo salió mal.' }) } finally { setOcupado(false) }
  }

  const subirLocales = () => accion(async () => {
    const r = await migrarLocales()
    setLocales(0)
    await refrescar()
    setMsg({ tipo: 'ok', txt: `Torneos de este navegador subidos a la base: ${r.nuevos} nuevo(s), ${r.actualizados} actualizado(s), ${r.sinCambios} ya estaban.` })
  })

  // no se guarda nada todavía: el torneo se crea al completar los datos obligatorios
  const nueva = () => onNuevo()

  return (
    <>
      <Titulo bajada="Cada torneo (una categoría) se arma por separado. Todo queda guardado en la base de datos." accion={<Button onClick={nueva} cargando={ocupado}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>}>
        Torneos
      </Titulo>
      <Instructivo />
      {locales > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cancha-suave p-4 ring-1 ring-cancha/20">
          <p className="text-sm text-noche/80">En este navegador quedaron <strong>{locales} torneo(s)</strong> de la versión anterior (sin base de datos).</p>
          <Button onClick={subirLocales} cargando={ocupado}><CloudUpload className="h-4 w-4" aria-hidden /> Subirlos a la base</Button>
        </div>
      )}
      {msg && <div className="mb-4"><Alerta tipo={msg.tipo}>{msg.txt}</Alerta></div>}
      {lista === null ? <Spinner texto="Cargando torneos…" /> : lista.length === 0 ? (
        <Vacio titulo="Todavía no armaste ningún torneo" accion={<Button onClick={nueva}><Plus className="h-4 w-4" aria-hidden /> Nuevo torneo</Button>}>
          Cargás el torneo, las parejas, armás las zonas y el playoff, generás las imágenes para WhatsApp y cargás los resultados.
        </Vacio>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white p-4 ring-1 ring-noche/10">
              <button onClick={() => onAbrir(c.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-display text-xl font-bold">{c.torneo || 'Torneo sin nombre'}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <Badge tono={c.estado === 'en_curso' ? 'verde' : c.estado === 'finalizado' ? 'azul' : c.estado === 'cancelado' ? 'rojo' : 'ambar'}>{nombreEstado(c.estado)}</Badge>
                  {c.publicado && <Badge tono="pelota">Publicado</Badge>}
                </div>
                <p className="truncate text-sm text-noche/65">{c.fechaInicio ? rangoFechas(c.fechaInicio, c.fechaFin) : 'Sin fechas'}</p>
                <p className="mt-1 text-xs text-noche/50">
                  {c.parejas} parejas · {c.zonas ? `${c.zonas} zonas` : 'sin zonas'}{c.playoff ? ' · playoff armado' : ''} ·{' '}
                  {new Date(c.actualizado).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
              </button>
              <button title="Duplicar (por ejemplo, para otra categoría)" aria-label="Duplicar" className="p-2 text-noche/50 hover:text-cancha" disabled={ocupado}
                onClick={() => accion(async () => { await duplicar(c.id); await refrescar() })}>
                <Copy className="h-4 w-4" />
              </button>
              <button aria-label="Eliminar" className="p-2 text-noche/50 hover:text-red" disabled={ocupado}
                onClick={() => confirm(`¿Eliminar ${c.torneo || 'este torneo'}? Se borra de la base con sus parejas y resultados.`) &&
                  accion(async () => { await eliminar(c.id); await refrescar() })}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
