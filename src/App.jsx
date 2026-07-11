import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase.js'
import { SETOR_MAP, fetchPedidos } from './db.js'
import { notificarAtrasos, filtrarAtrasos } from './alertas-entrega.jsx'
import { Loader, LoginScreen } from './components.jsx'
import { LoadingTransition } from './loading-transition.jsx'
import { HomePage } from './home.jsx'
import { Sidebar, MobileSubnavBar, MobileDrawer, MODULE_SUBTABS, HOME_ITEM, firstSubTab, useIsMobile } from './sidebar.jsx'
import { AdminView } from './views.jsx'
import { ComercialView, GalpaoView, VendedorView } from './views2.jsx'
import { MotoristaView } from './views5.jsx'
import { ManutencaoView } from './manutencao.jsx'
import { FinanceiroView } from './financeiro.jsx'
import { useNotificacoes, NotifBell, NotifToast } from './notificacoes-ui.jsx'
import { AvatarCircle, AvatarPickerModal } from './avatar.jsx'
import { EloBadgeAuto } from './performance-rank.jsx'
import RelatorioDiagnosticoTop20 from './relatorios-diagnostico.jsx'
import RelatorioVisitasPendentes from './relatorios-visitas.jsx'
import RelatorioTop50Produtos from './relatorios-produtos.jsx'

// Usuários liberados para a aba "Relatórios" (diagnóstico Top 20, visitas de retenção, top 50 produtos).
// Hardcoded por nome — alinhado com a decisão do projeto.
const RELATORIOS_USERS = ['Matheus']
// Sub-tab "Top 50 Produtos" restrita SOMENTE ao Matheus (mais estrita que a aba pai).
// Pedido explícito do usuário; mantém possibilidade futura de liberar outras sub-tabs
// pra outros nomes sem expor essa.
const TOP50_USERS = ['Matheus']

// Sub-abas controladas pelo side menu (Checkpoint 4): recebe `sub` por prop.
function RelatoriosView({ user, sub = 'diagnostico' }) {
  const podeTop50 = TOP50_USERS.includes(user.nome)
  return (
    <div>
      {sub === 'diagnostico' && <RelatorioDiagnosticoTop20 user={user} />}
      {sub === 'visitas'     && <RelatorioVisitasPendentes />}
      {sub === 'top50' && (podeTop50
        ? <RelatorioTop50Produtos user={user} />
        : <div style={{ padding: 40, textAlign: 'center', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, color: '#991B1B', fontWeight: 600 }}>🔒 Acesso restrito</div>
      )}
    </div>
  )
}

// Destino pós-login/refresh (Checkpoints 3+4). activeTab = módulo (setores[0],
// "cai onde cai hoje"). subTab = 'home' p/ não-admin (Home é o 1º item do side
// menu) ou a 1ª sub-aba do módulo p/ admin.
function landing(setores) {
  const mod = setores[0]
  return { tab: mod, sub: setores.includes('admin') ? firstSubTab(mod) : 'home' }
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { const u = window.localStorage?.getItem('valois-user'); return u ? JSON.parse(u) : null } catch { return null }
  })
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  // Splash pós-login (Checkpoint 2). Só aparece após uma ação de login —
  // sessão persistida (refresh) NÃO dispara o splash, preservando o fluxo atual.
  const [showSplash, setShowSplash] = useState(false)
  // Side menu (Checkpoint 4)
  const [subTab, setSubTab] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return window.localStorage?.getItem('valois-sidebar-collapsed') === '1' } catch { return false } })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const topbarRef = useRef(null)
  const [topH, setTopH] = useState(88)

  const handleLogin = (userData) => {
    setUser(userData)
    setShowSplash(true)
    const setores = userData.setores || [userData.setor]
    const { tab, sub } = landing(setores)
    setActiveTab(tab); setSubTab(sub)
    try {
      window.localStorage?.setItem('valois-user', JSON.stringify(userData))
      window.localStorage?.setItem('valois-login-date', new Date().toISOString().split('T')[0])
    } catch {}
  }

  const handleLogout = () => {
    setUser(null); setActiveTab(null); setSubTab(null); setShowSplash(false); setDrawerOpen(false)
    try { window.localStorage?.removeItem('valois-user'); window.localStorage?.removeItem('valois-login-date') } catch {}
  }

  // Logout automático à meia-noite
  useEffect(() => {
    const checkDayChange = () => {
      const loginDate = window.localStorage?.getItem('valois-login-date')
      const today = new Date().toISOString().split('T')[0]
      if (loginDate && loginDate !== today) {
        try { window.sessionStorage?.setItem('valois-sessao-msg', '👋 Bom dia! Por favor, faça login novamente.') } catch {}
        handleLogout()
      }
    }
    checkDayChange()
    const interval = setInterval(checkDayChange, 60000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (user && !activeTab) {
      const setores = user.setores || [user.setor]
      const { tab, sub } = landing(setores)
      setActiveTab(tab); setSubTab(sub)
    }
  }, [user, activeTab])

  const loadData = useCallback(async () => {
    const data = await fetchPedidos(); setPedidos(data); setLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  // Dispara notificações de pedidos atrasados/de hoje 1x por sessão.
  // notificarAtrasos já tem dedup diário por localStorage.
  const notifAtrasoFired = useRef(false)
  useEffect(() => {
    if (!user || notifAtrasoFired.current || pedidos.length === 0) return
    notifAtrasoFired.current = true
    notificarAtrasos(pedidos)
  }, [user, pedidos])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('pedidos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadData])

  // Mede a altura da topbar p/ o sidebar/drawer grudarem logo abaixo dela.
  useEffect(() => {
    if (!user) return
    const measure = () => { if (topbarRef.current) setTopH(topbarRef.current.offsetHeight) }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [user, isMobile])

  const { notifs, toast, setToast, dismiss, dismissAll } = useNotificacoes(user)

  if (!user) return <LoginScreen onLogin={handleLogin} />

  // Splash pós-login: cobre o carregamento inicial dos dados.
  // `ready` = dados já carregados; o componente respeita o mínimo de 1.8s e o teto de 10s.
  if (showSplash) return <LoadingTransition ready={!loading} onDone={() => setShowSplash(false)} />

  // Financeiro é restrito: admin não recebe acesso automático.
  // Para admins acessarem o módulo, precisam ter o setor 'financeiro' explicitamente.
  const userSetoresBase = user.setores || [user.setor]
  const podeRelatorios = RELATORIOS_USERS.includes(user.nome)
  const userSetores = podeRelatorios ? [...userSetoresBase, 'relatorios'] : userSetoresBase
  const podeFinanceiro = userSetoresBase.includes('financeiro')

  const SETOR_ICONS = {
    admin: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    comercial: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>,
    galpao: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    motorista: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    vendedor: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    manutencao: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
    financeiro: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    relatorios: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/></svg>,
  }

  // Label/cor da aba 'relatorios' (não está no SETOR_MAP de db.js)
  const RELATORIOS_TAB = { label: 'Relatórios', icon: '📊', color: '#7C3AED' }

  // ── Side menu (Checkpoint 4) ──
  // Sidebar mostra as sub-abas do módulo ativo. Para não-admin, "Início" é o 1º item.
  const isNonAdmin = !userSetoresBase.includes('admin')
  const goToModule = (m) => { setActiveTab(m); setSubTab(firstSubTab(m)); setDrawerOpen(false) }
  const toggleCollapse = () => setSidebarCollapsed(v => { const nv = !v; try { window.localStorage?.setItem('valois-sidebar-collapsed', nv ? '1' : '0') } catch {} ; return nv })
  let subItems = MODULE_SUBTABS[activeTab] || []
  if (activeTab === 'relatorios' && !TOP50_USERS.includes(user.nome)) subItems = subItems.filter(i => i.key !== 'top50')
  const sidebarItems = isNonAdmin ? [HOME_ITEM, ...subItems] : subItems
  // Badge de exemplo: pedidos atrasados/de hoje na sub-aba "Pedidos" (comercial/admin).
  const atrasadosCount = filtrarAtrasos(pedidos, ['atrasado', 'hoje']).length
  const badges = (activeTab === 'comercial' || activeTab === 'admin') ? { pedidos: atrasadosCount } : {}
  const currentItem = sidebarItems.find(i => i.key === subTab) || sidebarItems[0]
  const moduleLabel = activeTab === 'relatorios' ? 'Relatórios' : (SETOR_MAP[activeTab]?.label || '')

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: 'var(--background)', minHeight: '100vh', color: 'var(--text-primary)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <NotifToast toast={toast} onDismiss={() => setToast(null)} />

      <div ref={topbarRef} style={{ background: 'color-mix(in srgb, var(--valois-blue-dark) 92%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '10px 16px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Logo oficial (mesma do login) sobre chip branco: a logo foi desenhada p/
                  fundo claro (VA azul + tagline azul), que na topbar navy fica ~1.3:1 de
                  contraste. O chip devolve o fundo claro e garante contraste total. */}
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-control)', padding: '6px 12px', display: 'flex', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}>
                <img src="/logo-valois.png" alt="Valois Logística" style={{ height: 28, width: 'auto', display: 'block' }} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 500 }}>{user.nome}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'capitalize' }}>{(user.setores||[user.setor])[0]}</div>
              </div>
              <EloBadgeAuto user={user} pedidos={pedidos}/>
              <AvatarCircle user={user} size={34} onClick={() => setShowAvatarPicker(true)} />
              <NotifBell notifs={notifs} dismiss={dismiss} dismissAll={dismissAll} />
              <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Sair</button>
            </div>
            {showAvatarPicker && <AvatarPickerModal user={user} onClose={() => setShowAvatarPicker(false)} onSaved={u => { setUser(u); try { window.localStorage?.setItem('valois-user', JSON.stringify(u)) } catch {} }} />}
          </div>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 3, overflowX: 'auto' }}>
              {userSetores.map(s => {
                const info = s === 'relatorios' ? RELATORIOS_TAB : (SETOR_MAP[s] || SETOR_MAP.comercial)
                const isActive = activeTab === s
                return (
                  <button key={s} onClick={() => goToModule(s)} style={{
                    flex: '0 0 auto', padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#0F172A' : 'rgba(255,255,255,0.65)',
                    fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: "'Inter',sans-serif",
                    transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap'
                  }}>{SETOR_ICONS[s] || info.icon} {info.label}</button>
                )
              })}
            </div>
        </div>
      </div>

      {/* Mobile: barra-gatilho + drawer (reaproveita a mesma lista do sidebar) */}
      {isMobile && <MobileSubnavBar label={currentItem?.label} icon={currentItem?.icon} onOpen={() => setDrawerOpen(true)} top={topH} />}
      <MobileDrawer open={isMobile && drawerOpen} onClose={() => setDrawerOpen(false)} items={sidebarItems} active={subTab} onSelect={setSubTab} badges={badges} title={moduleLabel} />

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'flex-start' }}>
        {/* Desktop: sidebar fixo */}
        {!isMobile && <Sidebar items={sidebarItems} active={subTab} onSelect={setSubTab} badges={badges} collapsed={sidebarCollapsed} onToggleCollapse={toggleCollapse} top={topH} />}
        <div style={{ flex: 1, minWidth: 0, padding: 16 }}>
          {loading && activeTab !== 'vendedor' && subTab !== 'home' ? <Loader /> : (
            <>
              {subTab === 'home' && <HomePage user={user} onNavigate={goToModule} />}
              {subTab !== 'home' && activeTab === 'admin' && <AdminView tab={subTab} setTab={setSubTab} pedidos={pedidos} refresh={loadData} user={user} notifs={notifs} />}
              {subTab !== 'home' && activeTab === 'comercial' && <ComercialView tab={subTab} pedidos={pedidos} refresh={loadData} user={user} />}
              {subTab !== 'home' && activeTab === 'galpao' && <GalpaoView tab={subTab} pedidos={pedidos} refresh={loadData} user={user} />}
              {subTab !== 'home' && activeTab === 'motorista' && <MotoristaView tab={subTab} pedidos={pedidos} refresh={loadData} user={user} />}
              {subTab !== 'home' && activeTab === 'vendedor' && <VendedorView tab={subTab} user={user} pedidos={pedidos} />}
              {subTab !== 'home' && activeTab === 'manutencao' && <ManutencaoView tab={subTab} user={user} />}
              {subTab !== 'home' && activeTab === 'financeiro' && (podeFinanceiro
                ? <FinanceiroView tab={subTab} user={user} />
                : <div style={{ padding: 40, textAlign: 'center', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, color: '#991B1B', fontWeight: 600 }}>🔒 Acesso restrito ao setor financeiro</div>
              )}
              {subTab !== 'home' && activeTab === 'relatorios' && (podeRelatorios
                ? <RelatoriosView sub={subTab} user={user} />
                : <div style={{ padding: 40, textAlign: 'center', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 12, color: '#991B1B', fontWeight: 600 }}>🔒 Acesso restrito</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
