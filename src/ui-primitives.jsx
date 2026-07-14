// ─── Primitivos de UI nativos (equivalentes ao shadcn, sem Tailwind/Radix) ──────
// Mesma linha do field.jsx/attachment.jsx: seguem os PADRÕES do shadcn (variantes,
// papéis ARIA, tamanhos) mas renderizam com inline-style consumindo os design tokens
// (theme.css). Usados pelo wizard NF+Boleto.

// Progress — role="progressbar" + indicador que anima a largura (padrão shadcn/Radix).
export function Progress({ value = 0, height = 8, color = 'var(--valois-blue)', track = 'var(--border)', style }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}
      style={{ width: '100%', height, borderRadius: 999, background: track, overflow: 'hidden', ...style }}>
      <div style={{ height: '100%', width: `${v}%`, background: color, borderRadius: 999, transition: 'width .55s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  )
}

// Badge — variantes de estado (success/neutral/warning/info/danger), rounded-full,
// pequeno, com suporte a ícone (igual aos exemplos do shadcn).
const BADGE = {
  success: { bg: 'var(--valois-green-soft)', fg: '#3E6B00', bd: '#CDEBA6' },
  neutral: { bg: '#F1F5F9', fg: 'var(--text-secondary)', bd: 'var(--border)' },
  warning: { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' },
  info: { bg: 'var(--valois-blue-soft)', fg: 'var(--valois-blue)', bd: '#C9D0F0' },
  danger: { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' },
}
export function Badge({ variant = 'neutral', children, style }) {
  const c = BADGE[variant] || BADGE.neutral
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, lineHeight: 1.35, background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  )
}

// Skeleton — placeholder pulsante (padrão shadcn: bg-muted + animate-pulse).
export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  return <div aria-hidden="true" style={{ width, height, borderRadius: radius, background: 'linear-gradient(90deg,#EDF1F7,#F6F8FB,#EDF1F7)', backgroundSize: '200% 100%', animation: 'valoisPulse 1.3s ease-in-out infinite', ...style }} />
}

// Separator — linha fina (role="separator").
export function Separator({ style }) {
  return <div role="separator" style={{ height: 1, background: 'var(--border)', border: 'none', margin: '4px 0', ...style }} />
}

// Stepper — "barra de progressão" com N etapas nomeadas: círculo numerado + rótulo,
// conectores entre eles. Concluído=verde✓, atual=azul, pendente=cinza.
export function Stepper({ steps, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      {steps.map((s, i) => {
        const n = i + 1
        const done = n < current, active = n === current
        const bg = done ? 'var(--valois-green)' : active ? 'var(--valois-blue)' : 'var(--surface)'
        const fg = done || active ? '#fff' : 'var(--text-secondary)'
        const bd = done ? 'var(--valois-green)' : active ? 'var(--valois-blue)' : 'var(--border)'
        const last = i === steps.length - 1
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'flex-start', flex: last ? '0 0 auto' : 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, width: 64 }}>
              <div aria-current={active ? 'step' : undefined}
                style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: bg, color: fg, border: `2px solid ${bd}`, fontSize: 13, fontWeight: 800, transition: 'all .3s', boxShadow: active ? '0 0 0 4px var(--valois-blue-soft)' : 'none' }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
            </div>
            {!last && <div style={{ flex: 1, height: 3, borderRadius: 2, marginTop: 14, background: done ? 'var(--valois-green)' : 'var(--border)', transition: 'background .3s' }} />}
          </div>
        )
      })}
    </div>
  )
}
