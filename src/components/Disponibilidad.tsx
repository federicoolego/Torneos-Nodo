import { Plus, Sparkles, X } from 'lucide-react'
import { diaCorto, type Disponibilidad, type Franja } from '../lib/torneo'
import { interpretarTexto, resumenDisponibilidad } from '../lib/disponibilidad'
import { Button, Input, Select } from './ui'

type Modo = 'libre' | 'franjas' | 'no'

/**
 * Días y horarios en que puede jugar una pareja, día por día.
 * `texto`: lo que escribieron (para "Interpretar el texto"). undefined = sin cargar · { dias: {} } = cargado, sin restricciones.
 */
export function EditorDisponibilidad({ valor, dias, texto, onChange }: {
  valor: Disponibilidad | undefined; dias: string[]; texto?: string; onChange: (d: Disponibilidad | undefined) => void
}) {
  const d: Disponibilidad = valor ?? { dias: {} }
  const modo = (f: string): Modo => (!d.dias[f] ? 'libre' : d.dias[f].length ? 'franjas' : 'no')
  const zona = new Set(d.zona ?? [])
  const emitir = (n: Disponibilidad) => onChange(n)

  const setModo = (f: string, m: Modo) => {
    const nd = { ...d.dias }
    if (m === 'libre') delete nd[f]
    else nd[f] = m === 'no' ? [] : [{ desde: '', hasta: '' }]
    const z = (d.zona ?? []).filter((x) => x !== f || m !== 'no')
    emitir({ ...d, dias: nd, zona: z })
  }
  const setFranja = (f: string, i: number, fr: Franja) => emitir({ ...d, dias: { ...d.dias, [f]: d.dias[f].map((x, k) => (k === i ? fr : x)) } })
  const sumarFranja = (f: string) => emitir({ ...d, dias: { ...d.dias, [f]: [...d.dias[f], { desde: '', hasta: '' }] } })
  const quitarFranja = (f: string, i: number) => {
    const resto = d.dias[f].filter((_, k) => k !== i)
    const nd = { ...d.dias }
    if (resto.length) nd[f] = resto
    else delete nd[f]
    emitir({ ...d, dias: nd })
  }
  const alternarZona = (f: string) => {
    const z = new Set(zona)
    if (z.has(f)) z.delete(f)
    else z.add(f)
    emitir({ ...d, zona: dias.filter((x) => z.has(x)) })
  }
  const interpretar = () => {
    const r = texto ? interpretarTexto(texto, dias) : null
    if (!r) return alert('No pude interpretar el texto: cargalo a mano.')
    emitir(r)
  }
  const resumen = resumenDisponibilidad(valor, dias)

  return (
    <div className="space-y-3">
      {texto && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          <span className="whitespace-pre-line"><strong>Horario escrito antes:</strong> {texto}</span>
          <Button type="button" variante="secundario" className="px-2 py-1 text-xs" onClick={interpretar}><Sparkles className="h-3.5 w-3.5" aria-hidden /> Interpretar el texto</Button>
        </div>
      )}
      <ul className="divide-y divide-noche/5 rounded-lg ring-1 ring-noche/10">
        {dias.map((f) => (
          <li key={f} className="space-y-2 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 whitespace-nowrap font-display text-base font-semibold">{diaCorto(f)}</span>
              <div role="radiogroup" aria-label={`Disponibilidad del ${diaCorto(f)}`} className="inline-flex overflow-hidden rounded-lg ring-1 ring-noche/15">
                {([['libre', 'Todo el día'], ['franjas', 'Solo en…'], ['no', 'No puede']] as [Modo, string][]).map(([m, t]) => (
                  <button key={m} type="button" role="radio" aria-checked={modo(f) === m} onClick={() => setModo(f, m)}
                    className={`px-2.5 py-1 text-xs font-semibold ${modo(f) === m ? (m === 'no' ? 'bg-red text-white' : 'bg-cancha text-white') : 'bg-white text-noche/70 hover:bg-vidrio'}`}>{t}</button>
                ))}
              </div>
              {dias.length > 1 && modo(f) !== 'no' && (
                <label className="ml-auto flex items-center gap-1.5 text-xs text-noche/70">
                  <input type="checkbox" checked={zona.has(f)} onChange={() => alternarZona(f)} /> Zona este día
                </label>
              )}
            </div>
            {modo(f) === 'franjas' && (
              <div className="space-y-1.5 pl-1 sm:pl-[5.5rem]">
                {d.dias[f].map((fr, i) => (
                  <div key={i} className="grid grid-cols-[auto_minmax(0,7rem)_auto_minmax(0,7rem)_auto] items-center gap-1.5 text-xs">
                    <span className="text-noche/60">desde</span>
                    <Input type="time" step={900} value={fr.desde} onChange={(e) => setFranja(f, i, { ...fr, desde: e.target.value })} className="px-2 py-1" aria-label="Desde" />
                    <span className="text-noche/60">hasta</span>
                    <Input type="time" step={900} value={fr.hasta} onChange={(e) => setFranja(f, i, { ...fr, hasta: e.target.value })} className="px-2 py-1" aria-label="Hasta" />
                    <button type="button" onClick={() => quitarFranja(f, i)} className="p-1 text-noche/40 hover:text-red" aria-label="Quitar franja"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => sumarFranja(f)} className="inline-flex items-center gap-1 text-xs font-semibold text-cancha hover:underline"><Plus className="h-3 w-3" aria-hidden /> Otra franja</button>
                <p className="text-[11px] text-noche/50">Vacío en “desde” = desde que abren; vacío en “hasta” = hasta el cierre.</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-noche/70">Preferencia</span>
        <Select value={d.preferencia ?? ''} onChange={(e) => emitir({ ...d, preferencia: e.target.value as Disponibilidad['preferencia'] })} className="!w-auto py-1 text-sm">
          <option value="">Sin preferencia</option>
          <option value="temprano">Lo más temprano posible</option>
          <option value="tarde">Lo más tarde posible</option>
        </Select>
        <Button type="button" variante="fantasma" className="ml-auto px-2 py-1 text-xs" onClick={() => onChange({ dias: {} })}>Puede cualquier día y horario</Button>
      </div>
      <p className="text-xs text-noche/60">
        {resumen ? <><strong>Queda:</strong> {resumen}.</> : valor ? 'Sin restricciones: puede jugar cualquier día y horario.' : 'Todavía sin cargar (se toma como sin restricciones).'}
        {dias.length > 1 && ' “Zona este día”: la zona se arma ese día (si no marcás ninguno, cualquiera). El playoff respeta los horarios de cada día.'}
      </p>
    </div>
  )
}

/** Resumen corto de la disponibilidad (chip verde) o aviso de "sin cargar" si escribieron algo */
export function ChipDisponibilidad({ valor, dias, texto }: { valor: Disponibilidad | undefined; dias: string[]; texto?: string }) {
  const r = resumenDisponibilidad(valor, dias)
  if (r) return <span className="inline-block rounded-md bg-cancha-suave px-2 py-0.5 text-[11px] font-semibold text-cancha">{r}</span>
  if (!valor && texto?.trim()) return <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Días y horarios sin cargar</span>
  return <span className="inline-block rounded-md bg-vidrio px-2 py-0.5 text-[11px] text-noche/55">Sin restricciones</span>
}
