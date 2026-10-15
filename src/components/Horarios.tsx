import { useEffect, useState } from 'react'
import { Lock, Wand2 } from 'lucide-react'
import { enPasado, hoyLocal, rangoFechas, sumarMinutos, textoHorario, type Horario } from '../lib/torneo'
import { Alerta, Button, Input, Modal, Select } from './ui'

/** Días en que se puede programar un partido: del inicio del torneo (o de hoy, si ya empezó) al fin */
export function rangoProgramable(desde?: string, hasta?: string) {
  const hoy = hoyLocal()
  return { min: desde && desde > hoy ? desde : hoy, max: hasta || undefined }
}

/** ¿El día cae fuera de las fechas del torneo? */
export const fueraDelTorneo = (fecha: string, desde?: string, hasta?: string) =>
  !!fecha && ((!!desde && fecha < desde) || (!!hasta && fecha > hasta))

/** Error al cambiar el día u hora de un partido: tiene que estar dentro del torneo y en el futuro */
export function errorHorario(antes: Horario, nuevo: Horario, desde?: string, hasta?: string): string {
  const cambio = nuevo.fecha !== (antes.fecha ?? '') || nuevo.hora !== (antes.hora ?? '')
  if (!cambio || !nuevo.fecha) return ''
  if (fueraDelTorneo(nuevo.fecha, desde, hasta)) {
    return desde && hasta ? `El día tiene que estar dentro del torneo (${rangoFechas(desde, hasta)}).` : 'El día tiene que estar dentro de las fechas del torneo.'
  }
  if (enPasado(nuevo.fecha, nuevo.hora || undefined)) {
    return nuevo.hora ? 'El día y la hora tienen que ser futuros.' : 'El día no puede ser anterior a hoy.'
  }
  return ''
}

/**
 * Día, hora y complejo de un partido. El día tiene que estar entre el inicio y el fin del torneo y, al cambiar
 * día u hora, quedar en el futuro (lo que se escribe queda en borrador hasta que es válido).
 * `jugado`: tiene resultado, no se reprograma.
 */
export function EditorHorario({ valor, onChange, requerido = false, jugado = false, desde, hasta }: {
  valor?: Horario; onChange: (h: Horario) => void; requerido?: boolean; jugado?: boolean
  /** fechas del torneo (inicio y fin) */
  desde?: string; hasta?: string
}) {
  const guardado: Horario = { fecha: valor?.fecha ?? '', hora: valor?.hora ?? '' }
  const [d, setD] = useState(guardado)
  const firma = `${guardado.fecha}|${guardado.hora}`
  useEffect(() => setD({ fecha: valor?.fecha ?? '', hora: valor?.hora ?? '' }), [firma]) // eslint-disable-line react-hooks/exhaustive-deps

  if (jugado) {
    return <p className="flex items-center gap-1.5 text-xs text-noche/55"><Lock className="h-3.5 w-3.5" aria-hidden /> Jugado · {textoHorario(valor)}</p>
  }
  const { min, max } = rangoProgramable(desde, hasta)
  const error = errorHorario(guardado, d, desde, hasta)
  // el día guardado quedó fuera del torneo (por ejemplo, se cambiaron las fechas del torneo después de programar)
  const fuera = fueraDelTorneo(guardado.fecha, desde, hasta)
  const cambiar = (n: Horario) => {
    setD(n)
    if (!errorHorario(guardado, n, desde, hasta)) onChange(n)
  }
  const falta = requerido && (!d.fecha || !d.hora)
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1.4fr_1fr] gap-2 sm:max-w-sm">
        <Input type="date" value={d.fecha} min={min} max={max} onChange={(e) => cambiar({ ...d, fecha: e.target.value })} aria-label="Día"
          className={`py-1.5 ${error || fuera ? 'ring-red' : falta && !d.fecha ? 'ring-amber-400' : ''}`} />
        <Input type="time" value={d.hora} onChange={(e) => cambiar({ ...d, hora: e.target.value })} aria-label="Hora"
          className={`py-1.5 ${error ? 'ring-red' : falta && !d.hora ? 'ring-amber-400' : ''}`} />
      </div>
      {error && <p className="text-xs text-red">{error} No se guardó: sigue {textoHorario(valor)}.</p>}
      {!error && fuera && desde && hasta && <p className="text-xs text-red">Este día quedó fuera de las fechas del torneo ({rangoFechas(desde, hasta)}). Cambialo.</p>}
    </div>
  )
}

/**
 * Completa horarios en orden: los partidos se reparten en turnos de N partidos a la vez,
 * cada turno dura M minutos. No toca los partidos ya jugados, el primer turno tiene que ser futuro
 * y todos los partidos tienen que entrar dentro de las fechas del torneo.
 */
export function CompletarHorarios({ grupos, actuales, onAplicar, etiqueta = 'Completar automático', fechaInicial, jugados, desde, hasta }: {
  /** partidos agrupados por ronda: cada grupo arranca en un turno nuevo (una ronda después de la otra) */
  grupos: string[][]
  actuales: Record<string, Horario>
  onAplicar: (nuevos: Record<string, Horario>) => void
  etiqueta?: string
  /** día con el que arranca (por defecto, el inicio del torneo) */
  fechaInicial?: string
  /** claves de partidos con resultado: no se modifican */
  jugados?: Set<string>
  /** fechas del torneo (inicio y fin) */
  desde?: string; hasta?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const { min: minDia, max: maxDia } = rangoProgramable(desde, hasta)
  // primer día: el que corresponda, siempre dentro del torneo y no anterior a hoy
  const [fecha, setFecha] = useState(() => {
    let f = fechaInicial || desde || minDia
    if (f < minDia) f = minDia
    if (maxDia && f > maxDia) f = maxDia
    return f
  })
  const [hora, setHora] = useState('18:00')
  const [min, setMin] = useState(75)
  const [canchas, setCanchas] = useState(3)
  const [soloVacios, setSoloVacios] = useState(true)
  const pendientes = grupos.map((g) => g.filter((c) => !jugados?.has(c)))
  const pasado = enPasado(fecha, hora)

  /** Reparte los partidos en turnos y avisa si alguno cae fuera de las fechas del torneo */
  function planificar() {
    const out: Record<string, Horario> = { ...actuales }
    let turno = 0
    let desborda = false
    for (const g of pendientes) {
      let k = 0
      for (const c of g) {
        if (soloVacios && actuales[c]?.fecha && actuales[c]?.hora) continue
        const t = sumarMinutos(fecha, hora, (turno + Math.floor(k / canchas)) * min)
        if (fueraDelTorneo(t.fecha, desde, hasta)) desborda = true
        out[c] = { fecha: t.fecha, hora: t.hora }
        k++
      }
      turno += Math.ceil(k / canchas)
    }
    return { out, desborda }
  }
  const plan = abierto ? planificar() : null
  const invalido = pasado || !!plan?.desborda

  function aplicar() {
    if (!plan || invalido) return
    onAplicar(plan.out)
    setAbierto(false)
  }

  return (
    <>
      <Button variante="secundario" onClick={() => setAbierto(true)} disabled={!pendientes.flat().length}><Wand2 className="h-4 w-4" aria-hidden /> {etiqueta}</Button>
      <Modal abierto={abierto} titulo="Completar horarios" onCerrar={() => setAbierto(false)}>
        <div className="space-y-3 text-sm">
          <p className="text-noche/70">Los partidos se asignan en orden, en turnos: tantos partidos a la vez como elijas, y cada ronda arranca cuando termina la anterior. Los partidos ya jugados no se tocan. Después podés corregir cualquiera a mano.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">Primer día<Input type="date" value={fecha} min={minDia} max={maxDia} onChange={(e) => setFecha(e.target.value)} className="mt-1" /></label>
            <label className="block">Hora de inicio<Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="mt-1" /></label>
            <label className="block">Minutos por turno<Input type="number" min={20} max={180} value={min} onChange={(e) => setMin(Number(e.target.value) || 75)} className="mt-1" /></label>
            <label className="block">Partidos a la vez
              <Select value={canchas} onChange={(e) => setCanchas(Number(e.target.value))} className="mt-1">
                {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </label>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={soloVacios} onChange={(e) => setSoloVacios(e.target.checked)} /> Completar solo los que no tienen horario</label>
          {pasado && <Alerta tipo="aviso">El primer turno tiene que ser futuro.</Alerta>}
          {!pasado && plan?.desborda && (
            <Alerta tipo="aviso">
              Con estos turnos, algunos partidos quedan fuera de las fechas del torneo{desde && hasta ? ` (${rangoFechas(desde, hasta)})` : ''}.
              Probá con más partidos a la vez, turnos más cortos, una hora de inicio más temprana o un primer día anterior.
            </Alerta>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variante="secundario" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={invalido}>Aplicar</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
