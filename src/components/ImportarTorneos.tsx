import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { listar } from '../lib/almacen'
import { analizar, importarSql, parsearSql, type Analisis, type ArchivoSql } from '../lib/importarSql'
import { nombreEstado, rangoFechas } from '../lib/torneo'
import { Alerta, Badge, Button, Modal } from './ui'

/** Botón “Importar torneos”: lee un .sql (el que se genera desde el Excel), muestra qué va a cargar y lo carga */
export default function ImportarTorneos({ onImportado, onError }: { onImportado: (mensaje: string) => void | Promise<void>; onError: (mensaje: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<{ nombre: string; sql: ArchivoSql; analisis: Analisis } | null>(null)
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [actualizar, setActualizar] = useState(false)

  async function elegido(f: File | undefined) {
    if (input.current) input.current.value = ''
    if (!f) return
    setError(''); setActualizar(false); setLeyendo(true)
    try {
      if (f.size > 5_000_000) throw new Error('El archivo es demasiado grande (máximo 5 MB).')
      const sql = parsearSql(await f.text())
      setArchivo({ nombre: f.name, sql, analisis: analizar(sql, await listar()) })
    } catch (e) {
      setArchivo(null)
      onError(`No se importó nada. ${e instanceof Error ? e.message : 'No se pudo leer el archivo.'}`)
    } finally { setLeyendo(false) }
  }

  async function importar() {
    if (!archivo) return
    setImportando(true); setError('')
    try {
      const r = await importarSql(archivo.sql, archivo.analisis, actualizar)
      const partes = [
        r.torneosNuevos && `${r.torneosNuevos} torneo(s) nuevo(s)`,
        r.torneosActualizados && `${r.torneosActualizados} actualizado(s)`,
        r.torneosOmitidos && `${r.torneosOmitidos} que ya estaba(n) quedaron sin tocar`,
        (r.parejasNuevas || r.parejasActualizadas) && `parejas: ${r.parejasNuevas} nuevas, ${r.parejasActualizadas} actualizadas`,
        (r.partidosNuevos || r.partidosActualizados) && `partidos: ${r.partidosNuevos} nuevos, ${r.partidosActualizados} actualizados`,
        r.jugadoresNuevos && `${r.jugadoresNuevos} jugador(es) nuevo(s) en el padrón`,
      ].filter(Boolean)
      setArchivo(null)
      await onImportado(`Importación de ${archivo.nombre} terminada: ${partes.join(' · ') || 'no había nada nuevo'}.`)
    } catch (e) {
      // no es una transacción: lo que se cargó queda; se corrige y se vuelve a importar (no duplica)
      setError(`${e instanceof Error ? e.message : 'Algo salió mal.'} Lo que se llegó a cargar quedó guardado: corregí el archivo y volvé a importarlo (no duplica).`)
    } finally { setImportando(false) }
  }

  const a = archivo?.analisis
  const existentes = a?.torneos.filter((t) => t.existente) ?? []
  const conResultados = existentes.filter((t) => t.existente!.estado !== 'pendiente')
  const aImportar = a ? a.torneos.filter((t) => !t.existente || actualizar).length : 0

  return (
    <>
      <input ref={input} type="file" accept=".sql,text/plain,application/sql" className="hidden" onChange={(e) => void elegido(e.target.files?.[0])} />
      <Button variante="secundario" onClick={() => input.current?.click()} cargando={leyendo}>
        <FileUp className="h-4 w-4" aria-hidden /> Importar torneos
      </Button>
      <Modal abierto={!!archivo} titulo="Importar torneos" onCerrar={() => !importando && setArchivo(null)} ancho="max-w-2xl">
        {a && (
          <div className="space-y-4">
            <p className="text-sm text-noche/70">
              Archivo <strong>{archivo!.nombre}</strong>: {a.torneos.length} torneo(s)
              {archivo!.sql.ignoradas > 0 && ` · ${archivo!.sql.ignoradas} consulta(s) de control que no hacen falta (se ignoran)`}.
            </p>
            {a.errores.length > 0 && (
              <Alerta tipo="error">
                <p className="font-semibold">No se puede importar:</p>
                <ul className="mt-1 list-disc pl-4">{a.errores.map((e) => <li key={e}>{e}</li>)}</ul>
              </Alerta>
            )}
            {a.avisos.length > 0 && <Alerta tipo="aviso"><ul className="list-disc pl-4">{a.avisos.map((e) => <li key={e}>{e}</li>)}</ul></Alerta>}
            <ul className="divide-y divide-noche/10 rounded-xl ring-1 ring-noche/10">
              {a.torneos.map((t) => (
                <li key={t.id} className="space-y-1 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-noche">{t.nombre || 'Sin nombre'}</span>
                    <Badge>{t.categoria}</Badge>
                    {t.existente
                      ? <Badge tono={t.existente.estado === 'pendiente' ? 'ambar' : 'rojo'}>Ya existe · {nombreEstado(t.existente.estado)}</Badge>
                      : <Badge tono="verde">Nuevo</Badge>}
                  </div>
                  <p className="text-xs text-noche/60">{rangoFechas(t.fechaInicio, t.fechaFin) || 'Sin fechas'} · {t.parejas} parejas · {t.partidos} partidos con horario</p>
                  {t.avisos.length > 0 && <ul className="list-disc pl-4 text-xs text-amber-900">{t.avisos.map((x) => <li key={x}>{x}</li>)}</ul>}
                </li>
              ))}
            </ul>
            {existentes.length > 0 && (
              <div className="space-y-2 rounded-xl bg-vidrio p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm text-noche">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0F6B57]" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} />
                  <span>
                    <strong>Actualizar los {existentes.length} torneo(s) que ya existen</strong> con los datos del archivo.
                    <span className="mt-0.5 block text-xs text-noche/65">
                      Pisa lo que se haya cambiado en la app: nombre, fechas, cuadro, nombres de parejas, zonas y horarios de los partidos (una reprogramación se pierde).
                      Una pareja borrada en la app vuelve a aparecer. No toca resultados, formatos ni la publicación. Sin tildar, esos torneos quedan como están.
                    </span>
                  </span>
                </label>
                {actualizar && conResultados.length > 0 && (
                  <Alerta tipo="aviso">{conResultados.map((t) => t.nombre).join(', ')} ya tiene(n) resultados: si cambiaron las zonas, esos resultados pueden quedar desactualizados.</Alerta>
                )}
              </div>
            )}
            {error && <Alerta tipo="error">{error}</Alerta>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variante="secundario" onClick={() => setArchivo(null)} disabled={importando}>Cancelar</Button>
              <Button onClick={importar} cargando={importando} disabled={!!a.errores.length || !aImportar}>
                <FileUp className="h-4 w-4" aria-hidden /> {aImportar ? `Importar ${aImportar} torneo(s)` : 'Nada para importar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
