import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { SETOR_MAP, fetchPedidos } from './db.js'
import { Loader, LoginScreen } from './components.jsx'
import { AdminView } from './views.jsx'
import { ComercialView, GalpaoView, VendedorView } from './views2.jsx'
import { MotoristaView } from './views5.jsx'
import { useNotificacoes, NotifBell, NotifToast } from './notificacoes-ui.jsx'
import { AvatarCircle, AvatarPickerModal } from './avatar.jsx'
import { EloBadgeAuto } from './performance-rank.jsx'

export default function App() {
  const [user, setUser] = useState(() => {
    try { const u = window.localStorage?.getItem('valois-user'); return u ? JSON.parse(u) : null } catch { return null }
  })
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  const handleLogin = (userData) => {
    setUser(userData)
    const setores = userData.setores || [userData.setor]
    setActiveTab(setores[0])
    try { window.localStorage?.setItem('valois-user', JSON.stringify(userData)) } catch {}
  }

  const handleLogout = () => {
    setUser(null); setActiveTab(null)
    try { window.localStorage?.removeItem('valois-user') } catch {}
  }

  useEffect(() => {
    if (user && !activeTab) {
      const setores = user.setores || [user.setor]
      setActiveTab(setores[0])
    }
  }, [user, activeTab])

  const loadData = useCallback(async () => {
    const data = await fetchPedidos(); setPedidos(data); setLoading(false)
  }, [])

  useEffect(() => { if (user) loadData() }, [user, loadData])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('pedidos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadData])

  const { notifs, toast, setToast, dismiss, dismissAll } = useNotificacoes(user)

  if (!user) return <LoginScreen onLogin={handleLogin} />

  const userSetores = user.setores || [user.setor]

  const SETOR_ICONS = {
    admin: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
    comercial: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>,
    galpao: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
    motorista: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    vendedor: <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#F8FAFC', minHeight: '100vh', color: '#0F172A' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <NotifToast toast={toast} onDismiss={() => setToast(null)} />

      <div style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '10px 16px', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: userSetores.length > 1 ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
                <rect width="32" height="32" rx="8" fill="#0F172A" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                <text x="3" y="20" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="9.5" fill="#2563EB">VA</text>
                <text x="15" y="20" fontFamily="Inter,sans-serif" fontWeight="800" fontSize="9.5" fill="#10B981">LOIS</text>
                <rect x="3" y="23" width="26" height="2" rx="1" fill="#10B981" opacity="0.7"/>
              </svg>
              <div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1.5, lineHeight: 1.1 }}>
                  <span style={{ color: '#2563EB' }}>VA</span><span style={{ color: '#10B981' }}>LOIS</span>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 8, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' }}>Logística</div>
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
          {userSetores.length > 1 && (
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 999, padding: 3, overflowX: 'auto' }}>
              {userSetores.map(s => {
                const info = SETOR_MAP[s] || SETOR_MAP.comercial
                const isActive = activeTab === s
                return (
                  <button key={s} onClick={() => setActiveTab(s)} style={{
                    flex: '0 0 auto', padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#0F172A' : 'rgba(255,255,255,0.65)',
                    fontSize: 11, fontWeight: isActive ? 600 : 400, fontFamily: "'Inter',sans-serif",
                    transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap'
                  }}>{SETOR_ICONS[s] || info.icon} {info.label}</button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
        {loading && activeTab !== 'vendedor' ? <Loader /> : (
          <>
            {activeTab === 'admin' && <AdminView pedidos={pedidos} refresh={loadData} user={user} notifs={notifs} />}
            {activeTab === 'comercial' && <ComercialView pedidos={pedidos} refresh={loadData} user={user} />}
            {activeTab === 'galpao' && <GalpaoView pedidos={pedidos} refresh={loadData} user={user} />}
            {activeTab === 'motorista' && <MotoristaView pedidos={pedidos} refresh={loadData} user={user} />}
            {activeTab === 'vendedor' && <VendedorView user={user} pedidos={pedidos} />}
          </>
        )}
      </div>
    </div>
  )
}
