import { useState } from 'react'
import { ChevronDown, Database, Info } from 'lucide-react'

const CLAVE = 'generador:instructivo-cerrado'

/** Cómo se usa la app y qué tener en cuenta (se puede plegar; recuerda si lo cerraron) */
export default function Instructivo() {
  const [abierto, setAbierto] = useState(() => {
    try { return localStorage.getItem(CLAVE) !== '1' } catch { return true }
  })
  const alternar = () => {
    const nuevo = !abierto
    setAbierto(nuevo)
    try { nuevo ? localStorage.removeItem(CLAVE) : localStorage.setItem(CLAVE, '1') } catch { /* nada */ }
  }

  return (
    <section className="mb-5 overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
      <button onClick={alternar} aria-expanded={abierto} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="flex items-center gap-2 font-display text-lg font-bold"><Info className="h-5 w-5" aria-hidden /> ¿Cómo se usa?</span>
        <ChevronDown className={`h-5 w-5 transition ${abierto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {abierto && (
        <div className="grid gap-5 border-t border-noche/10 px-4 py-4 text-sm text-noche/80 md:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold text-noche">Armar un torneo, paso a paso</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li><strong>Torneo:</strong> nombre (con la categoría, como lo publica el club), fechas y, si querés, inscripción, premio, formato de partido por instancia y una observación.</li>
              <li><strong>Parejas:</strong> se inscriben de a una (mínimo 6, máximo 24). Si tienen problemas de horario, anotalos: te van a aparecer resaltados al armar las zonas.</li>
              <li><strong>Zonas:</strong> sorteo automático, acomodás a mano lo que necesites y le ponés día y hora a cada partido (con “Completar automático” se reparten solos). Una zona con resultados ya no se puede modificar.</li>
              <li><strong>Playoff:</strong> el cuadro se arma solo con los clasificados (1° Zona A vs 2° Zona B…) y le ponés día y hora a la primera ronda. Con el primer resultado de playoff, los cruces quedan fijos.</li>
              <li><strong>Partidos:</strong> cargás los resultados; las posiciones de cada zona y los cruces del playoff se completan solos. Los partidos que faltan se pueden reprogramar (siempre a una fecha y hora futuras). También está el cronograma en PDF con los resultados.</li>
              <li><strong>Publicar:</strong> con las zonas armadas, el botón “Publicar” (arriba, en cada torneo) lo muestra en la página pública de torneos para los jugadores, que se actualiza sola con horarios y resultados. El estado (Pendiente, En curso, Finalizado) se calcula solo; “Cancelar torneo” es manual.</li>
              <li><strong>Imágenes:</strong> zonas y playoff (con nombres y resultados a medida que se cargan) listas para compartir por WhatsApp (también con el botón verde de abajo a la derecha).</li>
            </ol>
            <p className="mt-2 text-xs text-noche/60">Cada categoría es un torneo aparte. Para otra categoría, usá “Duplicar” y cambiá el nombre y las parejas.</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-cancha-suave/60 p-3 ring-1 ring-cancha/15">
              <p className="mb-1.5 flex items-center gap-2 font-semibold text-noche"><Database className="h-4 w-4" aria-hidden /> Dónde se guardan los torneos</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Todo se guarda solo en la <strong>base de datos</strong>: los ves desde cualquier celular o compu entrando con el usuario.</li>
                <li>Si dos personas cargan resultados a la vez, tocá <strong>Traer cambios</strong> en “Partidos” para ver lo que cargó la otra.</li>
                <li>Arriba a la derecha de cada torneo se ve si los cambios ya quedaron guardados.</li>
              </ul>
            </div>
            <div className="rounded-lg bg-vidrio p-3">
              <p className="mb-1 font-semibold text-noche">Formato de partido y resultados</p>
              <p>Cada instancia (zonas, octavos, cuartos, semi, final) tiene su formato: al mejor de 3 sets, mejor de 3 con super tiebreak, americano a 7 o a 9 games. Se elige al crear el torneo o en cada instancia, y con eso se validan los resultados.</p>
              <p className="mt-2">Zonas de 3: posiciones por partidos ganados, después resultado entre ellos, diferencia de sets y de games. Si el empate es total, se ordena a mano según el sorteo.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}