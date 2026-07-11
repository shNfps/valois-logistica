// ─── HOME PAGE (por role) — Checkpoint 3 ───
// Casca preparada para crescer. Hoje: saudação + data por extenso + 1 card de
// boas-vindas com atalho para a área principal do usuário. O grid já está pronto
// para receber flashcards personalizados por role na próxima fase.

// Config por setor: ícone, área de destino (activeTab) e textos do card.
const ROLE_HOME = {
  comercial:  { icon: '📋', area: 'comercial',  cta: 'Ver pedidos',      hint: 'Seus pedidos, roteiros e clientes ficam aqui.' },
  galpao:     { icon: '📦', area: 'galpao',     cta: 'Ver conferência',  hint: 'Pedidos aguardando conferência do galpão.' },
  motorista:  { icon: '🚛', area: 'motorista',  cta: 'Ver minhas rotas', hint: 'Suas rotas e entregas do dia.' },
  vendedor:   { icon: '🛍️', area: 'vendedor',   cta: 'Ver catálogo',     hint: 'Catálogo, clientes e sua comissão.' },
  manutencao: { icon: '🔧', area: 'manutencao', cta: 'Ver manutenções',  hint: 'Solicitações e agenda de manutenção.' },
  financeiro: { icon: '💰', area: 'financeiro', cta: 'Abrir financeiro', hint: 'Contas a pagar/receber, DRE e reembolsos.' },
}

// Swoosh da marca — divisor decorativo, uma única vez por tela.
function Swoosh() {
  return (
    <svg width="180" height="16" viewBox="0 0 200 20" fill="none" aria-hidden="true" style={{ display: 'block', marginTop: 10, opacity: 0.55 }}>
      <path d="M4 12 Q100 1 196 12 L194 17 Q100 7 6 17 Z" style={{ fill: 'var(--valois-green)' }} />
      <path d="M5 15 Q100 5 195 15" style={{ stroke: 'var(--valois-blue)' }} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// Card genérico dos flashcards da Home. `value` é opcional (métricas virão depois).
export function HomeCard({ icon, title, value, hint, color = 'var(--valois-blue)', cta, onCta }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--border)', borderTop: `3px solid ${color}`, padding: 18,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 20, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{icon}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      </div>
      {value != null && <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>}
      {hint && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{hint}</div>}
      {cta && (
        <button onClick={onCta} style={{
          marginTop: 4, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 38, padding: '0 16px', borderRadius: 'var(--radius-control)', border: 'none', cursor: 'pointer',
          background: 'var(--valois-blue)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: "'Inter',sans-serif",
        }}>{cta} →</button>
      )}
    </div>
  )
}

export function HomePage({ user, onNavigate }) {
  const nome = (user?.nome || '').split(' ')[0] || 'Bem-vindo'
  const h = new Date().getHours()
  const saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const dRaw = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const dataExt = dRaw.charAt(0).toUpperCase() + dRaw.slice(1)

  const setores = user?.setores || [user?.setor]
  const primary = setores.find(s => ROLE_HOME[s]) || setores[0]
  const cfg = ROLE_HOME[primary] || ROLE_HOME.comercial

  return (
    <div>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>{saud}, {nome}! 👋</h1>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{dataExt}</div>
        <Swoosh />
      </div>

      {/* TODO: flashcards personalizados por role — próxima fase */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 20 }}>
        <HomeCard icon={cfg.icon} title="Sua área" hint={cfg.hint} color="var(--valois-blue)" cta={cfg.cta} onCta={() => onNavigate(cfg.area)} />
      </div>
    </div>
  )
}
