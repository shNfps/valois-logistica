import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { SETOR_MAP, fetchPedidos } from './db.js'
import { Loader, LoginScreen } from './components.jsx'
import { AdminView } from './views.jsx'
import { ComercialView, GalpaoView, VendedorView } from './views2.jsx'
import { MotoristaView } from './views5.jsx'

export default function App() {
  const [user, setUser] = useState(() => {
    try { const u = window.localStorage?.getItem('valois-user'); return u ? JSON.parse(u) : null } catch { return null }
  })
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(null)

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

  if (!user) return <LoginScreen onLogin={handleLogin} />

  const userSetores = user.setores || [user.setor]
  const setor = SETOR_MAP[activeTab] || SETOR_MAP.comercial

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#F1F5F9', minHeight: '100vh', color: '#0A1628' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ background: '#0A1628', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: userSetores.length > 1 ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo_2025.png" style={{ height: 32, width: 'auto', objectFit: 'contain' }} alt="V" onError={e => { e.target.outerHTML = '<div style="width:32px;height:32px;borderRadius:8px;background:linear-gradient(135deg,#1E3A5F,#3B82F6);display:flex;alignItems:center;justifyContent:center;fontWeight:800;color:#fff;fontSize:15px">V</div>' }} />
              <div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.1 }}>VALOIS</div>
                <div style={{ color: '#64748B', fontSize: 9, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' }}>Logística</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{user.nome}</div>
              </div>
              <button onClick={handleLogout} style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', color: '#94A3B8', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sair</button>
            </div>
          </div>
          {userSetores.length > 1 && (
            <div style={{ display: 'flex', gap: 3, background: '#1E293B', borderRadius: 10, padding: 3, overflowX: 'auto' }}>
              {userSetores.map(s => {
                const info = SETOR_MAP[s] || SETOR_MAP.comercial
                return (
                  <button key={s} onClick={() => setActiveTab(s)} style={{
                    flex: '0 0 auto', padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: activeTab === s ? info.color : 'transparent',
                    color: activeTab === s ? '#fff' : '#94A3B8',
                    fontSize: 11, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                  }}>{info.icon} {info.label}</button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px' }}>
        {loading && activeTab !== 'vendedor' ? <Loader /> : (
          <>
            {activeTab === 'admin' && <AdminView pedidos={pedidos} refresh={loadData} user={user} />}
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
