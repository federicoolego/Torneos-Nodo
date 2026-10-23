import type { SeccionAyuda } from '../Ayuda'
import { textoReglas } from '../../lib/puntos'

/** Instructivo del panel de organizadores: una sección por pestaña (los id coinciden con las pestañas del admin) */
export const AYUDA_ADMIN: SeccionAyuda[] = [
  {
    id: 'torneos',
    titulo: 'Torneos',
    que: <>La lista de todos los torneos del club, publicados o no. Cada torneo es <strong>una categoría</strong> (por ejemplo, “Suma 13 Damas”).</>,
    para: <>Crear, armar y seguir cada torneo de punta a punta: datos, parejas, zonas, playoff, resultados, imágenes para WhatsApp y publicación en la página pública.</>,
    pasos: [
      <><strong>Nuevo torneo</strong> (o <strong>Duplicar</strong> uno existente para otra categoría y cambiarle nombre y parejas). Se guarda en la base recién cuando completás los datos obligatorios.</>,
      <><strong>Torneo:</strong> nombre, categoría (Damas, Caballeros o Mixto), fechas y, si querés, inscripción, premio, formato de partido por instancia y una observación.</>,
      <><strong>Parejas:</strong> de a una (mínimo 6, máximo 24). Cada jugador se busca en el padrón; si no está, “Agregar … como jugador nuevo”. Marcá los días y horarios en que pueden jugar (Todo el día / Solo en… / No puede) y lo que no entre ahí va en la nota.</>,
      <><strong>Zonas:</strong> sorteo automático, acomodás a mano y le ponés día, hora y cancha a cada partido. Si se juegan varios torneos el mismo fin de semana, conviene hacerlo desde <strong>Armar fecha</strong>.</>,
      <><strong>Playoff:</strong> el cuadro se arma solo con los clasificados (1° Zona A vs 2° Zona B…); le ponés día y hora a la primera ronda.</>,
      <><strong>Partidos:</strong> cargás los resultados; las posiciones y los cruces se completan solos. Los partidos que faltan se pueden reprogramar (a una fecha y hora futuras). Desde acá también sale el cronograma en PDF.</>,
      <><strong>Imágenes:</strong> zonas y playoff listas para WhatsApp, con nombres y resultados a medida que se cargan (también con el botón verde de abajo a la derecha).</>,
      <><strong>Publicar:</strong> con las zonas armadas, el botón “Publicar” (arriba, en cada torneo) lo muestra en la página pública, que se actualiza sola con horarios y resultados.</>,
    ],
    tips: [
      <>El estado (Pendiente, En curso, Finalizado) se calcula solo; “Cancelar torneo” es manual. Eliminar un torneo es definitivo.</>,
      <>Una zona con resultados ya no se puede modificar, y con el primer resultado de playoff los cruces quedan fijos.</>,
      <>Cada instancia tiene su formato (mejor de 3, mejor de 3 con super tiebreak a 11, americano a 7 o a 9) y con eso se validan los resultados.</>,
      <>Zonas de 3: posiciones por partidos ganados, después resultado entre ellos, diferencia de sets y de games. Si el empate es total, se ordena a mano.</>,
      <><strong>Importar torneos</strong> carga un .sql (por ejemplo, el armado desde el Excel de la fecha) con torneos, parejas, zonas y horarios. Muestra antes qué va a cargar, no pisa torneos existentes salvo que tildes “Actualizar” y nunca toca resultados.</>,
      <>Todo se guarda en la base: arriba a la derecha de cada torneo ves si los cambios ya quedaron guardados.</>,
    ],
  },
  {
    id: 'fechas',
    titulo: 'Armar fecha',
    que: <>Un armador automático que junta los torneos que se juegan el mismo fin de semana, en las mismas canchas.</>,
    para: <>Armar zonas y horarios de todos los torneos de la fecha juntos, sin choques: nadie juega dos partidos a la vez (aunque esté en dos categorías) y se respetan los horarios pedidos por las parejas.</>,
    pasos: [
      <><strong>Nueva fecha</strong> y le ponés un nombre.</>,
      <><strong>1. Torneos y canchas:</strong> elegís los torneos (ya creados, con sus parejas), las canchas disponibles, el horario de cada día (por defecto viernes desde las 18, sábado desde las 10, domingo desde las 12) y la duración de los partidos (45′ zonas, octavos y cuartos; 1 h semi y final), el descanso entre partidos y el margen antes del playoff.</>,
      <><strong>2. Horarios de las parejas:</strong> repasás los días y horarios de todas juntas y corregís tocando cada una. Las que tienen el horario escrito en texto se pasan solas con “Interpretar”.</>,
      <><strong>3. Zonas:</strong> “Armar zonas por horarios” junta a las parejas que pueden jugar en los mismos horarios. Podés intercambiar parejas entre zonas.</>,
      <><strong>4. Grilla de partidos:</strong> “Armar horarios” reparte todos los partidos (zonas y playoff) por día y cancha. Lo que no se pudo respetar queda marcado y lo decidís vos: tocás el partido, lo cambiás y lo fijás.</>,
      <><strong>Aplicar a los torneos:</strong> carga día, hora y cancha en cada torneo. Después seguís como siempre: publicar, imágenes, Calendario y resultados.</>,
    ],
    tips: [
      <>Colores de la grilla: <strong>rojo</strong> = choque (un jugador en dos partidos a la vez) · <strong>ámbar</strong> = no se respetó un pedido de horario.</>,
      <>“Volver a armar” mantiene los partidos que fijaste a mano.</>,
      <>Convive con el armado tradicional: un torneo se puede seguir armando por su cuenta desde la pestaña Torneos.</>,
    ],
  },
  {
    id: 'calendario',
    titulo: 'Calendario',
    que: <>El cronograma unificado de todos los torneos <strong>pendientes y en curso</strong> que tienen partidos sin resultado, ordenado por día y horario.</>,
    para: <>Ver la fecha completa de un vistazo, compartirla o imprimirla, y cargar los resultados en el orden en que se van jugando sin entrar torneo por torneo.</>,
    pasos: [
      <>Los torneos activos entran solos. Podés destildar alguno, <strong>sumar</strong> otro desde el desplegable y ordenarlos con las flechas (a igual horario, va primero el de arriba).</>,
      <>Compartí el cronograma en <strong>PDF</strong>, <strong>Imprimir</strong> o bajalo en <strong>Word</strong>.</>,
      <>En la lista de partidos elegí la vista <strong>Pendientes</strong>, <strong>Todos</strong> o <strong>Jugados</strong>, filtrá por día o buscá un jugador.</>,
      <>Cargá el resultado en cada partido: se guarda en su torneo y actualiza posiciones, cruces y la página pública.</>,
    ],
    tips: [
      <>Avisa si hay más partidos a la vez que canchas o un jugador en dos partidos que se pisan.</>,
      <>Si dos personas cargan resultados a la vez, la lista se refresca sola cada minuto; con “Traer cambios” lo ves al instante.</>,
    ],
  },
  {
    id: 'estadisticas',
    titulo: 'Estadísticas',
    que: <>Los números de los torneos del club: KPIs (torneos, parejas, jugadores distintos, publicados) y rankings por jugador.</>,
    para: <>Saber cuánto se juega, quién más gana y quién más participa, y compartir los rankings como imagen por WhatsApp.</>,
    pasos: [
      <>Filtrá por categoría del jugador, categoría del torneo, estado, año (arranca en el año actual), mes y publicación.</>,
      <>Mirá los rankings: <strong>Campeones</strong>, <strong>Más participaciones</strong> y <strong>Ranking pts</strong>. Tocá un jugador para ver el detalle de sus torneos.</>,
      <>Buscá un nombre para encontrarlo en los rankings.</>,
      <>Con el botón de compartir de cada ranking generás la imagen con los filtros aplicados.</>,
    ],
    tips: [
      <>Ranking pts: {textoReglas()}. A igual puntaje, primero el que jugó menos torneos.</>,
      <>En el admin cuentan todos los torneos; en la página pública, solo los publicados.</>,
    ],
  },
  {
    id: 'jugadores',
    titulo: 'Jugadores',
    que: <>El <strong>padrón único</strong> de jugadores de NODO, el mismo que se usa al inscribir parejas.</>,
    para: <>Que cada persona esté cargada una sola vez, con su nombre bien escrito y su categoría, así las estadísticas y los rankings salen bien.</>,
    pasos: [
      <><strong>Nuevo jugador</strong> para darlo de alta (también se agregan al inscribir parejas).</>,
      <>Con ✏️ corregís nombre y categoría: al renombrar, el cambio se aplica en todos sus torneos.</>,
      <>Filtro <strong>Posibles duplicados</strong>: mismo nombre ignorando tildes y mayúsculas. Usá “Unificar” para dejarlo en uno solo (pasa sus torneos al que queda).</>,
      <>Filtro <strong>Sin torneos</strong>: candidatos a eliminar. Solo se puede eliminar a quien no jugó ningún torneo.</>,
    ],
    tips: [
      <>En la base los nombres quedan en MAYÚSCULAS; en la app se muestran con mayúscula inicial.</>,
      <>La búsqueda no distingue mayúsculas ni tildes.</>,
    ],
  },
  {
    id: 'categorias',
    titulo: 'Categorías',
    que: <>Todos los jugadores del padrón agrupados por su categoría (5ta a 8va Damas; 3era a 8va Caballeros), más los que todavía no tienen.</>,
    para: <>Mantener la categoría de cada jugador al día. Se usa para <strong>validar las parejas al inscribirlas</strong> (por ejemplo, dos 7ma no pueden anotarse en un Suma 15) y para filtrar las estadísticas.</>,
    pasos: [
      <>Buscá al jugador por nombre o apellido, o recorré las tarjetas por categoría.</>,
      <>Elegí su categoría: se guarda al instante.</>,
      <>Empezá por la tarjeta <strong>Sin categoría</strong> para completar a los que faltan.</>,
      <>Compartí una categoría o todas juntas como imagen; plegá o desplegá las tarjetas para moverte más rápido.</>,
    ],
    tips: [
      <>Para cambios masivos (ascensos y recategorizaciones del corte), usá la pestaña <strong>Ascensos</strong>: aplica todo junto y genera las imágenes.</>,
    ],
  },
  {
    id: 'ascensos',
    titulo: 'Ascensos',
    que: <>Las <strong>tandas</strong> de cambios de categoría: cada tanda junta los ascensos y recategorizaciones de un corte (cada 2 o 3 meses).</>,
    para: <>Preparar los cambios con calma, aplicarlos a todos los jugadores juntos y comunicarlos por WhatsApp con una imagen por categoría.</>,
    pasos: [
      <><strong>Nueva tanda</strong> con nombre y fecha de vigencia.</>,
      <>En <strong>Agregar cambio de categoría</strong> buscás al jugador y elegís su categoría nueva. Si sube, es <strong>ascenso</strong>; cualquier otro cambio es <strong>recategorización</strong>.</>,
      <>Mientras la tanda está en <strong>borrador</strong> no cambia nada en el padrón: podés sumar, quitar y corregir.</>,
      <><strong>Aplicar tanda:</strong> actualiza la categoría de todos los jugadores de la tanda de una vez.</>,
      <>Compartí las imágenes: de felicitaciones para los ascensos e informativa para las recategorizaciones, una por categoría.</>,
      <><strong>Publicar</strong> (solo tandas aplicadas): la tanda pasa a verse en la pestaña <strong>Ascensos</strong> de la página pública, como historial para los jugadores. <strong>Despublicar</strong> la oculta.</>,
    ],
    tips: [
      <><strong>Revertir</strong> devuelve a los jugadores a su categoría anterior y deja la tanda en borrador (si estaba publicada, deja de verse en la página pública).</>,
    ],
  },
]
