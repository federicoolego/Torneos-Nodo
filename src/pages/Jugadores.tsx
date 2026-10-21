import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, GitMerge, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react'
import { agregarJugador, eliminarJugador, listarPadronCompleto, renombrarJugador, unificarJugadores, type JugadorPadron } from '../lib/jugadores'
import { CATEGORIAS_JUGADOR, esCategoriaJugador, rama, type CategoriaJugador } from '../lib/categorias'
import { BadgeCategoriaJugador } from '../components/Categoria'
import { claveJugador, mayusculas, nombrePropio } from '../lib/torneo'
import { Alerta, Button, Input, Modal, Select, Spinner, Titulo, Vacio } from '../components/ui'
import SelectorJugador from '../components/SelectorJugador'

/** ABM del padrón de jugadores: agregar, renombrar, unificar duplicados y eliminar (solo si no jugó) */
export default function Jugadores() {
  const [lista, setLista] = useState<JugadorPadron[] | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; txt: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [texto, setTexto] = useState('')
  // filtro rápido: todos · sin torneos (candidatos a eliminar) · posibles duplicados (candidatos a unificar)
  const [filtro, setFiltro] = useState<'todos' | 'sinTorneos' | 'duplicados'>('todos')
  const [nuevo, setNuevo] = useState('')
  const [nuevaCategoria, setNuevaCategoria] = useState<CategoriaJugador | ''>('')
  const [conCategoria, setConCategoria] = useState(true)
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null)
  const [unificando, setUnificando] = useState<JugadorPadron | null>(null)

  const refrescar = useCallback(async () => {
    try { const r = await listarPadronCompleto(); setLista(r.jugadores); setConCategoria(r.conCategoria) } catch (e) { setLista([]); setMsg({ tipo: 'error', txt: e instanceof Error ? e.message : 'No se pudo leer el padrón.' }) }
  }, [])
  useEffect(() => { void refrescar() }, [refrescar])

  async function accion(f: () => Promise<string | void>) {
    setOcupado(true)
    setMsg(null)
    try { const ok = await f(); await refrescar(); if (ok) setMsg({ tipo: 'ok', txt: ok }) }
    catch (e) { setMsg({ tipo: 'error', txt: e instanceof Error ? e.message : 'Algo salió mal.' }) }
    finally { setOcupado(false) }
  }

  // posibles duplicados: mismo nombre si se ignoran tildes ("PEREZ" y "PÉREZ")
  const grupos = useMemo(() => {
    const m = new Map<string, JugadorPadron[]>()
    for (const j of lista ?? []) m.set(claveJugador(j.nombre), [...(m.get(claveJugador(j.nombre)) ?? []), j])
    return m
  }, [lista])
  const duplicadosDe = (j: JugadorPadron) => (grupos.get(claveJugador(j.nombre)) ?? []).filter((x) => x.id !== j.id)
  const cantDuplicados = useMemo(() => [...grupos.values()].filter((g) => g.length > 1).reduce((s, g) => s + g.length, 0), [grupos])
  const cantSinTorneos = useMemo(() => (lista ?? []).filter((j) => !j.torneos).length, [lista])

  const visibles = useMemo(() => {
    const q = claveJugador(texto)
    return (lista ?? []).filter((j) => (!q || claveJugador(j.nombre).includes(q))
      && (filtro !== 'sinTorneos' || !j.torneos)
      && (filtro !== 'duplicados' || duplicadosDe(j).length > 0))
  }, [lista, texto, filtro]) // eslint-disable-line react-hooks/exhaustive-deps

  const existente = (nombre: string, salvo?: string) => (lista ?? []).find((j) => j.id !== salvo && j.nombre === mayusculas(nombre))

  function agregar(e: FormEvent) {
    e.preventDefault()
    const n = nuevo.trim()
    if (n.length < 3) return setMsg({ tipo: 'error', txt: 'Escribí nombre y apellido.' })
    const ya = existente(n) ?? (lista ?? []).find((j) => claveJugador(j.nombre) === claveJugador(n))
    if (ya) return setMsg({ tipo: 'error', txt: `Ya existe: ${nombrePropio(ya.nombre)}.` })
    void accion(async () => {
      await agregarJugador(n, nuevaCategoria || null)
      setNuevo('')
      setNuevaCategoria('')
      return `Agregado: ${nombrePropio(n)}${nuevaCategoria ? ` (${nuevaCategoria})` : ''}.`
    })
  }

  function guardarEdicion() {
    if (!editando) return
    const n = editando.nombre.trim()
    if (n.length < 3) return setMsg({ tipo: 'error', txt: 'Escribí nombre y apellido.' })
    const actual = lista?.find((j) => j.id === editando.id)
    if (!actual || actual.nombre === mayusculas(n)) { setEditando(null); return }
    const otro = existente(n, editando.id)
    if (otro) {
      // ya existe con ese nombre: es el mismo jugador cargado dos veces → se ofrece unificar
      if (!confirm(`Ya existe "${nombrePropio(otro.nombre)}". ¿Unificarlos? Las parejas de "${nombrePropio(actual.nombre)}" pasan a "${nombrePropio(otro.nombre)}".`)) return
      void accion(async () => { await unificarJugadores(actual.id, otro.id); setEditando(null); return `Unificado en ${nombrePropio(otro.nombre)}.` })
      return
    }
    void accion(async () => { await renombrarJugador(editando.id, n); setEditando(null); return `Renombrado a ${nombrePropio(n)} (también en sus torneos).` })
  }

  return (
    <>
      <Titulo bajada="Padrón de jugadores de NODO. Al renombrar, el cambio se aplica en todos sus torneos. Solo se puede eliminar a quien no jugó ningún torneo.">
        Jugadores
      </Titulo>

      <form onSubmit={agregar} className="mb-4 flex flex-wrap gap-2 rounded-xl bg-white p-3 ring-1 ring-noche/10">
        <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre y apellido del jugador nuevo" className="min-w-[14rem] flex-1" aria-label="Jugador nuevo" />
        {conCategoria && (
          <Select value={nuevaCategoria} onChange={(e) => setNuevaCategoria(esCategoriaJugador(e.target.value) ? e.target.value : '')} className="w-auto" aria-label="Categoría del jugador nuevo">
            <option value="">Categoría (opcional)</option>
            <optgroup label="Damas">{CATEGORIAS_JUGADOR.filter((c) => rama(c) === 'Damas').map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
            <optgroup label="Caballeros">{CATEGORIAS_JUGADOR.filter((c) => rama(c) === 'Caballeros').map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>
          </Select>
        )}
        <Button type="submit" cargando={ocupado}><UserPlus className="h-4 w-4" aria-hidden /> Agregar</Button>
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-noche/40" aria-hidden />
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar jugador…" className="pl-9" aria-label="Buscar jugador" />
        </label>
        {lista && <span className="text-xs text-noche/55">{visibles.length} de {lista.length} jugadores</span>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtro de jugadores">
        {([
          { id: 'todos', label: 'Todos', n: lista?.length ?? 0, ayuda: undefined },
          { id: 'sinTorneos', label: 'Sin torneos', n: cantSinTorneos, ayuda: 'Candidatos a eliminar: no jugaron ningún torneo' },
          { id: 'duplicados', label: 'Posibles duplicados', n: cantDuplicados, ayuda: 'Candidatos a unificar: mismo nombre sin importar tildes' },
        ] as const).map((o) => (
          <button key={o.id} onClick={() => setFiltro(o.id)} aria-pressed={filtro === o.id} title={o.ayuda}
            className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${filtro === o.id ? 'bg-noche text-white' : 'bg-white text-noche/75 ring-1 ring-noche/15 hover:bg-cancha-suave'}`}>
            {o.label} <span className="num text-xs opacity-70">{o.n}</span>
          </button>
        ))}
      </div>
      {filtro === 'sinTorneos' && !!cantSinTorneos && <p className="-mt-1 mb-3 text-xs text-noche/55">No jugaron ningún torneo: se pueden eliminar (por ejemplo, si quedaron cargados por error o como duplicado).</p>}
      {filtro === 'duplicados' && !!cantDuplicados && <p className="-mt-1 mb-3 text-xs text-noche/55">Mismo nombre si se ignoran tildes y mayúsculas. Usá <GitMerge className="inline h-3.5 w-3.5" aria-hidden /> para unificarlos en uno.</p>}

      {msg && <div className="mb-3"><Alerta tipo={msg.tipo}>{msg.txt}</Alerta></div>}

      {lista === null ? <Spinner texto="Cargando jugadores…" /> : visibles.length === 0 ? (
        <Vacio titulo={!lista.length ? 'Todavía no hay jugadores' : filtro === 'sinTorneos' && !cantSinTorneos ? 'Todos los jugadores jugaron algún torneo' : filtro === 'duplicados' && !cantDuplicados ? 'No hay posibles duplicados' : 'No hay jugadores con esa búsqueda'}>
          {lista.length ? null : 'Se agregan acá o al inscribir parejas en un torneo.'}
        </Vacio>
      ) : (
        <ul className="divide-y divide-noche/5 overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
          {visibles.map((j) => {
            const dups = duplicadosDe(j)
            const enEdicion = editando?.id === j.id
            return (
              <li key={j.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                {enEdicion ? (
                  <div className="flex min-w-0 flex-1 gap-2">
                    <Input autoFocus value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') setEditando(null) }}
                      className="py-1.5" aria-label="Nombre" />
                    <button onClick={guardarEdicion} disabled={ocupado} aria-label="Guardar" className="p-1.5 text-cancha"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditando(null)} aria-label="Cancelar" className="p-1.5 text-noche/50"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-noche">{nombrePropio(j.nombre)}{conCategoria && <BadgeCategoriaJugador categoria={j.categoria} />}</p>
                    <p className="text-xs text-noche/55">
                      {j.torneos ? `${j.torneos} ${j.torneos === 1 ? 'torneo' : 'torneos'}` : 'Sin torneos'}
                      {dups.length > 0 && <> · <span className="font-semibold text-amber-700">¿Duplicado de {dups.map((d) => nombrePropio(d.nombre)).join(', ')}?</span></>}
                    </p>
                  </div>
                )}
                {!enEdicion && (
                  <div className="flex items-center">
                    <button onClick={() => setEditando({ id: j.id, nombre: nombrePropio(j.nombre) })} disabled={ocupado} title="Editar nombre" aria-label={`Editar ${nombrePropio(j.nombre)}`}
                      className="p-2 text-noche/50 hover:text-cancha"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setUnificando(j)} disabled={ocupado} title="Unificar con otro jugador (mismo jugador cargado dos veces)" aria-label={`Unificar ${nombrePropio(j.nombre)}`}
                      className="p-2 text-noche/50 hover:text-cancha"><GitMerge className="h-4 w-4" /></button>
                    <button disabled={ocupado || j.torneos > 0} title={j.torneos > 0 ? 'No se puede eliminar: jugó algún torneo' : 'Eliminar'} aria-label={`Eliminar ${nombrePropio(j.nombre)}`}
                      onClick={() => confirm(`¿Eliminar a ${nombrePropio(j.nombre)}?`) && accion(async () => { await eliminarJugador(j.id); return `Eliminado: ${nombrePropio(j.nombre)}.` })}
                      className="p-2 text-noche/50 hover:text-red disabled:opacity-25 disabled:hover:text-noche/50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Unificar origen={unificando} padron={lista ?? []} onCerrar={() => setUnificando(null)}
        onConfirmar={(destino) => {
          const origen = unificando!
          setUnificando(null)
          void accion(async () => { await unificarJugadores(origen.id, destino.id); return `${nombrePropio(origen.nombre)} quedó unificado en ${nombrePropio(destino.nombre)}.` })
        }} />
    </>
  )
}

/** Elige el jugador con el que se unifica (el que queda) */
function Unificar({ origen, padron, onCerrar, onConfirmar }: {
  origen: JugadorPadron | null; padron: JugadorPadron[]; onCerrar: () => void; onConfirmar: (destino: JugadorPadron) => void
}) {
  const [valor, setValor] = useState('')
  useEffect(() => { setValor('') }, [origen])
  if (!origen) return null
  const nombres = padron.filter((j) => j.id !== origen.id).map((j) => nombrePropio(j.nombre))
  const destino = padron.find((j) => j.id !== origen.id && claveJugador(j.nombre) === claveJugador(valor))
  return (
    <Modal abierto titulo="Unificar jugador" onCerrar={onCerrar}>
      <div className="space-y-3 text-sm">
        <p className="text-noche/75">
          Para cuando el mismo jugador quedó cargado dos veces. Todas las parejas de <strong>{nombrePropio(origen.nombre)}</strong>
          {origen.torneos ? ` (${origen.torneos} ${origen.torneos === 1 ? 'torneo' : 'torneos'})` : ''} pasan al jugador que elijas, y {nombrePropio(origen.nombre)} se elimina.
        </p>
        <SelectorJugador valor={valor} onChange={setValor} padron={nombres} placeholder="Buscá el jugador que queda" permitirNuevo={false} />
        {valor && !destino && <p className="text-xs text-amber-700">Elegí un jugador existente de la lista.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
          <Button disabled={!destino} onClick={() => destino && onConfirmar(destino)}><GitMerge className="h-4 w-4" aria-hidden /> Unificar</Button>
        </div>
      </div>
    </Modal>
  )
}
