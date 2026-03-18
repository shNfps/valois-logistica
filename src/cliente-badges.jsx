// ─── GAMIFICAÇÃO DE CLIENTES ───

const BADGE_DEFS = {
  frequente: { icon: '🔥', label: 'Cliente Frequente — 2+ pedidos esta semana',  bg: '#FEF3C7', anim: 'pulse-fire 1.4s ease-in-out infinite' },
  ouro:      { icon: '🏆', label: 'Cliente Ouro — R$8.000+ esta semana',          bg: '#FEF9C3', anim: 'pulse-fire 1.8s ease-in-out infinite' },
  fiel:      { icon: '⭐', label: 'Cliente Fiel — 20+ pedidos conosco',            bg: '#FFFBEB', anim: '' },
  crescente: { icon: '🚀', label: 'Em Crescimento — mais que o mês anterior',     bg: '#EFF6FF', anim: 'rocket-float 2s ease-in-out infinite' },
  vip:       { icon: '💎', label: 'Cliente VIP — R$30.000+ no total',             bg: '#F3E8FF', anim: 'shimmer-gem 2.5s ease-in-out infinite' },
}

export function calcClienteBadges(pedidos) {
  const valid = pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const now = new Date()
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const lastWeek = valid.filter(p => new Date(p.criado_em) >= weekAgo)
  const lastWeekValor = lastWeek.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const totalValor = valid.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const thisMonth = valid.filter(p => new Date(p.criado_em) >= monthStart).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const prevMonth = valid.filter(p => { const d = new Date(p.criado_em); return d >= prevMonthStart && d < monthStart }).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)

  const badges = []
  if (lastWeek.length >= 2)                         badges.push('frequente')
  if (lastWeekValor >= 8000)                        badges.push('ouro')
  if (pedidos.length >= 20)                         badges.push('fiel')
  if (thisMonth > 0 && thisMonth > prevMonth)       badges.push('crescente')
  if (totalValor >= 30000)                          badges.push('vip')
  return badges
}

const BADGE_CSS = `
@keyframes pulse-fire   { 0%,100%{transform:scale(1)}    50%{transform:scale(1.2)} }
@keyframes rocket-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
@keyframes shimmer-gem  { 0%,100%{opacity:1}              50%{opacity:0.55} }
`

export function ClienteBadges({ pedidos }) {
  const badges = calcClienteBadges(pedidos)
  if (badges.length === 0) return null
  return (
    <>
      <style>{BADGE_CSS}</style>
      <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap', verticalAlign: 'middle' }}>
        {badges.map(key => {
          const b = BADGE_DEFS[key]
          return (
            <span
              key={key}
              title={b.label}
              style={{
                background: b.bg,
                borderRadius: 6,
                padding: '1px 5px',
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                animation: b.anim || 'none',
                cursor: 'default',
                lineHeight: 1,
              }}
            >
              {b.icon}
            </span>
          )
        })}
      </span>
    </>
  )
}
