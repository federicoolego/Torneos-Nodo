import { LETRAS, partidosDeZona, type Categoria, type Horario } from '../../lib/torneo'
import { clavesJugadas } from '../../lib/resultados'
import { Card } from '../ui'
import { CompletarHorarios, EditorHorario } from '../Horarios'
import { ProblemaHorario } from './Datos'

type Props = { cat: Categoria; cambiar: (f: (c: Categoria) => Categoria) => void }

/** Días y horarios de los partidos de zona (se muestra dentro del paso "Zonas", como en "Playoff") */
export default function HorariosZona({ cat, cambiar }: Props) {
  const nombre = (id: string) => cat.parejas.find((p) => p.id === id)?.nombre ?? '—'
  const porZona = cat.zonas.map((z, zi) => partidosDeZona(z, zi, nombre))
  const jugados = clavesJugadas(cat).zona
  // orden para completar automático: primera fecha de todas las zonas, después la segunda…
  const grupos = [1, 2, 3, 4].map((n) => porZona.flatMap((ps) => ps.filter((p) => p.numero === n).map((p) => p.key))).filter((g) => g.length)
  const set = (key: string, h: Horario) => cambiar((c) => ({ ...c, horariosZona: { ...c.horariosZona, [key]: h } }))

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">Días y horarios</h3>
          <p className="max-w-xl text-sm text-noche/65">Día y hora de cada partido. Con “Completar automático” se reparten en turnos y después ajustás a mano. Los días tienen que estar dentro de las fechas del torneo y, para reprogramar, la nueva fecha y hora tienen que ser futuras.</p>
        </div>
        <CompletarHorarios grupos={grupos} fechaInicial={cat.fechaInicio} desde={cat.fechaInicio} hasta={cat.fechaFin} actuales={cat.horariosZona} jugados={jugados}
          onAplicar={(h) => cambiar((c) => ({ ...c, horariosZona: h }))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {porZona.map((ps, zi) => (
          <section key={zi} className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
            <h4 className="bg-noche px-4 py-2 font-display text-lg font-bold text-white">Zona {LETRAS[zi]}</h4>
            {cat.zonas[zi].some((id) => cat.parejas.find((p) => p.id === id)?.horario) && (
              <div className="space-y-1 border-b border-noche/5 p-3">
                {cat.zonas[zi].map((id) => {
                  const p = cat.parejas.find((x) => x.id === id)
                  return p?.horario ? (
                    <div key={id} className="text-xs"><span className="font-semibold">{p.nombre}:</span><ProblemaHorario texto={p.horario} compacto /></div>
                  ) : null
                })}
              </div>
            )}
            <ul className="divide-y divide-noche/5">
              {ps.map((p) => (
                <li key={p.key} className="space-y-2 p-3">
                  <p className="text-sm"><span className="font-semibold text-cancha">{p.titulo}:</span> {p.a} <span className="text-noche/45">vs</span> {p.b}</p>
                  <EditorHorario valor={cat.horariosZona[p.key]} onChange={(h) => set(p.key, h)} desde={cat.fechaInicio} hasta={cat.fechaFin} requerido jugado={jugados.has(p.key)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  )
}
