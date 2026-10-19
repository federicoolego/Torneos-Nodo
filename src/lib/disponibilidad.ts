// Disponibilidad de las parejas (días y horarios en que pueden jugar) para "Armar fecha".
// El texto libre ("Viernes después de las 19", "Zona sábado") se puede interpretar solo y después se corrige a mano.
import { diaCorto, diaSemana, type Disponibilidad, type Franja, type Pareja } from './torneo'

/** "19:30" → 1170. Vacío → null */
export function aMinutos(h: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
/** 1170 → "19:30" (1470 → "00:30") */
export function aHora(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Límites de una franja en minutos del día, dentro de la apertura del día [abre, cierra].
 * Las horas de madrugada (antes de las 6) cuentan como del mismo día (00:30 → 24:30).
 */
export function limitesFranja(f: Franja, abre: number, cierra: number): [number, number] {
  const conv = (h: string, def: number) => {
    const m = aMinutos(h)
    if (m === null) return def
    return m < 6 * 60 && abre >= 6 * 60 ? m + 1440 : m
  }
  return [conv(f.desde, abre), conv(f.hasta, cierra)]
}

/** ¿Puede jugar un partido de [ini, fin) ese día? (minutos del día) */
export function puedeEnFranjas(d: Disponibilidad | undefined, fecha: string, ini: number, fin: number, abre: number, cierra: number): boolean {
  const fr = d?.dias?.[fecha]
  if (!fr) return true
  return fr.some((f) => { const [a, b] = limitesFranja(f, abre, cierra); return ini >= a && fin <= b })
}

export const sinRestriccion = (d: Disponibilidad | undefined) =>
  !d || (!Object.keys(d.dias ?? {}).length && !d.zona?.length && !d.preferencia)

/** "Zona: Vie · Vie desde 19:00 · Sáb no puede · Prefiere temprano" */
export function resumenDisponibilidad(d: Disponibilidad | undefined, dias: string[]): string {
  if (!d) return ''
  const partes: string[] = []
  const zona = (d.zona ?? []).filter((f) => dias.includes(f))
  if (zona.length && zona.length < dias.length) partes.push(`Zona: ${zona.map((f) => diaCorto(f).slice(0, 3)).join(' y ')}`)
  for (const f of dias) {
    const fr = d.dias?.[f]
    if (!fr) continue
    const dia = diaCorto(f).slice(0, 3)
    if (!fr.length) { partes.push(`${dia} no puede`); continue }
    partes.push(`${dia} ${fr.map(textoFranja).join(' o ')}`)
  }
  if (d.preferencia === 'temprano') partes.push('lo más temprano posible')
  if (d.preferencia === 'tarde') partes.push('lo más tarde posible')
  return partes.join(' · ')
}
/** Lo que hay que tener en cuenta de una pareja: días y horarios cargados + la nota (vacío si no tiene nada) */
export function textoPareja(p: Pick<Pareja, 'disponibilidad' | 'horario'> | undefined, dias: string[]): string {
  if (!p) return ''
  const r = resumenDisponibilidad(p.disponibilidad, dias)
  const nota = p.horario?.trim() ?? ''
  return [r && r.charAt(0).toUpperCase() + r.slice(1), nota && (r ? `Nota: ${nota}` : nota)].filter(Boolean).join(' · ')
}

export function textoFranja(f: Franja): string {
  if (f.desde && f.hasta) return `de ${f.desde} a ${f.hasta}`
  if (f.desde) return `desde ${f.desde}`
  if (f.hasta) return `hasta ${f.hasta}`
  return 'todo el día'
}

// ------------------------------------------------------------------ interpretar el texto libre

const DIAS_TXT: [RegExp, number][] = [
  [/\b(domingo|dom)\b/g, 0], [/\b(lunes|lun)\b/g, 1], [/\b(martes|mar)\b/g, 2], [/\b(miercoles|mie)\b/g, 3],
  [/\b(jueves|jue)\b/g, 4], [/\b(viernes|vie|vier)\b/g, 5], [/\b(sabado|sab|sbaado|sabdo|sabad)\b/g, 6],
]

const norm = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/(\d)\s*(hs|h|hrs)\b\.?/g, '$1').replace(/([a-z])[.()]/g, '$1 ').replace(/[()]/g, ' ').replace(/\s+/g, ' ')

/** "19" / "19.30" / "19:30" / "9" → "19:00"…; las horas chicas sin contexto (1 a 9) se toman de la tarde/noche salvo "mañana" */
function hora(t: string, manana: boolean): string {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(t)
  if (!m) return ''
  let h = Number(m[1])
  const mi = Number(m[2] ?? 0)
  if (h > 24 || mi > 59) return ''
  if (!manana && h >= 1 && h <= 9) h += 12
  if (h === 24) h = 0
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}
const H = '(\\d{1,2}(?:[:.]\\d{2})?)'

/** Condiciones de un pedazo de texto (lo que sigue a un día) */
function condiciones(seg: string): { franjas: Franja[] | null; no: boolean; pref: '' | 'temprano' | 'tarde'; libre: boolean } {
  const manana = /manana/.test(seg)
  const fr: Franja[] = []
  let pref: '' | 'temprano' | 'tarde' = ''
  if (/(lo mas|bien|super) temprano|temprano posible|primera hora/.test(seg)) pref = 'temprano'
  if (/ultima hora|lo mas tarde|tarde posible/.test(seg)) pref = 'tarde'
  // "entre las 13 y 15:30 no puede" (franja excluida)
  const excl = new RegExp(`entre (?:las )?${H} (?:y|a) (?:las )?${H}[^,;]*?no (?:puede|pueden|esta|estan)`).exec(seg)
  if (excl) {
    const a = hora(excl[1], manana), b = hora(excl[2], manana)
    if (a && b) return { franjas: [{ desde: '', hasta: a }, { desde: b, hasta: '' }], no: false, pref, libre: false }
  }
  let resto = seg
  const tomar = (re: RegExp, f: (m: RegExpExecArray) => Franja | null) => {
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, 'g')
    while ((m = r.exec(resto))) { const x = f(m); if (x) fr.push(x) }
    resto = resto.replace(r, ' ')
  }
  tomar(new RegExp(`(?:de|entre) (?:las )?${H} (?:a|y|hasta) (?:las )?${H}`), (m) => {
    const a = hora(m[1], manana), b = hora(m[2], manana)
    return a && b ? { desde: a, hasta: b } : null
  })
  tomar(new RegExp(`(?:despues|depsues|despeus|despue|desp|dsp|dps|pasadas)(?: de)?(?: las| la)? ${H}|(?:desde|a partir de)(?: las| la)? ${H}`), (m) => {
    const a = hora(m[1] ?? m[2], manana)
    return a ? { desde: a, hasta: '' } : null
  })
  tomar(new RegExp(`(?:antes de|hasta)(?: las| la)? ${H}`), (m) => {
    const b = hora(m[1], manana)
    return b ? { desde: '', hasta: b } : null
  })
  tomar(new RegExp(`(?:a las|a la|tipo|tipo las) ${H}`), (m) => {
    const a = hora(m[1], manana)
    return a ? { desde: a, hasta: '' } : null
  })
  if (!fr.length) {
    if (/a la manana|por la manana|de manana|\bmanana\b/.test(seg)) fr.push({ desde: '', hasta: '13:00' })
    else if (/a la siesta/.test(seg)) fr.push({ desde: '13:00', hasta: '17:00' })
    else if (/a la tarde|por la tarde/.test(seg)) fr.push({ desde: '13:00', hasta: '20:00' })
    else if (/a la noche|por la noche|de noche/.test(seg)) fr.push({ desde: '20:00', hasta: '' })
    else if (/ultima hora/.test(seg)) fr.push({ desde: '21:00', hasta: '' })
  }
  const no = !fr.length && /\bno (puede|pueden|esta|estan|juega|juegan|llega|llegan)\b|\bsin poder\b/.test(seg)
  const libre = /todo el dia|cualquier (hora|horario)|sin (problema|restriccion)/.test(seg)
  return { franjas: fr.length ? fr : null, no, pref, libre }
}

/**
 * Interpreta un texto como "Viernes después de las 19 · Si pasan al sábado entre 13 y 16".
 * Devuelve null si no entendió nada. Siempre conviene revisar el resultado.
 * Reglas: los días nombrados son los de la zona (salvo los que aparecen después de "si pasa…", que son del playoff);
 * los días no nombrados quedan libres.
 */
export function interpretarTexto(texto: string, dias: string[]): Disponibilidad | null {
  const t = norm(texto)
  if (!t.trim()) return null
  // menciones de días, en orden de aparición
  const menciones: { pos: number; fin: number; fecha: string }[] = []
  for (const [re, num] of DIAS_TXT) {
    const fecha = dias.find((f) => diaSemana(f) === num)
    if (!fecha) continue
    let m: RegExpExecArray | null
    const r = new RegExp(re.source, 'g')
    while ((m = r.exec(t))) menciones.push({ pos: m.index, fin: m.index + m[0].length, fecha })
  }
  menciones.sort((a, b) => a.pos - b.pos)
  const out: Disponibilidad = { dias: {} }
  const zona = new Set<string>()
  const zonaExplicita = new Set<string>()
  let pref: '' | 'temprano' | 'tarde' = ''
  let entendi = false

  if (!menciones.length) {
    // sin días: si hay un horario, vale para todos los días ("después de las 20")
    const c = condiciones(t)
    if (c.libre) entendi = true
    if (c.pref) { pref = c.pref; entendi = true }
    if (c.franjas) { for (const f of dias) out.dias[f] = c.franjas.map((x) => ({ ...x })); entendi = true }
  } else {
    for (let i = 0; i < menciones.length; i++) {
      const m = menciones[i]
      const sig = menciones[i + 1]
      let seg = t.slice(m.fin, sig ? sig.pos : t.length)
      // "(no están el viernes)": ese "no" es del día que sigue, no de este
      if (sig) seg = seg.replace(/\bno (esta|estan|puede|pueden)( el| los)?\s*$/, ' ')
      // "viernes y sábado después de las 12": el primer día toma la condición del siguiente
      if (/^\s*(y|o|,)( el| los)?\s*$/.test(seg) && sig) {
        const sig2 = menciones[i + 2]
        seg = t.slice(sig.fin, sig2 ? sig2.pos : t.length)
      }
      const antes = t.slice(Math.max(0, m.pos - 22), m.pos)
      const playoff = /si (pasa|pasan|clasifica|clasifican|avanza|avanzan)|en (el )?playoff/.test(antes)
      const c = condiciones(seg)
      // "(no están el viernes)": el "no" viene antes del día
      const noAntes = /\bno (esta|estan|puede|pueden)( el| los)?\s*$/.test(antes)
      entendi = true
      if (c.pref) pref = c.pref
      if (noAntes || c.no) { out.dias[m.fecha] = []; continue }
      if (!playoff) zona.add(m.fecha)
      // "zona viernes", "Sábado a la mañana zona": los días marcados como zona mandan
      if (!playoff && (/\bzona( el| los)?\s*$/.test(antes) || /^[^,;]*\bzona\b/.test(seg.replace(/\b(y|o)\b.*$/, '')))) zonaExplicita.add(m.fecha)
      if (c.franjas && !c.libre) out.dias[m.fecha] = [...(out.dias[m.fecha] ?? []), ...c.franjas]
    }
  }
  if (!entendi) return null
  const zonaDias = [...(zonaExplicita.size ? zonaExplicita : zona)].filter((f) => out.dias[f]?.length !== 0)
  if (zonaDias.length && zonaDias.length < dias.length) out.zona = dias.filter((f) => zonaDias.includes(f))
  if (pref) out.preferencia = pref
  return out
}
