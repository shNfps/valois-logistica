import { useState, useEffect } from 'react'

// ─── SIDE MENU (Checkpoint 4) ───
// Navegação de sub-abas: sidebar fixo no desktop, drawer no mobile (<768px).
// A lista de sub-abas por módulo é a fonte única de verdade — as chaves batem
// EXATAMENTE com as sub-abas internas das views (que foram reaproveitadas).

export const MODULE_SUBTABS = {
  admin: [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'ranking', label: 'Ranking', icon: '🏆' },
    { key: 'usuarios', label: 'Funcionários', icon: '👥' },
    { key: 'produtos', label: 'Produtos', icon: '📦' },
    { key: 'pedidos', label: 'Pedidos', icon: '📋' },
    { key: 'roteiros', label: 'Roteiros', icon: '🗺️' },
    { key: 'clientes', label: 'Clientes', icon: '🏢' },
    { key: 'comissoes', label: 'Comissões', icon: '💰' },
    { key: 'metas', label: 'Metas', icon: '🎯' },
  ],
  comercial: [
    { key: 'pedidos', label: 'Pedidos', icon: '📋' },
    { key: 'roteiros', label: 'Roteiros', icon: '🗺️' },
    { key: 'clientes', label: 'Clientes', icon: '👥' },
    { key: 'manutencao', label: 'Manutenção', icon: '🔧' },
    { key: 'reembolsos', label: 'Reembolsos', icon: '💸' },
    { key: 'inadimplencia', label: 'Inadimplência', icon: '🚨' },
    { key: 'performance', label: 'Performance', icon: '📊' },
  ],
  galpao: [
    { key: 'conferencia', label: 'Conferência', icon: '📦' },
    { key: 'reembolsos', label: 'Reembolsos', icon: '💸' },
  ],
  motorista: [
    { key: 'rotas', label: 'Rotas', icon: '🚛' },
    { key: 'roteiros', label: 'Meus Roteiros', icon: '🗺️' },
    { key: 'reembolsos', label: 'Reembolsos', icon: '💸' },
  ],
  vendedor: [
    { key: 'catalogo', label: 'Catálogo', icon: '🛍️' },
    { key: 'clientes', label: 'Clientes', icon: '👥' },
    { key: 'comissao', label: 'Comissão', icon: '💰' },
    { key: 'rotas', label: 'Rotas', icon: '🗺️' },
    { key: 'manutencao', label: 'Manutenção', icon: '🔧' },
    { key: 'reembolsos', label: 'Reembolsos', icon: '💸' },
    { key: 'inadimplencia', label: 'Inadimplência', icon: '🚨' },
    { key: 'performance', label: 'Performance', icon: '📊' },
  ],
  manutencao: [
    { key: 'manutencoes', label: 'Manutenções', icon: '🔧' },
    { key: 'agenda', label: 'Agenda', icon: '📅' },
    { key: 'equipamentos', label: 'Equipamentos', icon: '📦' },
    { key: 'historico', label: 'Histórico', icon: '📋' },
    { key: 'reembolsos', label: 'Reembolsos', icon: '💸' },
  ],
  financeiro: [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'pagar', label: 'Contas a Pagar', icon: '📅' },
    { key: 'receber', label: 'Contas a Receber', icon: '📈' },
    { key: 'reembolsos', label: 'Reembolsos', icon: '💸' },
    { key: 'dre', label: 'DRE', icon: '📊' },
    { key: 'config', label: 'Configurações', icon: '⚙️' },
  ],
  relatorios: [
    { key: 'vendedores', label: 'Vendas por Vendedor', icon: '🏆' },
    { key: 'diagnostico', label: 'Diagnóstico Top 20', icon: '🔬' },
    { key: 'visitas', label: 'Visitas Pendentes', icon: '📅' },
    { key: 'top50', label: 'Top 50 SKUs', icon: '📦' },
  ],
}

export const HOME_ITEM = { key: 'home', label: 'Início', icon: '🏠' }
export const firstSubTab = (mod) => MODULE_SUBTABS[mod]?.[0]?.key || null

// Hook simples de breakpoint (reaproveita o padrão já usado em manutencao-agenda).
export function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < bp : false))
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp)
    h() // sincroniza no mount caso a largura tenha mudado antes do efeito rodar
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return m
}

function NavItem({ item, active, onSelect, collapsed, badge }) {
  const [hover, setHover] = useState(false)
  const bg = active ? 'var(--valois-blue-soft)' : (hover ? 'var(--background)' : 'transparent')
  const color = active ? 'var(--valois-blue)' : 'var(--text-secondary)'
  return (
    <button
      title={collapsed ? item.label : undefined}
      onClick={() => onSelect(item.key)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 44,
        padding: collapsed ? 0 : '0 12px', justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 'var(--radius-control)', border: 'none', cursor: 'pointer', background: bg, color,
        fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: active ? 700 : 500,
      }}>
      {active && <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, background: 'var(--valois-blue)' }} />}
      <span style={{ fontSize: 17, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
      {!collapsed && badge > 0 && <span style={{ background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: 'grid', placeItems: 'center', padding: '0 6px' }}>{badge}</span>}
      {collapsed && badge > 0 && <span style={{ position: 'absolute', top: 6, right: 8, width: 8, height: 8, borderRadius: 4, background: 'var(--danger)' }} />}
    </button>
  )
}

export function SideNavList({ items, active, onSelect, collapsed = false, badges = {} }) {
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(it => <NavItem key={it.key} item={it} active={active === it.key} onSelect={onSelect} collapsed={collapsed} badge={badges[it.key]} />)}
    </nav>
  )
}

// Sidebar fixo (desktop). `top` = altura da topbar p/ o sticky ficar logo abaixo.
export function Sidebar({ items, active, onSelect, badges, collapsed, onToggleCollapse, top }) {
  return (
    <aside style={{
      width: collapsed ? 64 : 240, flexShrink: 0,
      position: 'sticky', top, height: `calc(100vh - ${top}px)`, alignSelf: 'flex-start',
      background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '12px 10px',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <SideNavList items={items} active={active} onSelect={onSelect} collapsed={collapsed} badges={badges} />
      </div>
      <button onClick={onToggleCollapse} title={collapsed ? 'Expandir' : 'Recolher'} style={{
        marginTop: 8, height: 40, borderRadius: 'var(--radius-control)', border: '1px solid var(--border)', background: 'transparent',
        cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, padding: collapsed ? 0 : '0 12px',
        fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600,
      }}>
        <span style={{ fontSize: 15 }}>{collapsed ? '»' : '«'}</span>
        {!collapsed && <span>Recolher</span>}
      </button>
    </aside>
  )
}

// Barra-gatilho do drawer (mobile): mostra a seção atual e abre o menu.
export function MobileSubnavBar({ label, icon, onOpen, top }) {
  return (
    <div style={{ position: 'sticky', top, zIndex: 80, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 12px' }}>
      <button onClick={onOpen} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 40, padding: '0 12px',
        borderRadius: 'var(--radius-control)', border: '1px solid var(--border)', background: 'var(--background)',
        cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
        <span style={{ fontSize: 17 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
        <span style={{ color: 'var(--text-secondary)' }}>▾</span>
      </button>
    </div>
  )
}

// Drawer (mobile): reaproveita a MESMA lista do sidebar como painel deslizante.
export function MobileDrawer({ open, onClose, items, active, onSelect, badges, title }) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.45)', display: 'flex' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 264, maxWidth: '82%', height: '100%', background: 'var(--surface)', boxShadow: '2px 0 20px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', padding: '14px 12px', animation: 'val-drawer-in 0.2s ease-out',
      }}>
        <style>{`@keyframes val-drawer-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--text-secondary)', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SideNavList items={items} active={active} onSelect={k => { onSelect(k); onClose() }} badges={badges} />
        </div>
      </div>
    </div>
  )
}
