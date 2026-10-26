import { useState } from 'react'
import { CalendarRange, ChevronDown, Database, Info, Users } from 'lucide-react'

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
              <li><strong>Torneo:</strong> nombre, categoría (Damas, Caballeros o Mixto), fechas y, si querés, inscripción, premio, formato de partido por instancia y una observación.</li>
              <li><strong>Parejas:</strong> se inscriben de a una (mínimo 6, máximo 24). Cada jugador se busca en el padrón; si no está, elegí “Agregar … como jugador nuevo”. Marcá en qué días y horarios pueden jugar (por defecto, cualquiera): por día <em>Todo el día / Solo en… / No puede</em>, el día en que quieren la zona y si prefieren temprano o tarde. Lo que no entre ahí va en la nota.</li>
              <li><strong>Zonas:</strong> si se juegan varios torneos el mismo fin de semana, lo más cómodo es armar zonas y horarios de todos juntos desde <strong>Armar fecha</strong> (ver al costado). Si no, acá: sorteo automático, acomodás a mano y le ponés día, hora y cancha a cada partido. Una zona con resultados ya no se puede modificar.</li>
              <li><strong>Playoff:</strong> el cuadro se arma solo con los clasificados (1° Zona A vs 2° Zona B…) y le ponés día y hora a la primera ronda. Con el primer resultado de playoff, los cruces quedan fijos.</li>
              <li><strong>Partidos:</strong> cargás los resultados; las posiciones de cada zona y los cruces del playoff se completan solos. Los partidos que faltan se pueden reprogramar (siempre a una fecha y hora futuras). También está el cronograma en PDF con los resultados.</li>
              <li><strong>Publicar:</strong> “Publicar info e inscripción” (arriba, en cada torneo) lo muestra en la página pública solo con fechas, formato, inscripción, premio y el botón para inscribirse por WhatsApp, sin parejas ni zonas, mientras lo armás. Con las zonas listas, “Mostrar zonas y partidos” (o “Publicar completo”) muestra zonas, partidos y playoff, que se actualizan solos con horarios y resultados. El estado (Pendiente, En curso, Finalizado) se calcula solo; “Cancelar torneo” es manual.</li>
              <li><strong>Imágenes:</strong> zonas y playoff (con nombres y resultados a medida que se cargan) listas para compartir por WhatsApp (también con el botón verde de abajo a la derecha).</li>
            </ol>
            <p className="mt-2 text-xs text-noche/60">Cada categoría es un torneo aparte. Para otra categoría, usá “Duplicar” y cambiá el nombre y las parejas.</p>
            <p className="mt-2 text-xs text-noche/60"><strong>Importar torneos:</strong> carga un archivo .sql (por ejemplo, el que se arma desde el Excel de la fecha) con torneos, parejas, zonas y horarios. Antes de importar muestra qué va a cargar; si un torneo ya existe, se deja como está salvo que tildes “Actualizar”. Nunca toca resultados.</p>
            <p className="mt-2 text-xs text-noche/60"><strong>Cronograma:</strong> la pestaña Calendario muestra todos los partidos de los torneos pendientes y en curso, juntos y por día y horario: se comparte en PDF, se imprime o se baja en Word, y desde la misma lista se cargan los resultados. Se pueden destildar torneos, sumar otros y ordenarlos. Avisa si hay más partidos a la vez que canchas o un jugador en dos partidos que se pisan.</p>
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
            <div className="rounded-lg bg-pelota/25 p-3 ring-1 ring-pelota/60">
              <p className="mb-1.5 flex items-center gap-2 font-semibold text-noche"><CalendarRange className="h-4 w-4" aria-hidden /> Armar fecha: zonas y horarios automáticos</p>
              <p className="mb-1.5">Junta los torneos que se juegan el mismo fin de semana y arma zonas y horarios de todos, en las mismas canchas, sin choques.</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li><strong>Torneos y canchas:</strong> elegís los torneos (ya creados, con sus parejas), cuántas canchas hay, el horario de cada día (viernes desde las 18, sábado desde las 10, domingo desde las 12, editable) y cuánto dura cada partido (45′ zonas, octavos y cuartos; 1 h semi y final).</li>
                <li><strong>Horarios de las parejas:</strong> repasás los días y horarios de todas las parejas juntas y corregís tocando cada una. Las parejas cargadas antes con el horario escrito en texto se pasan solas con “Interpretar”.</li>
                <li><strong>Zonas:</strong> “Armar zonas por horarios” junta a las parejas que pueden jugar en los mismos horarios. Podés intercambiar parejas entre zonas.</li>
                <li><strong>Grilla de partidos:</strong> “Armar horarios” reparte todos los partidos (zonas y playoff) por día y cancha: nadie juega dos partidos a la vez (aunque esté en dos categorías), el playoff va después de las zonas y se respetan los horarios pedidos. Lo que no se puede respetar queda marcado (rojo: choque · ámbar: pedido de horario) y lo decidís vos: tocá el partido, cambialo y fijalo. “Volver a armar” mantiene los fijados.</li>
                <li><strong>Aplicar a los torneos:</strong> carga día, hora y cancha en cada torneo. Después seguís como siempre: publicar, imágenes, Calendario y resultados.</li>
              </ol>
            </div>
            <div className="rounded-lg bg-vidrio p-3">
              <p className="mb-1.5 flex items-center gap-2 font-semibold text-noche"><Users className="h-4 w-4" aria-hidden /> Jugadores</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Hay un <strong>padrón único</strong> de jugadores: al inscribir una pareja se busca al jugador (sin importar mayúsculas ni tildes), así no se carga dos veces la misma persona.</li>
                <li>En la pestaña <strong>Jugadores</strong> podés agregar, corregir el nombre (se actualiza en todos sus torneos), <strong>unificar</strong> un jugador cargado dos veces y eliminar a quien no jugó ningún torneo.</li>
                <li>Los “posibles duplicados” (mismo nombre con distinta tilde) aparecen marcados para revisarlos.</li>
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