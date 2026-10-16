// PDF del cronograma de partidos (A4), generado en el navegador para poder compartirlo.
// Un torneo (vertical) o varios torneos juntos (apaisado, con columna "Torneo").
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { diaLargo, formatoPesos, rangoFechas, type Categoria } from './torneo'
import { encabezadoVarios, filasCronograma, filasCronogramaVarios, type Colores, type FilaCronograma } from './cronograma'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const tituloDia = (f: string) => `${diaLargo(f)} de ${MESES[Number(f.slice(5, 7)) - 1]}`
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

interface Doc { titulo: string; datos: string; observacion: string; filas: FilaCronograma[]; conTorneo: boolean; apaisado: boolean; pie: string }

function generar(d: Doc, logo: string | null, colores: Colores): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: d.apaisado ? 'landscape' : 'portrait' })
  const M = 12
  const ancho = doc.internal.pageSize.getWidth()
  const alto = doc.internal.pageSize.getHeight()
  const { filas, conTorneo } = d
  const conSede = filas.some((f) => f.sede)

  // encabezado
  let x = M
  if (logo) {
    doc.setFillColor(...rgb(colores.fondoLogo ?? colores.oscuro))
    doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.2)
    doc.roundedRect(M, M, 20, 20, 2, 2, 'FD')
    doc.addImage(logo, 'PNG', M + 1, M + 1, 18, 18)
    x = M + 25
  }
  doc.setTextColor(...rgb(colores.oscuro))
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
  doc.text(d.titulo, x, M + 7, { maxWidth: ancho - x - M })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40)
  doc.text(d.datos, x, M + 13.5, { maxWidth: ancho - x - M })
  if (d.observacion) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
    doc.text(d.observacion, x, M + 18.5, { maxWidth: ancho - x - M })
  }
  doc.setDrawColor(...rgb(colores.oscuro)); doc.setLineWidth(0.8)
  doc.line(M, M + 23, ancho - M, M + 23)
  let y = M + 30

  // columnas
  type Col = { cab: string; valor: (f: FilaCronograma) => string; estilo?: Record<string, unknown> }
  const cols: Col[] = [
    { cab: 'Hora', valor: (f) => f.hora || '—', estilo: { cellWidth: 15, fontStyle: 'bold', fontSize: 11, halign: 'center' } },
    ...(conSede ? [{ cab: 'Complejo', valor: (f: FilaCronograma) => f.sede || '—', estilo: { cellWidth: 26, fontSize: 9 } }] : []),
    ...(conTorneo ? [{ cab: 'Torneo', valor: (f: FilaCronograma) => f.torneo ?? '', estilo: { cellWidth: 34, fontStyle: 'bold', fontSize: 8.5, textColor: rgb(colores.oscuro) } }] : []),
    { cab: 'Partido', valor: (f) => f.etapa, estilo: { cellWidth: 28, fontStyle: 'bold', fontSize: 8.5 } },
    { cab: 'Pareja', valor: (f) => f.a },
    { cab: '', valor: () => 'vs', estilo: { cellWidth: 8, halign: 'center', textColor: [120, 120, 120], fontSize: 8 } },
    { cab: 'Pareja', valor: (f) => f.b },
    { cab: 'Resultado', valor: (f) => f.resultado, estilo: { cellWidth: conTorneo ? 40 : conSede ? 32 : 36, fillColor: [255, 255, 255] } },
  ]

  const dias = [...new Set(filas.map((f) => f.fecha))]
  for (const dia of dias) {
    const del = filas.filter((f) => f.fecha === dia)
    if (y > alto - 35) { doc.addPage(); y = M + 6 }
    // título del día
    doc.setFillColor(...rgb(colores.acento)); doc.rect(M, y - 4.2, 1.6, 5.6, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...rgb(colores.oscuro))
    const t = dia ? tituloDia(dia) : 'Sin día asignado'
    doc.text(t, M + 3.5, y)
    const anchoT = doc.getTextWidth(t)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110)
    doc.text(`${del.length} partido${del.length === 1 ? '' : 's'}`, M + 5.5 + anchoT, y)

    autoTable(doc, {
      startY: y + 2.5,
      margin: { left: M, right: M },
      head: [cols.map((c) => c.cab)],
      body: del.map((f) => cols.map((c) => c.valor(f))),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: [20, 20, 20], lineColor: [150, 150, 150], lineWidth: 0.2, valign: 'middle', minCellHeight: 10 },
      headStyles: { fillColor: rgb(colores.oscuro), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, minCellHeight: 7 },
      alternateRowStyles: { fillColor: rgb(colores.suave) },
      columnStyles: Object.fromEntries(cols.map((c, i) => [i, c.estilo ?? {}]).filter(([, e]) => Object.keys(e as object).length)),
    })
    // @ts-expect-error lastAutoTable lo agrega el plugin
    y = (doc.lastAutoTable.finalY as number) + 10
  }
  if (!filas.length) { doc.setFontSize(11); doc.text('Todavía no hay partidos: armá las zonas.', M, y) }

  // pie en cada hoja
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
    doc.text(d.pie, M, alto - 7)
    doc.text(`Hoja ${i} de ${n}`, ancho - M, alto - 7, { align: 'right' })
    // marca de agua
    doc.setFontSize(7.5); doc.setTextColor(160, 160, 160)
    doc.text('Desarrollado por Federico Olego', ancho / 2, alto - 3, { align: 'center' })
  }
  return doc.output('blob')
}

export function pdfCronograma(cat: Categoria, logo: string | null, colores: Colores): Blob {
  const datos = [rangoFechas(cat.fechaInicio, cat.fechaFin), cat.inscripcion ? `Inscripción ${formatoPesos(cat.inscripcion)} por jugador` : '', cat.premio ? `Premio: ${cat.premio}` : '']
    .filter(Boolean).join('  ·  ')
  return generar({ titulo: cat.torneo || 'Torneo', datos, observacion: cat.observacion, filas: filasCronograma(cat), conTorneo: false, apaisado: false, pie: `Cronograma de partidos · ${cat.torneo}` }, logo, colores)
}

/** Varios torneos juntos, en orden cronológico (A4 apaisado) */
export function pdfCronogramaVarios(cats: Categoria[], logo: string | null, colores: Colores): Blob {
  const e = encabezadoVarios(cats)
  const datos = [e.rango, `${e.cantidad} torneo${e.cantidad === 1 ? '' : 's'}: ${e.nombres}`].filter(Boolean).join('  ·  ')
  return generar({ titulo: e.titulo, datos, observacion: e.observacion, filas: filasCronogramaVarios(cats), conTorneo: true, apaisado: true, pie: `Cronograma de partidos · ${e.titulo}` }, logo, colores)
}
