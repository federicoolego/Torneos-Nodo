import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  MAX_PAREJAS, MIN_PAREJAS, claveJugador, clavePareja, formatoPesos, jugadoresDe, nombrePropio, nuevoId, type Categoria, type Pareja,
} from '../../lib/torneo'
import { Alerta, Button, Card, Field, Input, Textarea } from '../ui'
import { FormatosPorInstancia } from '../Formato'
import SelectorJugador from '../SelectorJugador'
import { listarJugadores } from '../../lib/almacen'
import { instanciasDelTorneo, textoFormatos, zonasBloqueadas } from '../../lib/resultados'

type Props = { cat: Categoria; cambiar: (f: (c: Categoria) => Categoria) => void }

export function PasoDatos({ cat, cambiar }: Props) {
  const fechasMal = !!cat.fechaInicio && !!cat.fechaFin && cat.fechaFin < cat.fechaInicio
  return (
    <Card className="space-y-4">
      <Field label="Nombre del torneo *">
        <Input value={cat.torneo} onChange={(e) => cambiar((c) => ({ ...c, torneo: e.target.value }))} placeholder="Ej: 7ma Caballeros - Torneo Primavera" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha de inicio *">
          <Input type="date" value={cat.fechaInicio} onChange={(e) => cambiar((c) => ({ ...c, fechaInicio: e.target.value, fechaFin: c.fechaFin || e.target.value }))} />
        </Field>
        <Field label="Fecha de fin *" error={fechasMal ? 'No puede ser anterior a la fecha de inicio' : undefined}>
          <Input type="date" value={cat.fechaFin} min={cat.fechaInicio || undefined} onChange={(e) => cambiar((c) => ({ ...c, fechaFin: e.target.value }))} />
        </Field>
      </div>
      <Field label="Inscripción por jugador" hint="Opcional. Si la completás, aparece en las imágenes.">
        <Input inputMode="numeric" value={formatoPesos(cat.inscripcion)} placeholder="Ej: $17.000"
          onChange={(e) => cambiar((c) => ({ ...c, inscripcion: e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9) }))} />
      </Field>
      <Field label="Premio" hint="Opcional. Si lo completás, aparece en las imágenes.">
        <Input value={cat.premio} maxLength={80} onChange={(e) => cambiar((c) => ({ ...c, premio: e.target.value }))} placeholder="Ej: 50% de lo recaudado" />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium text-noche">Formato de partido por instancia</p>
        <p className="mb-2 text-xs text-noche/60">Se usa para validar los resultados. También se puede cambiar después, en cada instancia del paso “Partidos”.</p>
        <FormatosPorInstancia cat={cat} cambiar={cambiar} />
      </div>
      <Field label="Observación" hint="Opcional. Aparece en las imágenes.">
        <Textarea rows={3} value={cat.observacion} onChange={(e) => cambiar((c) => ({ ...c, observacion: e.target.value }))}
          placeholder="Ej: Americano a 9 games. Semifinales y final al mejor de 3 sets, el 3er set es un tiebreak." />
      </Field>
      <Button type="button" variante="fantasma" className="-mt-2 px-2 py-1 text-xs"
        onClick={() => (!cat.observacion.trim() || confirm('Se reemplaza la observación actual. ¿Continuar?')) &&
          cambiar((c) => ({ ...c, observacion: textoFormatos(c, instanciasDelTorneo(c)) }))}>
        Escribir los formatos en la observación
      </Button>
      <p className="text-xs text-noche/55">* Obligatorio</p>
    </Card>
  )
}

export function PasoParejas({ cat, cambiar }: Props) {
  const vacio = { j1: '', j2: '', horario: '' }
  // padrón de jugadores de la base + los de este torneo (los nuevos se dan de alta al guardar)
  const [padronBase, setPadronBase] = useState<string[]>([])
  const [errorPadron, setErrorPadron] = useState(false)
  useEffect(() => { listarJugadores().then(setPadronBase).catch(() => setErrorPadron(true)) }, [])
  const padron = useMemo(() => {
    const m = new Map<string, string>()
    for (const j of [...padronBase, ...cat.parejas.flatMap((p) => jugadoresDe(p))]) if (j.trim()) m.set(claveJugador(j), nombrePropio(j))
    return [...m.values()]
  }, [padronBase, cat.parejas])
  /** si ya existe (aunque esté escrito distinto: tildes, mayúsculas, espacios), se usa el del padrón */
  const delPadron = (t: string) => padron.find((j) => claveJugador(j) === claveJugador(t)) ?? nombrePropio(t)
  const [form, setForm] = useState(vacio)
  const [editando, setEditando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const lleno = cat.parejas.length >= MAX_PAREJAS && !editando
  // no se puede quitar una pareja de una zona que ya tiene resultados
  const bloq = zonasBloqueadas(cat)
  const fija = (id: string) => cat.zonas.some((z, zi) => bloq[zi] && z.includes(id))

  function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    const j1 = delPadron(form.j1)
    const j2 = delPadron(form.j2)
    if (!j1 || !j2) return setError('Completá los dos jugadores.')
    if (j1.length < 3 || j2.length < 3) return setError('Escribí nombre y apellido de cada jugador.')
    if (clavePareja(j1, '') === clavePareja(j2, '')) return setError('Los dos jugadores no pueden ser la misma persona.')
    const clave = clavePareja(j1, j2)
    const repetida = cat.parejas.find((p) => p.id !== editando && clavePareja(...jugadoresDe(p)) === clave)
    if (repetida) return setError(`Esa pareja ya está inscripta: ${repetida.nombre}.`)
    if (!editando && cat.parejas.length >= MAX_PAREJAS) return setError(`El máximo es ${MAX_PAREJAS} parejas.`)
    const datos = { nombre: `${j1} / ${j2}`, jugador1: j1, jugador2: j2, horario: form.horario.trim() }
    cambiar((c) => ({
      ...c,
      parejas: editando
        ? c.parejas.map((p) => (p.id === editando ? { ...p, ...datos } : p))
        : [...c.parejas, { id: nuevoId(), ...datos }],
    }))
    setForm(vacio)
    setEditando(null)
    document.getElementById('jugador1')?.focus()
  }

  function editar(p: Pareja) {
    const [a, b] = jugadoresDe(p)
    setForm({ j1: a, j2: b, horario: p.horario ?? '' })
    setEditando(p.id)
    setError('')
    document.getElementById('jugador1')?.focus()
  }

  const quitar = (id: string) => {
    if (editando === id) { setEditando(null); setForm(vacio) }
    cambiar((c) => ({ ...c, parejas: c.parejas.filter((p) => p.id !== id), zonas: c.zonas.map((z) => z.filter((x) => x !== id)) }))
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <form onSubmit={guardar} className="space-y-3">
          <h2 className="font-display text-2xl font-bold">{editando ? 'Editar pareja' : 'Inscribir pareja'}</h2>
          <Field label="Jugador 1 *">
            <SelectorJugador id="jugador1" valor={form.j1} onChange={(v) => setForm((f) => ({ ...f, j1: v }))} padron={padron} excluir={form.j2} disabled={lleno} />
          </Field>
          <Field label="Jugador 2 *">
            <SelectorJugador valor={form.j2} onChange={(v) => setForm((f) => ({ ...f, j2: v }))} padron={padron} excluir={form.j1} disabled={lleno} />
          </Field>
          <Field label="Problemas de horarios" hint="Opcional. Dejalo vacío si no tienen.">
            <Textarea rows={3} value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })}
              placeholder="Ej: No pueden el viernes antes de las 20 hs" disabled={lleno} />
          </Field>
          {error && <Alerta tipo="error">{error}</Alerta>}
          {lleno && <Alerta tipo="aviso">Ya hay {MAX_PAREJAS} parejas, que es el máximo.</Alerta>}
          <div className="flex gap-2">
            <Button type="submit" disabled={lleno}>
              {editando ? <><Check className="h-4 w-4" aria-hidden /> Guardar cambios</> : <><Plus className="h-4 w-4" aria-hidden /> Inscribir pareja</>}
            </Button>
            {editando && <Button type="button" variante="secundario" onClick={() => { setEditando(null); setForm(vacio); setError('') }}>Cancelar</Button>}
          </div>
          <p className="text-xs text-noche/55">Buscá al jugador en el padrón; si no está, elegí “Agregar … como jugador nuevo”. Se ignoran mayúsculas y tildes, así no se carga dos veces.</p>
          {errorPadron && <Alerta tipo="aviso">No se pudo cargar el padrón de jugadores: podés escribirlos igual.</Alerta>}
        </form>
      </Card>
      <Card>
        <h2 className="font-display text-2xl font-bold">Inscriptas <span className="num text-noche/50">({cat.parejas.length}/{MAX_PAREJAS})</span></h2>
        {cat.parejas.length < MIN_PAREJAS && (
          <div className="mt-2"><Alerta tipo="aviso">Se necesitan al menos {MIN_PAREJAS} parejas para continuar (faltan {MIN_PAREJAS - cat.parejas.length}).</Alerta></div>
        )}
        {cat.parejas.length === 0 ? <p className="mt-2 text-sm text-noche/55">Todavía no inscribiste parejas.</p> : (
          <ol className="mt-2 divide-y divide-noche/5">
            {cat.parejas.map((p, k) => (
              <li key={p.id} className={`flex items-start gap-2 py-2 text-sm ${editando === p.id ? 'bg-cancha-suave/60' : ''}`}>
                <span className="num w-6 pt-0.5 text-noche/40">{k + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.nombre}</p>
                  {p.horario && <ProblemaHorario texto={p.horario} />}
                </div>
                <button onClick={() => editar(p)} aria-label={`Editar ${p.nombre}`} className="p-1 text-noche/45 hover:text-cancha"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => quitar(p.id)} disabled={fija(p.id)} title={fija(p.id) ? 'Su zona ya tiene resultados' : undefined} aria-label={`Quitar ${p.nombre}`} className="p-1 text-noche/45 hover:text-red disabled:opacity-25"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

/** Problema de horario resaltado (se usa en parejas, zonas y horarios) */
export function ProblemaHorario({ texto, compacto = false }: { texto: string; compacto?: boolean }) {
  return (
    <p className={`mt-1 flex gap-1.5 rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900 ring-1 ring-amber-300 ${compacto ? 'text-[11px]' : 'text-xs'}`}>
      <Clock className={`${compacto ? 'h-3 w-3' : 'h-3.5 w-3.5'} mt-px shrink-0`} aria-hidden />
      <span className="whitespace-pre-line">{texto}</span>
    </p>
  )
}