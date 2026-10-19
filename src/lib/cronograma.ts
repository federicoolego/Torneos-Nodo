// Cronograma imprimible de partidos (orden cronológico, con columna para anotar resultados).
// Sirve para un torneo o para varios juntos (todos los partidos de los torneos elegidos, ordenados por día y hora).
import { claveJugador, diaCorto, diaLargo, formatoPesos, nombrePropio, rangoFechas, type Categoria, type Horario } from './torneo'
import { esAmericano, resolverTorneo, textoResultado } from './resultados'

export interface FilaCronograma {
  fecha: string          // '' = sin fecha
  hora: string
  sede: string
  etapa: string          // "Zona A · 1 v 4", "Cuartos 1", "Final"
  a: string
  b: string
  orden: number          // para desempatar a igual horario
  resultado: string      // "6-4 3-6 10-8" si ya se cargó (vacío para anotar a mano)
  /** nombre del torneo (solo en el cronograma de varios torneos) */
  torneo?: string
  /** duración estimada en minutos (americano: 45 · al mejor de 3: 60), para detectar superposiciones */
  minutos: number
  /** jugadores ya conocidos del partido (clave normalizada), para detectar a alguien en dos partidos a la vez */
  jugadores: string[]
  /** ya se jugó (no cuenta para las superposiciones) */
  jugado: boolean
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const tituloDia = (f: string) => `${diaLargo(f)} de ${MESES[Number(f.slice(5, 7)) - 1]}`

const ordenar = (x: FilaCronograma, y: FilaCronograma) =>
  (x.fecha ? 0 : 1) - (y.fecha ? 0 : 1) || x.fecha.localeCompare(y.fecha) ||
  (x.hora ? 0 : 1) - (y.hora ? 0 : 1) || x.hora.localeCompare(y.hora) || x.orden - y.orden

export function filasCronograma(cat: Categoria): FilaCronograma[] {
  const out: FilaCronograma[] = []
  // NODO tiene una sola sede: en la columna va la cancha (si está asignada)
  const h = (x?: Horario) => ({ fecha: x?.fecha ?? '', hora: x?.hora ?? '', sede: x?.cancha ? `Cancha ${x.cancha}` : x?.sede ?? '' })
  const jugadores = new Map(cat.parejas.map((p) => [p.id, [p.jugador1 ?? '', p.jugador2 ?? ''].filter(Boolean).map(claveJugador)]))
  const de = (...ids: (string | null)[]) => ids.flatMap((id) => (id ? jugadores.get(id) ?? [] : []))
  // nombres reales a medida que se conocen (ganadores de zona, clasificados, cruces) y resultados cargados
  const res = resolverTorneo(cat)
  let orden = 0
  for (const z of res.zonas) {
    for (const p of z.partidos) {
      out.push({ ...h(cat.horariosZona[p.key]), etapa: p.titulo, a: p.etiquetaA, b: p.etiquetaB, orden: orden++, resultado: p.estado === 'jugado' ? textoResultado(p.resultado) : '',
        minutos: esAmericano(p.formato) ? 45 : 60, jugadores: de(p.a, p.b), jugado: p.estado === 'jugado' })
    }
  }
  for (const r of res.playoff ?? []) {
    for (const p of r) {
      if (p.bye) continue
      out.push({ ...h(cat.horariosPlayoff[p.key]), etapa: p.titulo, a: p.etiquetaA, b: p.etiquetaB, orden: 1000 + orden++, resultado: p.estado === 'jugado' ? textoResultado(p.resultado) : '',
        minutos: esAmericano(p.formato) ? 45 : 60, jugadores: de(p.a, p.b), jugado: p.estado === 'jugado' })
    }
  }
  return out.sort(ordenar)
}

/** Todos los partidos de varios torneos, en orden cronológico (a igual horario, en el orden en que se eligieron los torneos) */
export function filasCronogramaVarios(cats: Categoria[]): FilaCronograma[] {
  const { corto } = nombresVarios(cats)
  return cats.flatMap((c, i) => filasCronograma(c).map((f) => ({ ...f, torneo: corto(c), orden: i * 100000 + f.orden }))).sort(ordenar)
}

/**
 * Título del cronograma de varios torneos. Si todos los nombres terminan igual
 * ("8va Damas - Fecha 5", "7ma Damas - Fecha 5") ese final es el título y en la tabla va el resto ("8va Damas").
 */
export function nombresVarios(cats: Categoria[]): { titulo: string; corto: (c: Categoria) => string } {
  const partes = cats.map((c) => (c.torneo || 'Torneo').split(' - '))
  const ultimo = partes[0]?.[partes[0].length - 1] ?? ''
  const comun = cats.length > 1 && partes.every((p) => p.length > 1 && p[p.length - 1] === ultimo)
  if (!comun) return { titulo: 'Cronograma de partidos', corto: (c) => c.torneo || 'Torneo' }
  return { titulo: ultimo, corto: (c) => { const p = (c.torneo || 'Torneo').split(' - '); return p.slice(0, -1).join(' - ') } }
}

// ------------------------------------------------------------------ superposiciones (varios torneos en las mismas canchas)

const minutosDe = (f: FilaCronograma) => new Date(`${f.fecha}T${f.hora}:00`).getTime() / 60000
const etiqueta = (f: FilaCronograma) => `${f.torneo ? `${f.torneo} · ` : ''}${f.etapa}`

/**
 * Avisos de horarios que no cierran, con la duración estimada de cada partido:
 * más partidos a la vez que canchas, o un mismo jugador en dos partidos que se pisan.
 * Solo cuenta partidos con día y hora que todavía no se jugaron.
 */
export function superposiciones(filas: FilaCronograma[], canchas: number): string[] {
  const vivos = filas.filter((f) => f.fecha && f.hora && !f.jugado)
  const avisos: string[] = []
  // canchas: en el inicio de cada partido, cuántos se están jugando
  const vistos = new Set<string>()
  for (const f of vivos) {
    const t = minutosDe(f)
    const k = `${f.fecha} ${f.hora}`
    if (vistos.has(k)) continue
    vistos.add(k)
    const enJuego = vivos.filter((g) => minutosDe(g) <= t && t < minutosDe(g) + g.minutos)
    if (enJuego.length > canchas) {
      avisos.push(`${diaCorto(f.fecha)} ${f.hora}: ${enJuego.length} partidos a la vez y hay ${canchas} canchas (${enJuego.map((g) => `${etiqueta(g)} ${g.hora}`).join(' · ')}).`)
    }

  }
  // jugadores en dos partidos que se pisan (y dos partidos en la misma cancha)
  for (let i = 0; i < vivos.length; i++) {
    for (let j = i + 1; j < vivos.length; j++) {
      const a = vivos[i], b = vivos[j]
      if (a.fecha !== b.fecha) continue
      const ta = minutosDe(a), tb = minutosDe(b)
      if (!(ta < tb + b.minutos && tb < ta + a.minutos)) continue
      if (a.sede && a.sede === b.sede) avisos.push(`${diaCorto(a.fecha)}: ${a.sede} con dos partidos a la vez (${etiqueta(a)} ${a.hora} · ${etiqueta(b)} ${b.hora}).`)
      const ambos = a.jugadores.filter((x) => b.jugadores.includes(x))
      for (const x of new Set(ambos)) {
        avisos.push(`${nombrePropio(x)} juega ${etiqueta(a)} (${a.hora}) y ${etiqueta(b)} (${b.hora}) el ${diaCorto(a.fecha)}.`)
      }
    }
  }
  return avisos
}

// ------------------------------------------------------------------ documento HTML (imprimir / Word / vista previa)

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type Colores = { oscuro: string; acento: string; suave: string; fondoLogo?: string }

interface Documento {
  titulo: string
  /** línea de datos debajo del título (HTML ya escapado) */
  datos: string
  observacion: string
  filas: FilaCronograma[]
  /** columna "Torneo" (cronograma de varios torneos) */
  conTorneo: boolean
  /** A4 apaisado */
  apaisado: boolean
  pie: string
}

function documentoHtml(d: Documento, logo: string | null, colores: Colores): string {
  const { filas, conTorneo } = d
  const conSede = filas.some((f) => f.sede)
  const dias = [...new Set(filas.map((f) => f.fecha))]
  const tablas = dias.map((dia) => {
    const del = filas.filter((f) => f.fecha === dia)
    return `
    <h2>${dia ? esc(tituloDia(dia)) : 'Sin día asignado'} <span class="cant">${del.length} partido${del.length === 1 ? '' : 's'}</span></h2>
    <table>
      <colgroup><col class="c-hora">${conSede ? '<col class="c-sede">' : ''}${conTorneo ? '<col class="c-torneo">' : ''}<col class="c-etapa"><col class="c-par"><col class="c-vs"><col class="c-par"><col class="c-res"></colgroup>
      <thead><tr><th>Hora</th>${conSede ? '<th>Cancha</th>' : ''}${conTorneo ? '<th>Torneo</th>' : ''}<th>Partido</th><th>Pareja</th><th></th><th>Pareja</th><th>Resultado</th></tr></thead>
      <tbody>
        ${del.map((f) => `<tr>
          <td class="hora">${esc(f.hora || '—')}</td>${conSede ? `<td>${esc(f.sede || '—')}</td>` : ''}${conTorneo ? `<td class="torneo">${esc(f.torneo ?? '')}</td>` : ''}
          <td class="etapa">${esc(f.etapa)}</td><td>${esc(f.a)}</td><td class="vs">vs</td><td>${esc(f.b)}</td><td class="res">${esc(f.resultado)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
  }).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Partidos · ${esc(d.titulo)}</title>
<style>
  @page { size: A4 ${d.apaisado ? 'landscape' : 'portrait'}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; margin: 0; padding: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${colores.oscuro}; padding-bottom: 10px; margin-bottom: 6px; }
  header img { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; background: ${colores.fondoLogo ?? colores.oscuro}; border: 1px solid #ddd; }
  h1 { font-size: 20pt; margin: 0; color: ${colores.oscuro}; }
  .datos { margin: 2px 0 0; font-size: 11pt; color: #333; }
  .obs { margin: 6px 0 0; font-size: 10pt; color: #444; font-style: italic; }
  h2 { font-size: 13pt; margin: 18px 0 6px; color: ${colores.oscuro}; border-left: 6px solid ${colores.acento}; padding-left: 8px; }
  h2 .cant { font-size: 9pt; font-weight: normal; color: #666; margin-left: 6px; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { background: ${colores.oscuro}; color: #fff; font-size: 9pt; text-transform: uppercase; letter-spacing: .03em; padding: 6px 6px; text-align: left; }
  td { border: 1px solid #999; padding: 8px 6px; vertical-align: middle; font-size: 10.5pt; }
  tbody tr:nth-child(even) td { background: ${colores.suave}; }
  td.hora { font-weight: bold; font-size: 12pt; white-space: nowrap; text-align: center; }
  td.etapa { font-weight: bold; white-space: nowrap; font-size: 9.5pt; }
  td.torneo { font-weight: bold; font-size: 9.5pt; color: ${colores.oscuro}; }
  td.vs { text-align: center; color: #777; font-size: 9pt; }
  td.res { background: #fff !important; font-weight: bold; text-align: center; }
  ${conTorneo
    ? 'col.c-hora { width: 7%; } col.c-sede { width: 10%; } col.c-torneo { width: 13%; } col.c-etapa { width: 12%; } col.c-vs { width: 3%; } col.c-res { width: 15%; }'
    : 'col.c-hora { width: 9%; } col.c-sede { width: 12%; } col.c-etapa { width: 13%; } col.c-vs { width: 4%; } col.c-res { width: 20%; }'}
  footer { margin-top: 14px; font-size: 8.5pt; color: #777; }
  .marca { margin-top: 10px; text-align: center; font-size: 8pt; color: #aaa; }
  .acciones { margin: 0 0 12px; }
  .acciones button { font-size: 12pt; padding: 8px 14px; margin-right: 8px; cursor: pointer; }
  @media print { .acciones { display: none; } body { padding: 0; } }
</style></head>
<body>
  <div class="acciones"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
  <header>
    ${logo ? `<img src="${logo}" alt="">` : ''}
    <div>
      <h1>${esc(d.titulo)}</h1>
      <p class="datos">${d.datos}</p>
      ${d.observacion ? `<p class="obs">${esc(d.observacion)}</p>` : ''}
    </div>
  </header>
  ${filas.length ? tablas : '<p>Todavía no hay partidos: armá las zonas.</p>'}
  <footer>${esc(d.pie)} · orden cronológico · generado el ${new Date().toLocaleString('es-AR', { hour12: false })}</footer>
  <p class="marca">Desarrollado por Federico Olego</p>
</body></html>`
}

/**
 * Documento HTML listo para imprimir (A4) o abrir en Word.
 * `logo` = URL (o data URL) del logo; se omite si no hay.
 */
export function htmlCronograma(cat: Categoria, logo: string | null, colores: Colores): string {
  const datos = [
    rangoFechas(cat.fechaInicio, cat.fechaFin) && `<strong>${esc(rangoFechas(cat.fechaInicio, cat.fechaFin))}</strong>`,
    cat.inscripcion && `Inscripción ${esc(formatoPesos(cat.inscripcion))} por jugador`,
    cat.premio && `Premio: ${esc(cat.premio)}`,
  ].filter(Boolean).join(' · ')
  return documentoHtml({ titulo: cat.torneo || 'Torneo', datos, observacion: cat.observacion, filas: filasCronograma(cat), conTorneo: false, apaisado: false, pie: 'Cronograma de partidos' }, logo, colores)
}

/** Datos del encabezado del cronograma de varios torneos */
export function encabezadoVarios(cats: Categoria[]) {
  const { titulo, corto } = nombresVarios(cats)
  const inicios = cats.map((c) => c.fechaInicio).filter(Boolean).sort()
  const fines = cats.map((c) => c.fechaFin || c.fechaInicio).filter(Boolean).sort()
  const rango = inicios.length ? rangoFechas(inicios[0], fines[fines.length - 1] ?? inicios[0]) : ''
  const nombres = cats.map(corto).join(', ')
  const obs = cats.map((c) => c.observacion.trim())
  // la observación va solo si es la misma en todos (por ejemplo, "Fecha 5 · Liga NODO 2026…")
  const observacion = obs.every((o) => o && o === obs[0]) ? obs[0] : ''
  return { titulo, rango, nombres, observacion, cantidad: cats.length }
}

export function htmlCronogramaVarios(cats: Categoria[], logo: string | null, colores: Colores): string {
  const e = encabezadoVarios(cats)
  const datos = [e.rango && `<strong>${esc(e.rango)}</strong>`, `${e.cantidad} torneo${e.cantidad === 1 ? '' : 's'}: ${esc(e.nombres)}`].filter(Boolean).join(' · ')
  return documentoHtml({ titulo: e.titulo, datos, observacion: e.observacion, filas: filasCronogramaVarios(cats), conTorneo: true, apaisado: true, pie: `Cronograma de partidos · ${e.titulo}` }, logo, colores)
}

/** Versión para Word: el mismo documento, sin botones, con el formato que Word interpreta */
export function docWord(html: string): Blob {
  // Word ignora buena parte del CSS: bordes, fondos y anchos van en cada celda
  const oscuro = /th \{ background: (#[0-9A-Fa-f]{6})/.exec(html)?.[1] ?? '#000000'
  const apaisado = html.includes('size: A4 landscape')
  const borde = 'border:1px solid #999999;padding:6pt;font-size:10.5pt;'
  const limpio = html
    .replace(/<div class="acciones">[\s\S]*?<\/div>/, '')
    .replace('<html lang="es">', '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="es">')
    // hoja apaisada en Word
    .replace('</style>', apaisado ? '@page WordSection1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 34pt; } div.WordSection1 { page: WordSection1; }\n</style>' : '</style>')
    .replace('<body>', apaisado ? '<body><div class="WordSection1">' : '<body>')
    .replace('</body>', apaisado ? '</div></body>' : '</body>')
    .replace(/<colgroup>[\s\S]*?<\/colgroup>/g, '')
    .replace(/<table>/g, '<table border="1" cellspacing="0" cellpadding="6" width="100%" style="border-collapse:collapse;width:100%">')
    .replace(/<th>([^<]*)<\/th>/g, (_, t: string) => {
      const ancho = ({ Hora: '9%', Complejo: '12%', Cancha: '10%', Torneo: '14%', Partido: '15%', '': '5%', Resultado: '22%' } as Record<string, string>)[t] ?? ''
      return `<th${ancho ? ` width="${ancho}"` : ''} style="background:${oscuro};color:#ffffff;white-space:nowrap;${borde}">${t.toUpperCase()}</th>`
    })
    .replace(/<td class="hora">/g, `<td nowrap style="${borde}font-weight:bold;font-size:12pt;text-align:center;white-space:nowrap">`)
    .replace(/<td class="etapa">/g, `<td nowrap style="${borde}font-weight:bold;font-size:9.5pt;white-space:nowrap">`)
    .replace(/<td class="torneo">/g, `<td style="${borde}font-weight:bold;font-size:9.5pt">`)
    .replace(/<td class="vs">/g, `<td nowrap style="${borde}text-align:center;color:#777777">`)
    .replace(/<td class="res">/g, `<td style="${borde}">`)
    .replace(/<td>/g, `<td style="${borde}">`)
  return new Blob(['\ufeff', limpio], { type: 'application/msword' })
}

/** Logo como data URL PNG (para que se vea en la ventana de impresión) */
export async function logoPng(url: string): Promise<string | null> {
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}
