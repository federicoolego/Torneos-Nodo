// Genera las imágenes (PNG) de zonas y playoff dibujando en un <canvas>
import { LETRAS, diaLargo, formatoPesos, partidosDeZona, rangoFechas, rondasPlayoff, textoHorario, type Categoria } from './torneo'
import { resolverTorneo } from './resultados'

// Paleta de NODO (verde profundo del logo + lima de la pelota)
const C = {
  noche: '#042D29',
  verde: '#0F6B57',
  verdeSuave: '#DCEEE8',
  fondo: '#F2F6F4',
  lima: '#C8DC3C',
  texto: '#042D29',
  gris: '#5B6F6A',
  blanco: '#FFFFFF',
  linea: '#C9D6D2',
}
const ANCHO = 1080
const MARGEN = 56
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif'
const TEXTO = 'Barlow, Arial, sans-serif'

let logoCache: Promise<HTMLImageElement> | null = null
function logo(): Promise<HTMLImageElement> {
  logoCache ??= new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = mal
    img.src = `${import.meta.env.BASE_URL}logo-nodo.webp`
  })
  return logoCache
}

async function fuentes() {
  try {
    await Promise.all([
      document.fonts.load(`700 64px ${DISPLAY}`),
      document.fonts.load(`600 30px ${DISPLAY}`),
      document.fonts.load(`500 26px ${TEXTO}`),
      document.fonts.load(`600 26px ${TEXTO}`),
    ])
  } catch { /* se usan las de respaldo */ }
}

function lineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const palabras = texto.split(' ')
  const out: string[] = []
  let actual = ''
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && actual) { out.push(actual); actual = p } else actual = prueba
  }
  if (actual) out.push(actual)
  return out
}

function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto
  let t = texto
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke() }
}

// ------------------------------------------------------------------ íconos (trazos de lucide, 24×24)
type Nodo = ['path', string] | ['rect', number, number, number, number, number] | ['circle', number, number, number]
const ICONOS: Record<'trofeo' | 'premio' | 'calendario' | 'ticket' | 'usuarios' | 'subir' | 'flecha' | 'info', Nodo[]> = {
  subir: [['path', 'm5 12 7-7 7 7'], ['path', 'M12 19V5']],
  flecha: [['path', 'M5 12h14'], ['path', 'm12 5 7 7-7 7']],
  info: [['circle', 12, 12, 10], ['path', 'M12 16v-4'], ['path', 'M12 8h.01']],
  usuarios: [
    ['path', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'], ['circle', 9, 7, 4],
    ['path', 'M22 21v-2a4 4 0 0 0-3-3.87'], ['path', 'M16 3.13a4 4 0 0 1 0 7.75'],
  ],
  trofeo: [
    ['path', 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6'], ['path', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18'], ['path', 'M4 22h16'],
    ['path', 'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'],
    ['path', 'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'], ['path', 'M18 2H6v7a6 6 0 0 0 12 0V2Z'],
  ],
  premio: [['circle', 12, 8, 6], ['path', 'M15.477 12.89 17 22l-5-3-5 3 1.523-9.11']],
  calendario: [
    ['path', 'M8 2v4'], ['path', 'M16 2v4'], ['rect', 3, 4, 18, 18, 2], ['path', 'M3 10h18'],
    ['path', 'M8 14h.01'], ['path', 'M12 14h.01'], ['path', 'M16 14h.01'], ['path', 'M8 18h.01'], ['path', 'M12 18h.01'], ['path', 'M16 18h.01'],
  ],
  ticket: [
    ['path', 'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z'],
    ['path', 'M13 5v2'], ['path', 'M13 17v2'], ['path', 'M13 11v2'],
  ],
}

/** Dibuja un ícono de trazo de `tam` px con su esquina superior izquierda en (x, y) */
function icono(ctx: CanvasRenderingContext2D, nombre: keyof typeof ICONOS, x: number, y: number, tam: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(tam / 24, tam / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 2.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const n of ICONOS[nombre]) {
    if (n[0] === 'path') ctx.stroke(new Path2D(n[1]))
    else if (n[0] === 'rect') { ctx.beginPath(); ctx.roundRect(n[1], n[2], n[3], n[4], n[5]); ctx.stroke() }
    else { ctx.beginPath(); ctx.arc(n[1], n[2], n[3], 0, Math.PI * 2); ctx.stroke() }
  }
  ctx.restore()
}

/**
 * Encabezado con logo, nombre del torneo, fechas, inscripción, premio y el título de la imagen (arriba a la derecha).
 * Tamaños: nombre > fechas > inscripción = premio. Devuelve la altura usada
 */
function encabezado(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cat: Categoria, titulo: string, medir = false): number {
  const logoTam = 168
  const x = MARGEN + logoTam + 36
  const anchoTexto = ANCHO - x - MARGEN
  const sangria = 62   // lugar para los íconos
  // etiqueta ZONAS / PLAYOFF fija arriba a la derecha: el título no la invade
  ctx.font = `700 26px ${TEXTO}`
  const etiqueta = titulo.toUpperCase()
  const anchoEtiqueta = ctx.measureText(etiqueta).width + 36
  ctx.font = `700 64px ${DISPLAY}`
  const lt = lineas(ctx, cat.torneo || 'Torneo', anchoTexto - sangria - anchoEtiqueta - 20)
  const fechas = rangoFechas(cat.fechaInicio, cat.fechaFin)
  const insc = cat.inscripcion ? `Inscripción ${formatoPesos(cat.inscripcion)} por jugador` : ''
  const premio = cat.premio?.trim() ? `Premio: ${cat.premio.trim()}` : ''
  const alto = Math.max(logoTam + 2 * 44, 44 + lt.length * 64 + (fechas ? 60 : 0) + (insc ? 44 : 0) + (premio ? 44 : 0) + 30)
  if (medir) return alto
  ctx.fillStyle = C.noche
  ctx.fillRect(0, 0, ANCHO, alto)
  ctx.drawImage(img, MARGEN, (alto - logoTam) / 2, logoTam, logoTam)
  // etiqueta
  const ex = ANCHO - MARGEN + 24 - anchoEtiqueta
  rect(ctx, ex, 28, anchoEtiqueta, 44, 22, C.lima)
  ctx.fillStyle = C.noche
  ctx.font = `700 26px ${TEXTO}`
  ctx.fillText(etiqueta, ex + 18, 59)
  let y = 44 + 56
  // nombre del torneo con trofeo
  icono(ctx, 'trofeo', x, y - 50, 50, C.lima)
  ctx.fillStyle = C.blanco
  ctx.font = `700 64px ${DISPLAY}`
  for (const l of lt) { ctx.fillText(l, x + sangria, y); y += 64 }
  // fechas
  if (fechas) {
    icono(ctx, 'calendario', x + 6, y - 32, 38, C.lima)
    ctx.font = `600 48px ${DISPLAY}`
    ctx.fillStyle = C.blanco
    ctx.fillText(recortar(ctx, fechas, anchoTexto - sangria), x + sangria, y + 6)
    y += 6
  } else y -= 50
  // inscripción y premio: mismo tamaño
  for (const [texto, ic] of [[insc, 'ticket'], [premio, 'premio']] as const) {
    if (!texto) continue
    icono(ctx, ic, x + 10, y + 16, 30, C.lima)
    ctx.font = `600 30px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(recortar(ctx, texto, anchoTexto - sangria), x + sangria, y + 42)
    y += 44
  }
  return alto
}

/** Franjas de texto centrado debajo del encabezado (resumen de horarios, observación). Devuelve la altura */
function bandas(ctx: CanvasRenderingContext2D, y0: number, textos: { texto: string; fuerte?: boolean }[], medir = false): number {
  let y = y0
  for (const t of textos) {
    if (!t.texto.trim()) continue
    ctx.font = `${t.fuerte ? 600 : 500} 25px ${TEXTO}`
    const ls = t.texto.split('\n').flatMap((p) => lineas(ctx, p, ANCHO - 2 * MARGEN - 40))
    const alto = ls.length * 34 + 28
    if (!medir) {
      ctx.fillStyle = t.fuerte ? C.verdeSuave : C.blanco
      ctx.fillRect(0, y, ANCHO, alto)
      ctx.fillStyle = C.texto
      ctx.textAlign = 'center'
      ls.forEach((l, k) => ctx.fillText(l, ANCHO / 2, y + 14 + 25 + k * 34))
      ctx.textAlign = 'left'
      ctx.fillStyle = C.linea
      ctx.fillRect(0, y + alto - 2, ANCHO, 2)
    }
    y += alto
  }
  return y - y0
}

function pie(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = C.gris
  ctx.font = `500 22px ${TEXTO}`
  ctx.textAlign = 'center'
  ctx.fillText('NODO Club de Pádel & Co.', ANCHO / 2, y - 16)
  // marca de agua
  ctx.font = `500 17px ${TEXTO}`
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fillText('Desarrollado por Federico Olego', ANCHO / 2, y + 14)
  ctx.textAlign = 'left'
}

function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen'))), 'image/png'))
}

// ------------------------------------------------------------------ zonas

interface Tarjeta { alto: number; dibujar: (ctx: CanvasRenderingContext2D, x: number, y: number) => void }

/** Zona como tabla: N° · Pareja · Partido · Horario (una fila por pareja y por partido) */
function tarjetaZona(ctx: CanvasRenderingContext2D, cat: Categoria, zi: number, ancho: number): Tarjeta {
  const nombre = (id: string) => cat.parejas.find((p) => p.id === id)?.nombre ?? ''
  const zona = cat.zonas[zi]
  const partidos = partidosDeZona(zona, zi, nombre)
  const fechas = [...new Set(partidos.map((p) => cat.horariosZona[p.key]?.fecha).filter(Boolean))] as string[]
  const unDia = fechas.length === 1 && partidos.every((p) => cat.horariosZona[p.key]?.fecha === fechas[0])
  const titulo = `ZONA ${LETRAS[zi]}${unDia ? ` · ${diaLargo(fechas[0]).toUpperCase()}` : ''}`
  const hora = (k: number) => {
    const h = cat.horariosZona[partidos[k]?.key]
    if (!h?.hora) return '—'
    return unDia || !h.fecha ? h.hora : `${textoHorario({ fecha: h.fecha, hora: '' }).slice(0, 3)} ${h.hora}`
  }
  const cNum = 48, cPart = 84, cHora = unDia ? 98 : 124
  const cPar = ancho - cNum - cPart - cHora
  const filas = Math.max(zona.length, partidos.length)
  ctx.font = `600 23px ${TEXTO}`
  const nombresL = Array.from({ length: filas }, (_, k) => (zona[k] ? lineas(ctx, nombre(zona[k]), cPar - 24) : []))
  const altos = nombresL.map((l) => Math.max(60, l.length * 28 + 22))
  const altoCab = 64, altoCols = 40
  const alto = altoCab + altoCols + altos.reduce((a, b) => a + b, 0)
  return {
    alto,
    dibujar: (c, x, y) => {
      c.save()
      c.beginPath(); c.roundRect(x, y, ancho, alto, 16); c.clip()
      c.fillStyle = C.blanco; c.fillRect(x, y, ancho, alto)
      // título
      c.fillStyle = C.noche; c.fillRect(x, y, ancho, altoCab)
      c.fillStyle = C.blanco; c.font = `700 36px ${DISPLAY}`; c.textAlign = 'center'
      c.fillText(titulo, x + ancho / 2, y + 45)
      // encabezado de columnas
      const yc = y + altoCab
      c.fillStyle = C.verde; c.fillRect(x, yc, ancho, altoCols)
      c.fillStyle = C.blanco; c.font = `700 16px ${TEXTO}`
      c.fillText('N°', x + cNum / 2, yc + 27)
      c.fillText('PAREJA', x + cNum + cPar / 2, yc + 27)
      c.fillText('PARTIDO', x + cNum + cPar + cPart / 2, yc + 27)
      c.fillText('HORARIO', x + cNum + cPar + cPart + cHora / 2, yc + 27)
      // filas
      let yy = yc + altoCols
      for (let k = 0; k < filas; k++) {
        const h = altos[k]
        const mid = yy + h / 2
        if (k % 2 === 1) { c.fillStyle = '#F7FAF9'; c.fillRect(x, yy, cNum + cPar + cPart, h) }
        c.fillStyle = C.texto
        c.font = `700 24px ${TEXTO}`; c.textAlign = 'center'
        if (zona[k]) c.fillText(String(k + 1), x + cNum / 2, mid + 8)
        c.textAlign = 'left'; c.font = `600 23px ${TEXTO}`
        const ls = nombresL[k]
        ls.forEach((l, i) => c.fillText(l, x + cNum + 12, mid - ((ls.length - 1) * 28) / 2 + 8 + i * 28))
        c.textAlign = 'center'
        if (partidos[k]) {
          c.font = `600 22px ${TEXTO}`; c.fillStyle = C.gris
          c.fillText(partidos[k].codigo, x + cNum + cPar + cPart / 2, mid + 8)
          // horario destacado
          c.fillStyle = C.verde
          c.fillRect(x + cNum + cPar + cPart, yy, cHora, h)
          c.fillStyle = C.blanco; c.font = `700 ${unDia ? 26 : 22}px ${TEXTO}`
          c.fillText(hora(k), x + cNum + cPar + cPart + cHora / 2, mid + 9)
        }
        c.textAlign = 'left'
        c.fillStyle = C.linea; c.fillRect(x, yy + h - 1, ancho, 1)
        yy += h
      }
      // líneas verticales
      c.fillStyle = C.linea
      for (const cx of [cNum, cNum + cPar, cNum + cPar + cPart]) c.fillRect(x + cx, yc + altoCols, 1, alto - altoCab - altoCols)
      c.restore()
      c.strokeStyle = C.noche; c.lineWidth = 2
      c.beginPath(); c.roundRect(x, y, ancho, alto, 16); c.stroke()
    },
  }
}

/** "Viernes 25 desde las 17:15 · Sábado 26 desde las 12:30 · Clasifican 2 por zona de 3 y 3 por zona de 4" */
function resumenZonas(cat: Categoria): string {
  const porDia = new Map<string, string>()
  cat.zonas.forEach((z, zi) => partidosDeZona(z, zi, () => '').forEach((p) => {
    const h = cat.horariosZona[p.key]
    if (h?.fecha && h.hora && (!porDia.has(h.fecha) || h.hora < porDia.get(h.fecha)!)) porDia.set(h.fecha, h.hora)
  }))
  const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([f, h]) => `${diaLargo(f)} desde las ${h}`)
  const tam = new Set(cat.zonas.map((z) => z.length))
  const clas = [tam.has(3) ? '2 por zona de 3' : '', tam.has(4) ? '3 por zona de 4' : ''].filter(Boolean).join(' y ')
  return [...dias, clas ? `Clasifican ${clas}` : ''].filter(Boolean).join(' · ')
}

/** "Sábado 3 desde las 13:00 · Domingo 4 desde las 10:00" (primer partido de playoff de cada día) */
function resumenPlayoff(cat: Categoria): string {
  if (!cat.cuadro) return ''
  const porDia = new Map<string, string>()
  rondasPlayoff(cat.cuadro).flat().filter((p) => !p.bye).forEach((p) => {
    const h = cat.horariosPlayoff[p.key]
    if (h?.fecha && h.hora && (!porDia.has(h.fecha) || h.hora < porDia.get(h.fecha)!)) porDia.set(h.fecha, h.hora)
  })
  return [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([f, h]) => `${diaLargo(f)} desde las ${h}`).join(' · ')
}

export async function imagenesZonas(cat: Categoria): Promise<Blob[]> {
  await fuentes()
  const img = await logo()
  const medir = document.createElement('canvas').getContext('2d')!
  const gap = 28
  const anchoCol = (ANCHO - 2 * MARGEN - gap) / 2
  const tarjetas = cat.zonas.map((_, zi) => tarjetaZona(medir, cat, zi, anchoCol))
  const altoEnc = encabezado(medir, img, cat, 'Zonas', true)
  const textos = [{ texto: resumenZonas(cat), fuerte: true }, { texto: cat.observacion }]
  const altoBandas = bandas(medir, 0, textos, true)
  const MAX_CONTENIDO = 1700   // alto máximo de zonas por imagen (después se arma otra)

  // repartir en páginas; en cada una, las zonas van de a pares (A-B, C-D…) como en la planilla
  const paginas: { col: number; y: number; t: Tarjeta }[][] = []
  let actual: { col: number; y: number; t: Tarjeta }[] = []
  let y = 0
  for (let i = 0; i < tarjetas.length; i += 2) {
    const fila = tarjetas.slice(i, i + 2)
    const altoFila = Math.max(...fila.map((t) => t.alto))
    if (y + altoFila > MAX_CONTENIDO && actual.length) { paginas.push(actual); actual = []; y = 0 }
    fila.forEach((t, k) => actual.push({ col: k, y, t }))
    y += altoFila + gap
  }
  if (actual.length) paginas.push(actual)

  const blobs: Blob[] = []
  for (let i = 0; i < paginas.length; i++) {
    const pag = paginas[i]
    const altoCont = Math.max(...pag.map((x) => x.y + x.t.alto))
    const canvas = document.createElement('canvas')
    canvas.width = ANCHO
    canvas.height = altoEnc + altoBandas + 40 + altoCont + 90
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = C.fondo
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    encabezado(ctx, img, cat, paginas.length > 1 ? `Zonas ${i + 1}/${paginas.length}` : 'Zonas')
    bandas(ctx, altoEnc, textos)
    for (const x of pag) x.t.dibujar(ctx, MARGEN + x.col * (anchoCol + gap), altoEnc + altoBandas + 40 + x.y)
    pie(ctx, canvas.height - 36)
    blobs.push(await aBlob(canvas))
  }
  return blobs
}

// ------------------------------------------------------------------ playoff

/**
 * Cuadro del playoff. Se arma con lo que se sabe en cada momento: al terminar las zonas aparecen
 * los nombres de los clasificados, y con cada resultado se marca el ganador, el marcador y quién avanza.
 */
export async function imagenPlayoff(cat: Categoria): Promise<Blob> {
  if (!cat.cuadro) throw new Error('Todavía no hay cuadro de playoff')
  await fuentes()
  const img = await logo()
  const rondas = rondasPlayoff(cat.cuadro)
  // nombres reales y resultados (si el cuadro es válido); si no, quedan las etiquetas ("1° Zona A")
  const res = resolverTorneo(cat)
  const resueltas = res.playoff
  const campeon = res.campeon ? cat.parejas.find((p) => p.id === res.campeon)?.nombre ?? '' : ''
  // la primera ronda solo se dibuja si tiene algún partido real (si son todos "libre", arranca en la siguiente)
  const desde = rondas[0].every((p) => p.bye) ? 1 : 0
  const visibles = rondas.slice(desde)
  const R = visibles.length
  const gapX = 34
  const anchoCaja = (ANCHO - 2 * MARGEN - gapX * (R - 1)) / R
  const altoCaja = 124
  const n0 = visibles[0].length
  const slot = Math.max(altoCaja + 26, n0 <= 2 ? 300 : 0)
  const altoBracket = n0 * slot
  const medir = document.createElement('canvas').getContext('2d')!
  const altoEnc = encabezado(medir, img, cat, 'Playoff', true)
  const textos = [{ texto: resumenPlayoff(cat), fuerte: true }, { texto: cat.observacion }]
  const altoBandas = bandas(medir, 0, textos, true)
  const topBracket = altoEnc + altoBandas + 48 + 50
  const altoCampeon = campeon ? 170 : 0

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = topBracket + altoBracket + altoCampeon + 100
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  encabezado(ctx, img, cat, 'Playoff')
  bandas(ctx, altoEnc, textos)

  const tamLetra = anchoCaja < 200 ? 19 : anchoCaja < 260 ? 21 : 24
  const centros: number[][] = []
  visibles.forEach((ronda, r) => {
    const x = MARGEN + r * (anchoCaja + gapX)
    const paso = altoBracket / ronda.length
    ctx.fillStyle = C.verde
    ctx.font = `700 ${Math.min(34, tamLetra + 10)}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText(ronda[0].fase.toUpperCase(), x + anchoCaja / 2, topBracket - 22)
    ctx.textAlign = 'left'
    centros[r] = []
    ronda.forEach((p, j) => {
      const cy = topBracket + paso * j + paso / 2
      centros[r][j] = cy
      if (p.bye) return
      const pr = resueltas?.[r + desde]?.[j]
      const jugado = pr?.estado === 'jugado' && !!pr.resultado
      const y = cy - altoCaja / 2
      const final = p.fase === 'Final'
      rect(ctx, x, y, anchoCaja, altoCaja, 14, C.blanco, final ? C.lima : undefined)
      // horario
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, anchoCaja, 34, [14, 14, 0, 0]); ctx.fillStyle = final ? C.lima : C.verdeSuave; ctx.fill(); ctx.restore()
      ctx.fillStyle = C.noche
      ctx.font = `700 ${tamLetra - 4}px ${TEXTO}`
      ctx.fillText(recortar(ctx, textoHorario(cat.horariosPlayoff[p.key], true), anchoCaja - 20), x + 10, y + 24)

      // marcador: una columna por set (o "W.O." del lado ganador)
      const sets = jugado && !pr!.resultado!.wo ? pr!.resultado!.sets : null
      const wo = jugado && pr!.resultado!.wo ? pr!.resultado!.wo : null
      const colSet = tamLetra + 8
      const anchoMarcador = sets ? sets.length * colSet + 4 : wo ? 54 : 0

      ;([0, 1] as const).forEach((k) => {
        const ty = y + 34 + 22 + k * 42
        const id = pr ? (k === 0 ? pr.a : pr.b) : null
        const texto = pr ? (k === 0 ? pr.etiquetaA : pr.etiquetaB) : k === 0 ? p.a : p.b
        const gano = jugado && id === pr!.ganador
        const perdio = jugado && !gano
        // ganador: barrita amarilla a la izquierda
        if (gano) { ctx.fillStyle = C.lima; ctx.fillRect(x, ty - 18, 6, 36) }
        ctx.fillStyle = !id ? C.gris : perdio ? C.gris : C.texto
        const peso = gano ? 700 : 600
        const anchoNombre = anchoCaja - 20 - (anchoMarcador ? anchoMarcador + 6 : 0)
        // achica la letra antes de cortar el texto ("Ganador Semifinal 1" en la columna de la final)
        let tl = tamLetra
        ctx.font = `${peso} ${tl}px ${TEXTO}`
        while (tl > 14 && ctx.measureText(texto).width > anchoNombre) { tl--; ctx.font = `${peso} ${tl}px ${TEXTO}` }
        ctx.fillText(recortar(ctx, texto, anchoNombre), x + 12, ty + 8)
        // marcador
        ctx.textAlign = 'center'
        if (sets) {
          sets.forEach((sv, i) => {
            const propio = sv[k], otro = sv[1 - k]
            const cx = x + anchoCaja - 10 - (sets.length - i - 0.5) * colSet
            ctx.font = `${propio > otro ? 700 : 500} ${tamLetra}px ${TEXTO}`
            ctx.fillStyle = propio > otro ? C.noche : C.gris
            ctx.fillText(String(propio), cx, ty + 8)
          })
        } else if (wo && gano) {
          ctx.font = `700 ${tamLetra - 5}px ${TEXTO}`
          ctx.fillStyle = C.verde
          ctx.fillText('W.O.', x + anchoCaja - 10 - anchoMarcador / 2, ty + 7)
        }
        ctx.textAlign = 'left'
      })
      ctx.strokeStyle = C.linea; ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.moveTo(x + 10, y + 34 + 45); ctx.lineTo(x + anchoCaja - 10, y + 34 + 45); ctx.stroke()
      // conector con la ronda anterior
      if (r > 0) {
        const px = x - gapX
        const a = centros[r - 1][2 * j], b = centros[r - 1][2 * j + 1]
        const ant = visibles[r - 1]
        ctx.strokeStyle = C.verde; ctx.lineWidth = 3
        ctx.beginPath()
        if (!ant[2 * j].bye) { ctx.moveTo(px, a); ctx.lineTo(px + gapX / 2, a); ctx.lineTo(px + gapX / 2, cy) }
        if (!ant[2 * j + 1].bye) { ctx.moveTo(px, b); ctx.lineTo(px + gapX / 2, b); ctx.lineTo(px + gapX / 2, cy) }
        ctx.moveTo(px + gapX / 2, cy); ctx.lineTo(x, cy)
        ctx.stroke()
      }
    })
  })

  // campeones
  if (campeon) {
    const y = topBracket + altoBracket + 30
    const h = altoCampeon - 40
    rect(ctx, MARGEN, y, ANCHO - 2 * MARGEN, h, 18, C.noche, C.lima)
    icono(ctx, 'trofeo', MARGEN + 36, y + (h - 72) / 2, 72, C.lima)
    const tx = MARGEN + 36 + 72 + 30
    ctx.fillStyle = C.lima
    ctx.font = `700 30px ${DISPLAY}`
    ctx.fillText('CAMPEONES', tx, y + 50)
    ctx.fillStyle = C.blanco
    let t = 52
    ctx.font = `700 ${t}px ${DISPLAY}`
    while (t > 30 && ctx.measureText(campeon).width > ANCHO - MARGEN - tx - 30) { t--; ctx.font = `700 ${t}px ${DISPLAY}` }
    ctx.fillText(recortar(ctx, campeon, ANCHO - MARGEN - tx - 30), tx, y + 50 + t + 8)
  }
  pie(ctx, canvas.height - 36)
  return aBlob(canvas)
}

export const nombreArchivo = (cat: Categoria, tipo: string) =>
  `${[cat.torneo, tipo].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, '').trim() || 'torneo'}.png`
// ------------------------------------------------------------------ rankings de las estadísticas

export interface FilaImagenRanking { puesto: number; nombre: string; valor: string; extra?: string }

/** Cuántos jugadores entran como máximo en la imagen de un ranking */
export const MAX_FILAS_RANKING = 25

/**
 * Imagen de un ranking de estadísticas (campeones, participaciones, puntos) con los filtros aplicados.
 * `filtros`: "Caballeros · 2026 · Octubre" (o "Todos los torneos")
 */
export async function imagenRanking({ titulo, filtros, columna, columnaExtra, filas, total }: {
  titulo: string; filtros: string; columna: string; columnaExtra?: string; filas: FilaImagenRanking[]; total: number
}): Promise<Blob> {
  await fuentes()
  const img = await logo()
  const lista = filas.slice(0, MAX_FILAS_RANKING)
  const logoTam = 150
  const altoCab = logoTam + 2 * 40
  const altoFila = 64
  const altoCols = 44
  const nota = total > lista.length ? `Primeros ${lista.length} de ${total} jugadores` : ''
  const altoTabla = altoCols + Math.max(1, lista.length) * altoFila
  const alto = altoCab + 40 + altoTabla + (nota ? 52 : 16) + 96

  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = alto
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, ANCHO, alto)

  // encabezado: logo + título + filtros
  ctx.fillStyle = C.noche
  ctx.fillRect(0, 0, ANCHO, altoCab)
  ctx.drawImage(img, MARGEN, (altoCab - logoTam) / 2, logoTam, logoTam)
  const tx = MARGEN + logoTam + 40
  const anchoTexto = ANCHO - tx - MARGEN
  icono(ctx, 'trofeo', tx, altoCab / 2 - 66, 48, C.lima)
  ctx.fillStyle = C.blanco
  let t = 66
  ctx.font = `700 ${t}px ${DISPLAY}`
  while (t > 40 && ctx.measureText(titulo).width > anchoTexto - 64) { t--; ctx.font = `700 ${t}px ${DISPLAY}` }
  ctx.fillText(recortar(ctx, titulo, anchoTexto - 64), tx + 64, altoCab / 2 - 18)
  ctx.font = `600 34px ${DISPLAY}`
  ctx.fillStyle = C.lima
  const lf = lineas(ctx, filtros, anchoTexto).slice(0, 2)
  lf.forEach((l, i) => ctx.fillText(l, tx, altoCab / 2 + 30 + i * 38))

  // tabla
  const x = MARGEN, ancho = ANCHO - 2 * MARGEN
  let y = altoCab + 40
  ctx.save()
  ctx.beginPath(); ctx.roundRect(x, y, ancho, altoTabla, 16); ctx.clip()
  ctx.fillStyle = C.blanco; ctx.fillRect(x, y, ancho, altoTabla)
  ctx.fillStyle = C.verde; ctx.fillRect(x, y, ancho, altoCols)
  ctx.fillStyle = C.blanco; ctx.font = `700 17px ${TEXTO}`
  const cPos = 92
  const conExtra = !!columnaExtra
  const cExtra = conExtra ? 170 : 0
  const cValor = 170
  ctx.textAlign = 'center'; ctx.fillText('PUESTO', x + cPos / 2, y + 29)
  ctx.textAlign = 'left'; ctx.fillText('JUGADOR', x + cPos + 12, y + 29)
  ctx.textAlign = 'center'
  if (conExtra) ctx.fillText(columnaExtra!.toUpperCase(), x + ancho - cValor - cExtra / 2, y + 29)
  ctx.fillText(columna.toUpperCase(), x + ancho - cValor / 2, y + 29)
  y += altoCols
  if (!lista.length) {
    ctx.fillStyle = C.gris; ctx.font = `500 26px ${TEXTO}`
    ctx.fillText('Sin jugadores para estos filtros', ANCHO / 2, y + 42)
  }
  lista.forEach((f, k) => {
    const mid = y + altoFila / 2
    if (k % 2 === 1) { ctx.fillStyle = '#F7FAF9'; ctx.fillRect(x, y, ancho, altoFila) }
    // puesto: el 1° destacado con la lima de la pelota
    ctx.beginPath(); ctx.arc(x + cPos / 2, mid, 21, 0, Math.PI * 2)
    ctx.fillStyle = f.puesto === 1 ? C.lima : C.verdeSuave; ctx.fill()
    ctx.fillStyle = C.noche; ctx.font = `700 24px ${TEXTO}`; ctx.textAlign = 'center'
    ctx.fillText(String(f.puesto), x + cPos / 2, mid + 8)
    ctx.textAlign = 'left'; ctx.font = `${f.puesto === 1 ? 700 : 600} 27px ${TEXTO}`; ctx.fillStyle = C.texto
    ctx.fillText(recortar(ctx, f.nombre, ancho - cPos - cExtra - cValor - 24), x + cPos + 12, mid + 9)
    ctx.textAlign = 'center'
    if (conExtra) { ctx.font = `500 24px ${TEXTO}`; ctx.fillStyle = C.gris; ctx.fillText(f.extra ?? '', x + ancho - cValor - cExtra / 2, mid + 8) }
    ctx.font = `700 34px ${DISPLAY}`; ctx.fillStyle = C.verde
    ctx.fillText(f.valor, x + ancho - cValor / 2, mid + 11)
    ctx.textAlign = 'left'
    ctx.fillStyle = C.linea; ctx.fillRect(x, y + altoFila - 1, ancho, 1)
    y += altoFila
  })
  ctx.restore()
  y = altoCab + 40 + altoTabla
  if (nota) {
    ctx.fillStyle = C.gris; ctx.font = `500 22px ${TEXTO}`; ctx.textAlign = 'center'
    ctx.fillText(nota, ANCHO / 2, y + 36)
    ctx.textAlign = 'left'
  }
  pie(ctx, alto - 36)
  return aBlob(canvas)
}

// ------------------------------------------------------------------ categorías de jugadores

/** Jugadores por columna y columnas por imagen: si no entran, se arman más imágenes */
const FILAS_POR_COLUMNA = 25
const COLUMNAS_POR_IMAGEN = 2
/** Hasta esta cantidad va en una sola columna (queda más prolijo) */
const MAX_UNA_COLUMNA = 12

/** Color de la rama (mismos que tailwind.config.js); null = sin categoría asignada */
const COLOR_RAMA = { Damas: '#C93A78', Caballeros: '#2463C2', sin: '#B7791F' } as const

/**
 * Imágenes de una categoría de jugadores (ej. "7ma Damas") con todos sus jugadores y el total.
 * Hasta 2 columnas de 25 nombres por imagen; si hay más, devuelve varias imágenes (1 de 2, 2 de 2…)
 */
export async function imagenesCategoria({ titulo, rama, nombres }: {
  titulo: string; rama: 'Damas' | 'Caballeros' | null; nombres: string[]
}): Promise<Blob[]> {
  await fuentes()
  const img = await logo()
  const color = COLOR_RAMA[rama ?? 'sin']
  const porImagen = FILAS_POR_COLUMNA * COLUMNAS_POR_IMAGEN
  const partes: string[][] = []
  for (let i = 0; i < nombres.length; i += porImagen) partes.push(nombres.slice(i, i + porImagen))
  if (!partes.length) partes.push([])
  const total = nombres.length
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const out: Blob[] = []
  for (let pi = 0; pi < partes.length; pi++) {
    const parte = partes[pi]
    const desde = pi * porImagen
    const cols = total <= MAX_UNA_COLUMNA ? 1 : COLUMNAS_POR_IMAGEN
    const filas = Math.max(1, Math.ceil(parte.length / cols))

    const logoTam = 150
    const altoCab = logoTam + 2 * 40
    const altoFila = 56
    const altoCols = 44
    const altoTabla = altoCols + filas * altoFila
    const nota = partes.length > 1 ? `Jugadores ${desde + 1} a ${desde + parte.length} de ${total} · Imagen ${pi + 1} de ${partes.length}` : ''
    const alto = altoCab + 10 + 40 + altoTabla + (nota ? 52 : 16) + 96

    const canvas = document.createElement('canvas')
    canvas.width = ANCHO
    canvas.height = alto
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = C.fondo
    ctx.fillRect(0, 0, ANCHO, alto)

    // encabezado: logo + categoría + total de jugadores
    ctx.fillStyle = C.noche
    ctx.fillRect(0, 0, ANCHO, altoCab)
    ctx.fillStyle = color
    ctx.fillRect(0, altoCab, ANCHO, 10)
    ctx.drawImage(img, MARGEN, (altoCab - logoTam) / 2, logoTam, logoTam)
    const tx = MARGEN + logoTam + 40
    const anchoTexto = ANCHO - tx - MARGEN
    icono(ctx, 'usuarios', tx, altoCab / 2 - 66, 48, C.lima)
    ctx.fillStyle = C.blanco
    let t = 66
    ctx.font = `700 ${t}px ${DISPLAY}`
    while (t > 40 && ctx.measureText(titulo).width > anchoTexto - 64) { t--; ctx.font = `700 ${t}px ${DISPLAY}` }
    ctx.fillText(recortar(ctx, titulo, anchoTexto - 64), tx + 64, altoCab / 2 - 18)
    ctx.font = `600 34px ${DISPLAY}`
    ctx.fillStyle = C.lima
    ctx.fillText(recortar(ctx, `${total} ${total === 1 ? 'jugador' : 'jugadores'} · al ${hoy}`, anchoTexto), tx, altoCab / 2 + 32)

    // tabla de nombres, por columnas (se lee de arriba hacia abajo, columna por columna)
    const x = MARGEN, ancho = ANCHO - 2 * MARGEN
    const anchoCol = ancho / cols
    const cNum = 64
    const y0 = altoCab + 10 + 40
    ctx.save()
    ctx.beginPath(); ctx.roundRect(x, y0, ancho, altoTabla, 16); ctx.clip()
    ctx.fillStyle = C.blanco; ctx.fillRect(x, y0, ancho, altoTabla)
    ctx.fillStyle = color; ctx.fillRect(x, y0, ancho, altoCols)
    ctx.fillStyle = C.blanco; ctx.font = `700 17px ${TEXTO}`
    for (let c = 0; c < cols; c++) {
      const cx = x + c * anchoCol
      ctx.textAlign = 'center'; ctx.fillText('N°', cx + cNum / 2, y0 + 29)
      ctx.textAlign = 'left'; ctx.fillText('JUGADOR', cx + cNum + 8, y0 + 29)
    }
    // franjas alternadas
    for (let f = 0; f < filas; f++) {
      const fy = y0 + altoCols + f * altoFila
      if (f % 2 === 1) { ctx.fillStyle = '#F7FAF9'; ctx.fillRect(x, fy, ancho, altoFila) }
      ctx.fillStyle = C.linea; ctx.fillRect(x, fy + altoFila - 1, ancho, 1)
    }
    if (!parte.length) {
      ctx.fillStyle = C.gris; ctx.font = `500 26px ${TEXTO}`; ctx.textAlign = 'center'
      ctx.fillText('Sin jugadores en esta categoría', ANCHO / 2, y0 + altoCols + 36)
    }
    parte.forEach((nombre, k) => {
      const c = Math.floor(k / filas)
      const f = k % filas
      const cx = x + c * anchoCol
      const mid = y0 + altoCols + f * altoFila + altoFila / 2
      ctx.textAlign = 'center'; ctx.font = `600 21px ${TEXTO}`; ctx.fillStyle = C.gris
      ctx.fillText(String(desde + k + 1), cx + cNum / 2, mid + 7)
      ctx.textAlign = 'left'; ctx.font = `600 26px ${TEXTO}`; ctx.fillStyle = C.texto
      ctx.fillText(recortar(ctx, nombre, anchoCol - cNum - 24), cx + cNum + 8, mid + 9)
    })
    // separador entre columnas
    for (let c = 1; c < cols; c++) { ctx.fillStyle = C.linea; ctx.fillRect(x + c * anchoCol, y0 + altoCols, 2, altoTabla - altoCols) }
    ctx.restore()
    ctx.textAlign = 'left'
    if (nota) {
      ctx.fillStyle = C.gris; ctx.font = `500 22px ${TEXTO}`; ctx.textAlign = 'center'
      ctx.fillText(nota, ANCHO / 2, y0 + altoTabla + 36)
      ctx.textAlign = 'left'
    }
    pie(ctx, alto - 36)
    out.push(await aBlob(canvas))
  }
  return out
}

// ------------------------------------------------------------------ ascensos y recategorizaciones
export interface DatosMovimientos {
  /** categoría nueva: "6ta Caballeros" */
  categoria: string
  rama: 'Damas' | 'Caballeros'
  /** nombres como se muestran, con la categoría anterior */
  jugadores: { nombre: string; antes: string }[]
  /** nombre de la tanda: "Recategorización Octubre 2026" */
  tanda: string
  /** DD/MM/AAAA */
  vigencia: string
}

const ASCENSOS_POR_IMAGEN = 12
const RECAT_POR_IMAGEN = 22
/** "7ma Caballeros" → "7ma" */
const numCat = (c: string) => c.split(' ')[0]

/** Generador pseudoaleatorio con semilla: el confeti sale siempre igual para la misma categoría */
function azar(semilla: number) {
  let s = semilla % 2147483647 || 1
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}
const semillaDe = (t: string) => [...t].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 7)

function confeti(ctx: CanvasRenderingContext2D, alto: number, colores: string[], semilla: number, libre: { x: number; y0: number; y1: number }) {
  const r = azar(semilla)
  for (let i = 0; i < 70; i++) {
    const x = r() * ANCHO, y = r() * alto
    // no tapa el título
    if (x < libre.x && y > libre.y0 && y < libre.y1) { r(); r(); continue }
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(r() * Math.PI)
    ctx.globalAlpha = 0.55 + r() * 0.45
    ctx.fillStyle = colores[i % colores.length]
    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, 4 + r() * 4, 0, Math.PI * 2); ctx.fill() } else ctx.fillRect(-9, -3.5, 14 + r() * 8, 7)
    ctx.restore()
  }
}

function pelotita(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = C.lima; ctx.fill()
  ctx.strokeStyle = C.blanco; ctx.lineWidth = 2.4
  ctx.beginPath(); ctx.arc(x - r * 1.05, y, r * 0.8, -0.9, 0.9); ctx.stroke()
  ctx.beginPath(); ctx.arc(x + r * 1.05, y, r * 0.8, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke()
}

function partir<T>(lista: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += n) out.push(lista.slice(i, i + n))
  return out.length ? out : [[]]
}

/** Imagen festiva de los que ascienden a una categoría (una o más, según la cantidad) */
export async function imagenesAscenso({ categoria, rama, jugadores, tanda, vigencia }: DatosMovimientos): Promise<Blob[]> {
  await fuentes()
  const img = await logo()
  const color = COLOR_RAMA[rama]
  const partes = partir(jugadores, ASCENSOS_POR_IMAGEN)
  const out: Blob[] = []
  for (let pi = 0; pi < partes.length; pi++) {
    const parte = partes[pi]
    const altoCab = 430, filaH = 96, gap = 14
    const altoLista = Math.max(1, parte.length) * (filaH + gap) - gap
    const nota = partes.length > 1 ? `Imagen ${pi + 1} de ${partes.length}` : ''
    const alto = altoCab + 12 + 56 + altoLista + (nota ? 40 : 0) + 150 + 110
    const canvas = document.createElement('canvas')
    canvas.width = ANCHO
    canvas.height = alto
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = C.fondo
    ctx.fillRect(0, 0, ANCHO, alto)

    // cabecera: categoría nueva gigante de fondo + confeti + título
    ctx.fillStyle = C.noche
    ctx.fillRect(0, 0, ANCHO, altoCab)
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, ANCHO, altoCab); ctx.clip()
    ctx.font = `700 520px ${DISPLAY}`
    ctx.fillStyle = 'rgba(200,220,60,0.07)'
    ctx.textAlign = 'right'
    ctx.fillText(numCat(categoria), ANCHO + 30, altoCab + 40)
    ctx.restore()
    confeti(ctx, altoCab, [C.lima, color, C.blanco], semillaDe(categoria) + pi, { x: 760, y0: 180, y1: 390 })
    ctx.drawImage(img, MARGEN, 44, 120, 120)
    ctx.font = `700 24px ${TEXTO}`
    const et = 'ASCENSO'
    const ew = ctx.measureText(et).width + 92
    rect(ctx, ANCHO - MARGEN - ew, 62, ew, 50, 25, C.lima)
    icono(ctx, 'subir', ANCHO - MARGEN - ew + 18, 74, 26, C.noche)
    ctx.fillStyle = C.noche
    ctx.fillText(et, ANCHO - MARGEN - ew + 54, 96)
    ctx.fillStyle = C.lima
    ctx.font = `700 120px ${DISPLAY}`
    ctx.fillText('¡Felicitaciones!', MARGEN, 300)
    ctx.fillStyle = C.blanco
    ctx.font = `600 46px ${DISPLAY}`
    ctx.fillText(recortar(ctx, `${jugadores.length === 1 ? 'Asciende' : 'Ascienden'} a ${categoria}`, ANCHO - 2 * MARGEN), MARGEN, 366)
    ctx.fillStyle = color
    ctx.fillRect(0, altoCab, ANCHO, 12)

    // una tarjeta por jugador, con el chip "7ma → 6ta"
    let y = altoCab + 12 + 56
    for (const j of parte) {
      rect(ctx, MARGEN, y, ANCHO - 2 * MARGEN, filaH, 18, C.blanco)
      ctx.save()
      ctx.beginPath(); ctx.roundRect(MARGEN, y, ANCHO - 2 * MARGEN, filaH, 18); ctx.clip()
      ctx.fillStyle = color; ctx.fillRect(MARGEN, y, 10, filaH)
      ctx.restore()
      icono(ctx, 'trofeo', MARGEN + 36, y + filaH / 2 - 20, 40, C.verde)
      ctx.font = `700 28px ${DISPLAY}`
      const a = numCat(j.antes), b = numCat(categoria)
      const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, cw = wa + wb + 98
      const cx = ANCHO - MARGEN - 28 - cw, cy = y + filaH / 2 - 27
      rect(ctx, cx, cy, cw, 54, 27, C.verdeSuave)
      ctx.fillStyle = C.gris
      ctx.fillText(a, cx + 22, cy + 37)
      icono(ctx, 'flecha', cx + 30 + wa, cy + 15, 24, C.verde)
      rect(ctx, cx + 62 + wa, cy + 6, wb + 28, 42, 21, C.verde)
      ctx.fillStyle = C.blanco
      ctx.fillText(b, cx + 76 + wa, cy + 37)
      ctx.fillStyle = C.texto
      ctx.font = `700 40px ${DISPLAY}`
      ctx.fillText(recortar(ctx, j.nombre, cx - (MARGEN + 100) - 20), MARGEN + 100, y + filaH / 2 + 14)
      y += filaH + gap
    }
    if (nota) {
      ctx.fillStyle = C.gris; ctx.font = `500 22px ${TEXTO}`; ctx.textAlign = 'center'
      ctx.fillText(nota, ANCHO / 2, y + 16)
      ctx.textAlign = 'left'
      y += 40
    }

    // cierre
    y += 58
    ctx.textAlign = 'center'
    ctx.fillStyle = C.texto
    ctx.font = `700 38px ${DISPLAY}`
    const cierre = `¡A romperla en ${categoria}!`
    ctx.fillText(cierre, ANCHO / 2 - 22, y)
    pelotita(ctx, ANCHO / 2 - 22 + ctx.measureText(cierre).width / 2 + 30, y - 13, 17)
    ctx.fillStyle = C.gris
    ctx.font = `500 24px ${TEXTO}`
    ctx.fillText(recortar(ctx, `${tanda} · Vigente desde el ${vigencia}`, ANCHO - 2 * MARGEN), ANCHO / 2, y + 44)
    ctx.textAlign = 'left'
    pie(ctx, alto - 40)
    out.push(await aBlob(canvas))
  }
  return out
}

/** Imagen informativa de los que pasan a una categoría de número mayor (recategorización) */
export async function imagenesRecategorizacion({ categoria, rama, jugadores, tanda, vigencia }: DatosMovimientos): Promise<Blob[]> {
  await fuentes()
  const img = await logo()
  const color = COLOR_RAMA[rama]
  const partes = partir(jugadores, RECAT_POR_IMAGEN)
  const out: Blob[] = []
  for (let pi = 0; pi < partes.length; pi++) {
    const parte = partes[pi]
    const altoCab = 270, filaH = 72, colsH = 52
    const altoTabla = colsH + Math.max(1, parte.length) * filaH
    const nota = partes.length > 1 ? `Imagen ${pi + 1} de ${partes.length}` : ''
    const alto = altoCab + 10 + 48 + altoTabla + (nota ? 44 : 0) + 40 + 150 + 100
    const canvas = document.createElement('canvas')
    canvas.width = ANCHO
    canvas.height = alto
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = C.fondo
    ctx.fillRect(0, 0, ANCHO, alto)

    // cabecera sobria: logo, título y etiqueta "Informativo"
    ctx.fillStyle = C.noche
    ctx.fillRect(0, 0, ANCHO, altoCab)
    ctx.drawImage(img, MARGEN, (altoCab - 150) / 2, 150, 150)
    const tx = MARGEN + 150 + 40
    ctx.font = `700 22px ${TEXTO}`
    const et = 'INFORMATIVO'
    const ew = ctx.measureText(et).width + 80
    rect(ctx, ANCHO - MARGEN - ew, 40, ew, 46, 23, C.noche, 'rgba(255,255,255,0.55)')
    icono(ctx, 'info', ANCHO - MARGEN - ew + 16, 51, 24, C.blanco)
    ctx.fillStyle = C.blanco
    ctx.fillText(et, ANCHO - MARGEN - ew + 50, 71)
    ctx.font = `700 72px ${DISPLAY}`
    ctx.fillText('Recategorización', tx, 135)
    ctx.fillStyle = C.lima
    ctx.font = `600 40px ${DISPLAY}`
    ctx.fillText(recortar(ctx, `${jugadores.length === 1 ? 'Pasa' : 'Pasan'} a ${categoria}`, ANCHO - tx - MARGEN), tx, 191)
    ctx.fillStyle = color
    ctx.fillRect(0, altoCab, ANCHO, 10)

    // tabla: jugador · anterior → nueva
    const x = MARGEN, w = ANCHO - 2 * MARGEN, y0 = altoCab + 10 + 48
    const cAntes = x + w - 330, cAhora = x + w - 150
    ctx.save()
    ctx.beginPath(); ctx.roundRect(x, y0, w, altoTabla, 16); ctx.clip()
    ctx.fillStyle = C.blanco; ctx.fillRect(x, y0, w, altoTabla)
    ctx.fillStyle = color; ctx.fillRect(x, y0, w, colsH)
    ctx.fillStyle = C.blanco; ctx.font = `700 18px ${TEXTO}`
    ctx.fillText('JUGADOR', x + 28, y0 + 33)
    ctx.textAlign = 'center'
    ctx.fillText('CATEGORÍA ANTERIOR', cAntes + 40, y0 + 33)
    ctx.fillText('NUEVA', cAhora + 60, y0 + 33)
    ctx.textAlign = 'left'
    parte.forEach((j, i) => {
      const fy = y0 + colsH + i * filaH
      if (i % 2) { ctx.fillStyle = '#F7FAF9'; ctx.fillRect(x, fy, w, filaH) }
      ctx.fillStyle = C.linea; ctx.fillRect(x, fy + filaH - 1, w, 1)
      const mid = fy + filaH / 2
      ctx.fillStyle = C.texto; ctx.font = `600 28px ${TEXTO}`
      ctx.fillText(recortar(ctx, j.nombre, cAntes - x - 60), x + 28, mid + 10)
      ctx.textAlign = 'center'; ctx.font = `600 26px ${TEXTO}`; ctx.fillStyle = C.gris
      ctx.fillText(numCat(j.antes), cAntes + 40, mid + 9)
      ctx.textAlign = 'left'
      icono(ctx, 'flecha', cAntes + 118, mid - 11, 22, C.gris)
      rect(ctx, cAhora + 18, mid - 21, 84, 42, 21, C.blanco, color)
      ctx.fillStyle = color; ctx.font = `700 26px ${DISPLAY}`; ctx.textAlign = 'center'
      ctx.fillText(numCat(categoria), cAhora + 60, mid + 9)
      ctx.textAlign = 'left'
    })
    ctx.restore()
    let y = y0 + altoTabla
    if (nota) {
      ctx.fillStyle = C.gris; ctx.font = `500 22px ${TEXTO}`; ctx.textAlign = 'center'
      ctx.fillText(nota, ANCHO / 2, y + 34)
      ctx.textAlign = 'left'
      y += 44
    }

    // recuadro con la vigencia
    y += 70
    rect(ctx, MARGEN, y - 40, w, 160, 16, C.verdeSuave)
    ctx.textAlign = 'center'
    ctx.fillStyle = C.texto; ctx.font = `600 25px ${TEXTO}`
    ctx.fillText(`Los cambios rigen desde el ${vigencia} para las inscripciones a torneos.`, ANCHO / 2, y + 6)
    ctx.fillStyle = C.gris; ctx.font = `500 23px ${TEXTO}`
    ctx.fillText('Por consultas, hablá con la administración del club.', ANCHO / 2, y + 44)
    ctx.font = `600 21px ${TEXTO}`; ctx.fillStyle = C.verde
    ctx.fillText(recortar(ctx, tanda.toUpperCase(), w - 40), ANCHO / 2, y + 88)
    ctx.textAlign = 'left'
    pie(ctx, alto - 40)
    out.push(await aBlob(canvas))
  }
  return out
}
