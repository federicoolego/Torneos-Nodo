import { ArrowDown, ArrowUp, ListOrdered, Lock, Plus, Shuffle, Trash2 } from 'lucide-react'
import { LETRAS, clasificados, diasEntre, sugerirZonas, type Categoria } from '../../lib/torneo'
import { textoPareja } from '../../lib/disponibilidad'
import { zonasBloqueadas, playoffIniciado } from '../../lib/resultados'
import { Alerta, Button, Card, Select } from '../ui'
import HorariosZona from './HorariosZona'
import { ProblemaHorario } from './Datos'

type Props = { cat: Categoria; cambiar: (f: (c: Categoria) => Categoria) => void }

export default function PasoZonas({ cat, cambiar }: Props) {
  const zonas = cat.zonas
  const nombre = (id: string) => cat.parejas.find((p) => p.id === id)?.nombre ?? '—'
  const dias = diasEntre(cat.fechaInicio, cat.fechaFin)
  const horarioDe = (id: string) => textoPareja(cat.parejas.find((p) => p.id === id), dias)
  const ubicadas = new Set(zonas.flat())
  const sinZona = cat.parejas.filter((p) => !ubicadas.has(p.id))
  const setZonas = (f: (z: string[][]) => string[][]) => cambiar((c) => ({ ...c, zonas: f(c.zonas) }))
  // una zona con resultados ya no se toca; con el playoff arrancado, ninguna
  const bloq = zonasBloqueadas(cat)
  const algunaBloqueada = bloq.some(Boolean)
  const todoBloqueado = playoffIniciado(cat)
  // quitar una zona corre las letras de las siguientes: no se puede si alguna de ahí en adelante tiene resultados
  const puedeQuitar = (zi: number) => !bloq.slice(zi).some(Boolean)

  const sugerir = (aleatorio: boolean) => {
    if (zonas.flat().length && !confirm('Se reemplaza el reparto actual. ¿Continuar?')) return
    setZonas(() => sugerirZonas(cat.parejas.map((p) => p.id), aleatorio))
  }
  const asignar = (id: string, destino: number) =>
    setZonas((zs) => {
      const sin = zs.map((z) => z.filter((x) => x !== id))
      if (destino >= 0) sin[destino] = [...sin[destino], id]
      return sin
    })
  const mover = (zi: number, pi: number, d: -1 | 1) =>
    setZonas((zs) => {
      const c = zs.map((z) => [...z])
      const j = pi + d
      if (j < 0 || j >= c[zi].length) return zs
      ;[c[zi][pi], c[zi][j]] = [c[zi][j], c[zi][pi]]
      return c
    })

  const errores: string[] = []
  if (sinZona.length) errores.push(`Faltan ubicar ${sinZona.length} pareja(s).`)
  zonas.forEach((z, k) => { if (z.length < 3 || z.length > 4) errores.push(`La zona ${LETRAS[k]} tiene ${z.length}: tienen que ser de 3 o 4.`) })
  if (!zonas.length) errores.push('Armá las zonas con el sorteo o agregándolas a mano.')

  const opciones = (actual: number) => (
    <>
      <option value={-1}>{actual >= 0 ? 'Sacar de la zona' : 'Sin zona'}</option>
      {zonas.map((z, k) => <option key={k} value={k} disabled={k === actual || bloq[k]}>Zona {LETRAS[k]} ({z.length}){bloq[k] ? ' · con resultados' : ''}</option>)}
    </>
  )

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-noche/75">
          Zonas de 3 (clasifican 2) o de 4 (clasifican 3). El orden dentro de la zona es la posición: en zonas de 4 juegan 1 vs 4 y 2 vs 3,
          y después ganadores y perdedores.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sugerir(true)} disabled={cat.parejas.length < 3 || algunaBloqueada}><Shuffle className="h-4 w-4" aria-hidden /> Sorteo aleatorio</Button>
          <Button variante="secundario" onClick={() => sugerir(false)} disabled={cat.parejas.length < 3 || algunaBloqueada}><ListOrdered className="h-4 w-4" aria-hidden /> Por orden de carga</Button>
          <Button variante="secundario" onClick={() => setZonas((zs) => [...zs, []])} disabled={zonas.length >= 26 || todoBloqueado}><Plus className="h-4 w-4" aria-hidden /> Agregar zona</Button>
        </div>
      </Card>
      {algunaBloqueada && (
        <Alerta tipo="aviso">
          {todoBloqueado ? 'Ya hay resultados de playoff: las zonas no se pueden modificar.' : 'Las zonas con resultados cargados no se pueden modificar (ni moverles parejas). Para cambiarlas, primero borrá sus resultados en “Partidos”.'}
        </Alerta>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(15rem,1fr)_2fr]">
        <section aria-label="Parejas sin zona">
          <h3 className="mb-2 font-display text-lg font-semibold">Sin zona <span className="num text-noche/50">({sinZona.length})</span></h3>
          {sinZona.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-sm text-noche/55 ring-1 ring-noche/10">Todas las parejas están ubicadas.</p>
          ) : (
            <ul className="space-y-2">
              {sinZona.map((p) => (
                <li key={p.id} className="rounded-xl bg-white p-3 ring-1 ring-noche/10">
                  <p className="text-sm font-semibold">{p.nombre}</p>
                  {horarioDe(p.id) && <ProblemaHorario texto={horarioDe(p.id)} />}
                  <Select className="mt-2 py-1.5 text-sm" value={-1} onChange={(e) => asignar(p.id, Number(e.target.value))} disabled={!zonas.length} aria-label={`Zona para ${p.nombre}`}>
                    {opciones(-1)}
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Zonas" className="grid content-start gap-4 sm:grid-cols-2">
          {zonas.map((z, zi) => {
            const ok = z.length === 3 || z.length === 4
            const b = bloq[zi]
            return (
              <div key={zi} className={`overflow-hidden rounded-xl bg-white ring-1 ${ok ? 'ring-noche/10' : 'ring-amber-400'}`}>
                <header className="flex items-center justify-between bg-noche px-3 py-2 text-white">
                  <p className="font-display text-lg font-bold">Zona {LETRAS[zi]} <span className="text-sm font-medium text-white/60">· {z.length} parejas</span></p>
                  {b ? <span title="Tiene resultados cargados" className="inline-flex items-center gap-1 text-xs text-pelota"><Lock className="h-3.5 w-3.5" aria-hidden /> Con resultados</span> : (
                    <button onClick={() => setZonas((zs) => zs.filter((_, k) => k !== zi))} disabled={!puedeQuitar(zi)} title={puedeQuitar(zi) ? undefined : 'Hay zonas siguientes con resultados'}
                      aria-label={`Quitar zona ${LETRAS[zi]}`} className="text-white/60 hover:text-white disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                  )}
                </header>
                <ol className="divide-y divide-noche/5">
                  {z.map((id, pi) => (
                    <li key={id} className="flex gap-2 p-3">
                      <span className="num mt-0.5 w-5 shrink-0 font-display text-lg font-bold text-noche/40">{pi + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{nombre(id)}</p>
                        {horarioDe(id) && <ProblemaHorario texto={horarioDe(id)} compacto />}
                        <Select className="mt-1.5 py-1 text-xs" value={zi} onChange={(e) => asignar(id, Number(e.target.value))} disabled={b} aria-label={`Mover ${nombre(id)}`}>
                          {opciones(zi)}
                        </Select>
                      </div>
                      <div className="flex flex-col">
                        <button onClick={() => mover(zi, pi, -1)} disabled={b || pi === 0} aria-label="Subir" className="p-1 text-noche/50 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
                        <button onClick={() => mover(zi, pi, 1)} disabled={b || pi === z.length - 1} aria-label="Bajar" className="p-1 text-noche/50 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ol>
                {z.length === 0 && <p className="p-3 text-sm text-noche/50">Vacía: mandá parejas desde “Sin zona”.</p>}
              </div>
            )
          })}
        </section>
      </div>

      <p className={`rounded-xl p-3 text-sm ring-1 ${errores.length ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-noche/70 ring-noche/10'}`}>
        {errores.length ? errores.join(' ') : `${zonas.length} zonas · clasifican ${clasificados(zonas).length} al playoff. Los cambios se guardan solos.`}
      </p>

      {errores.length === 0 && <HorariosZona cat={cat} cambiar={cambiar} />}
    </div>
  )
}