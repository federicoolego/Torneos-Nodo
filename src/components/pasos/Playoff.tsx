import { Sparkles } from 'lucide-react'
import {
  clasificados, cuadroAutomatico, erroresCuadro, rondasPlayoff, tamCuadro, nombreFase, type Categoria, type Horario, type Slot,
} from '../../lib/torneo'
import { clavesJugadas, playoffIniciado } from '../../lib/resultados'
import { Alerta, Button, Card, Select } from '../ui'
import { CompletarHorarios, EditorHorario } from '../Horarios'

type Props = { cat: Categoria; cambiar: (f: (c: Categoria) => Categoria) => void }
/** Lado sin elegir (se guarda así porque en JSON no existe undefined) */
const SIN: Slot = { zona: -1, pos: -1 }
/** '' = sin elegir · 'libre' · 'zona:pos' */
const aValor = (s: Slot | null | undefined) => (s === undefined || (s && s.zona < 0) ? '' : s === null ? 'libre' : `${s.zona}:${s.pos}`)
const deValor = (v: string): Slot | null =>
  v === '' ? SIN : v === 'libre' ? null : { zona: Number(v.split(':')[0]), pos: Number(v.split(':')[1]) }

export default function PasoPlayoff({ cat, cambiar }: Props) {
  const cl = clasificados(cat.zonas)
  const b = tamCuadro(cl.length)
  const vacio: (Slot | null)[][] = Array.from({ length: b / 2 }, () => [SIN, SIN])
  const cruces: (Slot | null)[][] = cat.cuadro && cat.cuadro.length === b / 2 ? cat.cuadro : vacio
  const errores = erroresCuadro(cruces, cat.zonas)
  const valido = errores.length === 0 && !!cat.cuadro
  const rondas = valido ? rondasPlayoff(cat.cuadro!) : []
  // con algún resultado de playoff cargado, los cruces quedan fijos
  const fijo = playoffIniciado(cat)
  const jugados = clavesJugadas(cat).playoff
  const usados = new Set(cruces.flat().filter((s): s is Slot => !!s && s.zona >= 0).map((s) => `${s.zona}:${s.pos}`))

  const set = (i: number, k: 0 | 1, v: string) =>
    cambiar((c) => {
      const base = (c.cuadro && c.cuadro.length === b / 2 ? c.cuadro : vacio).map((x) => [...x])
      base[i][k] = deValor(v)
      return { ...c, cuadro: base }
    })
  const setH = (key: string, h: Horario) => cambiar((c) => ({ ...c, horariosPlayoff: { ...c.horariosPlayoff, [key]: h } }))
  const grupos = rondas.map((r) => r.filter((p) => !p.bye).map((p) => p.key)).filter((g) => g.length)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-noche/75">
            Cruces de {nombreFase(b).toLowerCase()} con las posiciones de zona. Con {cl.length} clasificados
            {b - cl.length > 0 ? `, ${b - cl.length} pasan directo a la ronda siguiente (lado “Libre”).` : ', no hay lados libres.'}
          </p>
          <Button disabled={fijo} onClick={() => (!cat.cuadro || confirm('Se reemplazan los cruces actuales. ¿Continuar?')) && cambiar((c) => ({ ...c, cuadro: cuadroAutomatico(c.zonas) }))}>
            <Sparkles className="h-4 w-4" aria-hidden /> Armar automático
          </Button>
        </div>
        {fijo && <div className="mt-3"><Alerta tipo="aviso">Ya hay resultados de playoff: los cruces no se pueden modificar. Los partidos que faltan se pueden reprogramar.</Alerta></div>}
        <ol className="mt-4 grid gap-2 md:grid-cols-2">
          {cruces.map((c, i) => (
            <li key={i} className="rounded-lg bg-vidrio p-3">
              <p className="mb-1.5 text-xs font-semibold text-noche/60">{b === 2 ? 'Final' : `${nombreFase(b)} ${i + 1}`}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {([0, 1] as const).map((k) => (
                  <div key={k} className={k === 1 ? 'col-start-3' : ''}>
                    <Select value={aValor(c[k])} onChange={(e) => set(i, k, e.target.value)} disabled={fijo} className="py-1.5 text-sm" aria-label={`Partido ${i + 1}, lado ${k + 1}`}>
                      <option value="">Elegir…</option>
                      {cl.map((x) => <option key={x.key} value={x.key} disabled={usados.has(x.key) && aValor(c[k]) !== x.key}>{x.label}</option>)}
                      <option value="libre">Libre (pasa directo)</option>
                    </Select>
                  </div>
                ))}
                <span className="col-start-2 row-start-1 text-xs font-semibold text-noche/45">vs</span>
              </div>
            </li>
          ))}
        </ol>
        {errores.length > 0 && <div className="mt-3"><Alerta tipo="aviso">{errores.join(' ')}</Alerta></div>}
      </Card>

      {valido && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold">Días y horarios</h3>
              <p className="text-sm text-noche/65">Día y hora: obligatorio en la primera ronda; en las siguientes es opcional. Los días tienen que estar dentro de las fechas del torneo y, para reprogramar, la nueva fecha y hora tienen que ser futuras.</p>
            </div>
            <CompletarHorarios grupos={grupos} fechaInicial={cat.fechaFin || cat.fechaInicio} actuales={cat.horariosPlayoff} desde={cat.fechaInicio} hasta={cat.fechaFin} jugados={jugados} onAplicar={(h) => cambiar((c) => ({ ...c, horariosPlayoff: h }))} />
          </div>
          <div className="space-y-5">
            {rondas.map((r, ri) => r.some((p) => !p.bye) && (
              <section key={ri}>
                <h4 className="mb-2 font-display text-lg font-semibold">{r[0].fase}</h4>
                <ul className="grid gap-3 md:grid-cols-2">
                  {r.filter((p) => !p.bye).map((p) => (
                    <li key={p.key} className="space-y-2 rounded-lg bg-vidrio p-3">
                      <p className="text-sm"><span className="font-semibold text-cancha">{p.titulo}:</span> {p.a} <span className="text-noche/45">vs</span> {p.b}</p>
                      <EditorHorario valor={cat.horariosPlayoff[p.key]} onChange={(h) => setH(p.key, h)} desde={cat.fechaInicio} hasta={cat.fechaFin} jugado={jugados.has(p.key)} requerido={ri === 0 || rondas[0].every((x) => x.bye) && ri === 1} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
