import { useState, useRef, useEffect, useMemo } from 'react'

// Seletor de intervalo (início → fim) nativo, no padrão visual do app (theme.css).
// Sem dependências externas. Dia único = intervalo com início = fim.

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const addDays = (d, n) => { const x = startOfDay(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a, b) => a && b && startOfDay(a).getTime() === startOfDay(b).getTime()

// [inicio, fim) — fim EXCLUSIVO (início do dia seguinte ao 'to'). Casa com as RPCs.
export const isoRange = ({ from, to }) => [startOfDay(from).toISOString(), addDays(to, 1).toISOString()]

export function fmtRangeLabel({ from, to }) {
  if (!from) return 'Selecionar período'
  const f = new Date(from), t = new Date(to || from)
  if (sameDay(f, t)) return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
  if (f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth())
    return `${f.getDate()}–${t.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
  if (f.getFullYear() === t.getFullYear())
    return `${f.getDate()} ${MESES[f.getMonth()]} – ${t.getDate()} ${MESES[t.getMonth()]} ${f.getFullYear()}`
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()} – ${t.getDate()} ${MESES[t.getMonth()]} ${t.getFullYear()}`
}

export function presetRanges(ref = new Date()) {
  const today = startOfDay(ref)
  const weekStart = addDays(today, -today.getDay()) // semana começa no domingo
  return [
    ['hoje',       'Hoje',            today, today],
    ['ontem',      'Ontem',           addDays(today, -1), addDays(today, -1)],
    ['semana',     'Esta semana',     weekStart, addDays(weekStart, 6)],
    ['semana_ant', 'Semana passada',  addDays(weekStart, -7), addDays(weekStart, -1)],
    ['mes',        'Este mês',        new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)],
    ['mes_ant',    'Mês passado',     new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)],
    ['dias30',     'Últimos 30 dias', addDays(today, -29), today],
    ['ano',        'Este ano',        new Date(today.getFullYear(), 0, 1), today],
  ].map(([key, label, from, to]) => ({ key, label, from: startOfDay(from), to: startOfDay(to) }))
}

export function defaultRange() {
  const p = presetRanges().find(p => p.key === 'mes')
  return { from: p.from, to: p.to }
}

export function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => startOfDay((value && value.from) || new Date()))
  const [pending, setPending] = useState(null) // {from, to|null} durante a seleção
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPending(null) } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const presets = useMemo(() => presetRanges(), [])
  const activePreset = presets.find(p => value && sameDay(p.from, value.from) && sameDay(p.to, value.to))?.key

  const commit = (from, to) => { onChange({ from: startOfDay(from), to: startOfDay(to) }); setPending(null); setOpen(false) }
  const clickPreset = (p) => { setView(startOfDay(p.from)); commit(p.from, p.to) }
  const clickDay = (d) => {
    if (!pending || pending.to) setPending({ from: d, to: null })
    else { let a = pending.from, b = d; if (b < a) [a, b] = [b, a]; commit(a, b) }
  }

  const y = view.getFullYear(), m = view.getMonth()
  const lead = new Date(y, m, 1).getDay(), nd = new Date(y, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= nd; d++) cells.push(new Date(y, m, d))

  const selFrom = pending?.from || value?.from, selTo = pending?.to || (pending ? null : value?.to)
  const inRange = (d) => { if (!selFrom) return false; const a = startOfDay(selFrom), b = startOfDay(selTo || selFrom); return d >= a && d <= b }
  const isEdge = (d) => sameDay(d, selFrom) || sameDay(d, selTo)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px',
        borderRadius: 'var(--radius-control)', border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--valois-blue)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
      }}>
        <span style={{ fontSize: 16 }}>📅</span>
        <span>{fmtRangeLabel(value || {})}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 120, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)',
          padding: 12, display: 'flex', flexWrap: 'wrap', gap: 14, maxWidth: 'min(94vw, 430px)',
          fontFamily: "'Inter',sans-serif",
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 128 }}>
            {presets.map(p => (
              <button key={p.key} onClick={() => clickPreset(p)} style={{
                textAlign: 'left', padding: '7px 10px', borderRadius: 'var(--radius-control)', border: 'none', cursor: 'pointer',
                fontFamily: "'Inter',sans-serif", fontSize: 13, whiteSpace: 'nowrap',
                background: activePreset === p.key ? 'var(--valois-blue-soft)' : 'transparent',
                color: activePreset === p.key ? 'var(--valois-blue)' : 'var(--text-secondary)',
                fontWeight: activePreset === p.key ? 700 : 500,
              }}>{p.label}</button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 232 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <button onClick={() => setView(new Date(y, m - 1, 1))} style={navBtn} aria-label="Mês anterior">‹</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{MESES_LONG[m]} {y}</span>
              <button onClick={() => setView(new Date(y, m + 1, 1))} style={navBtn} aria-label="Próximo mês">›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {DIAS.map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
              {cells.map((d, i) => d ? (
                <button key={i} onClick={() => clickDay(d)} style={{
                  height: 30, border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontSize: 12.5,
                  borderRadius: 8, transition: 'background 0.1s',
                  background: isEdge(d) ? 'var(--valois-blue)' : inRange(d) ? 'var(--valois-blue-soft)' : 'transparent',
                  color: isEdge(d) ? '#fff' : inRange(d) ? 'var(--valois-blue)' : 'var(--text-primary)',
                  fontWeight: isEdge(d) ? 700 : 400,
                }}>{d.getDate()}</button>
              ) : <div key={i} />)}
            </div>
            {pending && !pending.to && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)', textAlign: 'center' }}>
                Selecione a data final
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1, display: 'grid', placeItems: 'center',
}
