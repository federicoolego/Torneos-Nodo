import type { SeccionAyuda } from '../Ayuda'
import { textoReglas } from '../../lib/puntos'
import { MOSTRAR_CATEGORIAS_PUBLICAS, MOSTRAR_RECATEGORIZACIONES_PUBLICAS } from '../../lib/publico'

/** Instructivo de la página pública (jugadores y visitantes): una sección por pestaña */
export const AYUDA_PUBLICA: SeccionAyuda[] = [
  {
    id: 'torneos',
    titulo: 'Torneos',
    que: <>La lista de los torneos que publicó NODO: los que se están jugando, los que vienen y los que ya terminaron.</>,
    para: <>Encontrar tu torneo y entrar a ver zonas, horarios, resultados y playoff, actualizados a medida que se juegan.</>,
    pasos: [
      <>Buscá el torneo por nombre o filtrá por categoría (Damas, Caballeros, Mixto), estado, año y mes. Por defecto se muestra el año en curso.</>,
      <>Los torneos se agrupan por estado: primero los que están <strong>En curso</strong>, después los <strong>Pendientes</strong> y al final los <strong>Finalizados</strong>.</>,
      <>Cada tarjeta muestra fechas, cantidad de parejas, inscripción, premio y, si terminó, la pareja campeona.</>,
      <>Tocá un torneo para abrirlo.</>,
    ],
    tips: [
      <>Si no encontrás un torneo, revisá los filtros (por ejemplo, el año) o tocá “Ver todos”.</>,
    ],
  },
  {
    id: 'torneo',
    titulo: 'Un torneo',
    que: <>La página de cada torneo, con sus pestañas <strong>Zonas</strong>, <strong>Partidos</strong> y <strong>Playoff</strong>.</>,
    para: <>Saber en qué zona estás, contra quién y cuándo jugás, cómo vienen las posiciones y cómo se arma el cuadro hasta el campeón.</>,
    pasos: [
      <>Escribí tu nombre o apellido en <strong>“¿Dónde juego?”</strong>: se resalta tu pareja en las zonas y el playoff, y en Partidos quedan solo los tuyos.</>,
      <><strong>Zonas:</strong> las parejas de cada zona con su tabla de posiciones.</>,
      <><strong>Partidos:</strong> todos los partidos con día, hora, cancha y resultado.</>,
      <><strong>Playoff:</strong> el cuadro de cruces; se completa solo a medida que terminan las zonas y se cargan los resultados.</>,
      <>Con <strong>Compartir</strong> o copiando el link se lo mandás a tu pareja o al grupo.</>,
    ],
    tips: [
      <>Arriba ves la categoría, el estado, las fechas, la inscripción, el premio y el formato de partido de cada instancia.</>,
      <>Los horarios pueden cambiar: antes de ir, chequeá la página.</>,
    ],
  },
  {
    id: 'calendario',
    titulo: 'Calendario',
    que: <>Todos los partidos de los torneos de NODO, juntos, por día y horario: los que vienen, los que se están jugando y los resultados.</>,
    para: <>Ver qué se juega cada día en el club y encontrar rápido cuándo te toca, aunque estés en más de un torneo.</>,
    pasos: [
      <>Arranca en el día de hoy. Movete con las flechas por semana, volvé con <strong>Hoy</strong> o abrí la vista <strong>Mes</strong> para elegir un día.</>,
      <>Escribí tu nombre en <strong>“¿Cuándo juego?”</strong> para ver solo tus partidos.</>,
      <>Filtrá por categoría o tildá <strong>Ocultar finalizados</strong> para ver solo lo que falta.</>,
      <>Tocá un partido para ir a su torneo.</>,
    ],
    tips: [
      <>Se actualiza solo cada minuto mientras la tenés abierta.</>,
    ],
  },
  {
    id: 'estadisticas',
    titulo: 'Estadísticas',
    que: <>Los números de los torneos publicados: cantidad de torneos, parejas y jugadores, y los rankings por jugador.</>,
    para: <>Ver quiénes son los que más ganan, los que más juegan y cómo vas en el ranking de puntos.</>,
    pasos: [
      <>Filtrá por categoría, estado, año (arranca en el año actual) y mes.</>,
      <>Mirá los rankings: <strong>Campeones</strong>, <strong>Más participaciones</strong> y <strong>Ranking pts</strong>.</>,
      <>Buscá tu nombre para encontrarte en los rankings y tocá un jugador para ver en qué torneos sumó.</>,
      <>Compartí cualquier ranking como imagen con su botón.</>,
    ],
    tips: [
      <>Ranking pts: {textoReglas()}. A igual puntaje, va primero el que jugó menos torneos.</>,
    ],
  },
  ...(MOSTRAR_CATEGORIAS_PUBLICAS ? [{
    id: 'categorias',
    titulo: 'Categorías',
    que: <>Los jugadores de NODO agrupados por su categoría actual.</>,
    para: <>Saber en qué categoría está cada jugador para armar parejas que puedan anotarse en cada torneo.</>,
    pasos: [<>Buscá un nombre o recorré las tarjetas por categoría.</>],
  }] : []),
  {
    id: 'ascensos',
    titulo: 'Ascensos',
    que: <>Los ascensos{MOSTRAR_RECATEGORIZACIONES_PUBLICAS ? ' y recategorizaciones' : ''} de categoría que publicó NODO en cada corte (cada 2 o 3 meses), del más nuevo al más viejo.</>,
    para: <>Enterarte de quiénes subieron de categoría y tener el historial de cada jugador.</>,
    pasos: [
      <>El último corte se muestra abierto; tocá cualquier otro para desplegarlo.</>,
      <>En cada corte, los jugadores se agrupan por su categoría nueva, con la anterior al lado (por ejemplo, 7ma → 6ta).</>,
      <>Escribí tu nombre o apellido: aparece tu <strong>historial</strong> con todos tus cambios de categoría.</>,
      <>Filtrá por <strong>Damas</strong> o <strong>Caballeros</strong> y compartí la imagen de cada categoría con su botón.</>,
    ],
    tips: [
      <>La categoría vigente de cada jugador está en la pestaña <strong>Categorías</strong>.</>,
    ],
  },
]

/** pestaña que se está mirando en la página pública, según el link */
export const pestanaPublica = () => {
  const h = window.location.hash
  return h.startsWith('#/torneo/') ? 'torneo' : h.startsWith('#/calendario') ? 'calendario'
    : h.startsWith('#/estadisticas') ? 'estadisticas' : h.startsWith('#/categorias') ? 'categorias' : h.startsWith('#/ascensos') ? 'ascensos' : 'torneos'
}
