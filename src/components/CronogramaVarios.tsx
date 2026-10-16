import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Download, FileText, Printer, Share2 } from 'lucide-react'
import { cargarVarios } from '../lib/almacen'
import { docWord, encabezadoVarios, filasCronogramaVarios, htmlCronogramaVarios, logoPng, superposiciones } from '../lib/cronograma'
import { diaCorto, type Categoria } from '../lib/torneo'
import { logoUrl } from '../App'
import { Alerta, Badge, Button, Card, Spinner } from './ui'

// Colores del documento (los de la marca del complejo, iguales al cronograma de cada torneo)
const COLORES = { oscuro: '#042D29', acento: '#C8DC3C', suave: '#F2F6F4' }
/** NODO: sede única con 3 canchas */
const CANCHAS = 3

/** Cronograma unificado: todos los partidos de los torneos elegidos, en orden de día y horario */
export default function CronogramaVarios({ ids, onVolver }: { ids: string[]; onVolver: () => void }) {
  const [cats, setCats] = useState<Categoria[] | null>(null)
  const [error, setError] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  useEffect(() => { logoPng(logoUrl()).then(setLogo) }, [])
  useEffect(() => {
    let vigente = true
    cargarVarios(ids).then((c) => { if (vigente) setCats(c) }).catch((e) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron leer los torneos.') })
    return () => { vigente = false }
  }, [ids])

  const filas = useMemo(() => (cats ? filasCronogramaVarios(cats) : []), [cats])
  const html = useMemo(() => (cats ? htmlCronogramaVarios(cats, logo, COLORES) : ''), [cats, logo])
  const enc = useMemo(() => (cats ? encabezadoVarios(cats) : null), [cats])
  const avisos = useMemo(() => superposiciones(filas, CANCHAS), [filas])
  const sinHorario = filas.filter((f) => !f.fecha || !f.hora).length
  const porDia = useMemo(() => [...new Set(filas.map((f) => f.fecha))].map((d) => ({ d, n: filas.filter((f) => f.fecha === d).length })), [filas])
  const nombreArchivo = `Cronograma - ${(enc?.titulo ?? 'Torneos').replace(/[\\/:*?"<>|]+/g, '')}`

  // el PDF se arma de antemano: compartir tiene que ejecutarse enseguida después del toque
  const [pdf, setPdf] = useState<File | null>(null)
  useEffect(() => {
    let vigente = true
    setPdf(null)
    if (!cats || !filas.length) return
    const t = setTimeout(() => {
      import('../lib/cronogramaPdf')
        .then(({ pdfCronogramaVarios }) => { if (vigente) setPdf(new File([pdfCronogramaVarios(cats, logo, COLORES)], `${nombreArchivo}.pdf`, { type: 'application/pdf' })) })
        .catch(() => { /* sin PDF: quedan imprimir y Word */ })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [cats, logo, filas.length, nombreArchivo])
  const puedeCompartir = !!pdf && typeof navigator.canShare === 'function' && navigator.canShare({ files: [pdf] })

  const bajar = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function compartirPdf() {
    if (!pdf) return
    if (!puedeCompartir) return bajar(pdf, pdf.name)
    try { await navigator.share({ files: [pdf], title: `Cronograma · ${enc?.titulo ?? ''}` }) } catch { /* canceló */ }
  }
  function imprimir() {
    const w = window.open('', '_blank')
    if (!w) return alert('El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio.')
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.onload = () => setTimeout(() => w.print(), 300)
  }
  const word = () => cats && bajar(docWord(htmlCronogramaVarios(cats, null, COLORES)), `${nombreArchivo}.doc`)

  return (
    <>
      <button onClick={onVolver} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cancha hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a los torneos
      </button>
      <header className="mb-5">
        <h1 className="flex items-center gap-2 font-display text-4xl font-bold leading-none text-noche">
          <CalendarDays className="h-8 w-8 text-cancha" aria-hidden /> Cronograma{enc && enc.titulo !== 'Cronograma de partidos' ? ` · ${enc.titulo}` : ''}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-noche/70">Todos los partidos de los torneos elegidos, ordenados por día y horario, con los resultados ya cargados y lugar para anotar los que faltan.</p>
      </header>

      {error ? <Alerta tipo="error">{error}</Alerta> : !cats ? <Spinner texto="Armando el cronograma…" /> : (
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => <Badge key={c.id} tono="azul">{c.torneo || 'Torneo sin nombre'}</Badge>)}
            </div>
            <p className="text-sm text-noche/75">
              <strong className="num">{filas.length}</strong> partidos{enc?.rango ? ` · ${enc.rango}` : ''}
              {porDia.length > 1 && ` · ${porDia.map((x) => `${x.d ? diaCorto(x.d) : 'sin día'}: ${x.n}`).join(' · ')}`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={compartirPdf} disabled={!pdf}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1FA855] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18914A] disabled:opacity-50">
                <Share2 className="h-4 w-4" aria-hidden /> {puedeCompartir ? 'Compartir PDF' : 'Descargar PDF'}
              </button>
              {puedeCompartir && <Button variante="secundario" onClick={() => pdf && bajar(pdf, pdf.name)}><Download className="h-4 w-4" aria-hidden /> PDF</Button>}
              <Button variante="secundario" onClick={imprimir} disabled={!filas.length}><Printer className="h-4 w-4" aria-hidden /> Imprimir</Button>
              <Button variante="secundario" onClick={word} disabled={!filas.length}><FileText className="h-4 w-4" aria-hidden /> Word</Button>
            </div>
            {sinHorario > 0 && <Alerta tipo="aviso">{sinHorario} partido(s) no tienen día u horario: aparecen al final, en “Sin día asignado”.</Alerta>}
            {avisos.length > 0 && (
              <Alerta tipo="aviso">
                <p className="font-semibold">Revisá estos horarios (duración estimada: americano 45′, al mejor de 3 sets 1 h · {CANCHAS} canchas):</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
              </Alerta>
            )}
          </Card>
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-noche/10">
            <iframe title="Vista previa del cronograma" srcDoc={html} className="h-[75vh] w-full" />
          </div>
        </div>
      )}
    </>
  )
}
