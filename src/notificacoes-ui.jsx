import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { fetchNotificacoes, marcarLida, marcarTodasLidas } from './notificacoes.js'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(); osc.stop(ctx.currentTime + 0.35)
  } catch (e) {}
}

export function fmtRelativo(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export function useNotificacoes(user) {
  const [notifs, setNotifs] = useState([])
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    if (!user) return
    const userSetor = (user.setores || [user.setor])[0]
    setNotifs(await fetchNotificacoes(user.nome, userSetor))
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user) return
    const userSetores = user.setores || [user.setor]
    const isAdmin = userSetores.includes('admin')
    const ch = supabase.channel('notif-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, ({ new: n }) => {
        const relevant = isAdmin || userSetores.includes(n.setor_destino) || n.usuario_destino === user.nome
        if (!relevant) return
        setNotifs(prev => [n, ...prev])
        setToast(n)
        playBeep()
        setTimeout(() => setToast(t => t?.id === n.id ? null : t), 5000)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user])

  const dismiss = async (id) => {
    await marcarLida(id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  const dismissAll = async () => {
    const userSetor = (user?.setores || [user?.setor])[0]
    await marcarTodasLidas(user?.nome, userSetor)
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
  }

  return { notifs, toast, setToast, dismiss, dismissAll }
}

export function NotifToast({ toast, onDismiss }) {
  if (!toast) return null
  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 400, zIndex: 9999, pointerEvents: 'none' }}>
      <div style={{ background: '#0A1628', color: '#fff', borderRadius: 12, padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-start', gap: 10, pointerEvents: 'auto' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{toast.titulo}</div>
          <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.4 }}>{toast.mensagem}</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0, marginTop: -1 }}>✕</button>
      </div>
    </div>
  )
}

export function NotifBell({ notifs, dismiss, dismissAll }) {
  const [open, setOpen] = useState(false)
  const naoLidas = notifs.filter(n => !n.lida).length

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', position: 'relative', lineHeight: 1 }}>
        <span style={{ fontSize: 19 }}>🔔</span>
        {naoLidas > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: '#EF4444', color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', lineHeight: 1 }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 149 }} />
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 300, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 150, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>
                Notificações {naoLidas > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', marginLeft: 4 }}>{naoLidas}</span>}
              </span>
              {naoLidas > 0 && (
                <button onClick={dismissAll} style={{ background: 'none', border: 'none', fontSize: 11, color: '#3B82F6', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  ✓ Marcar todas como lidas
                </button>
              )}
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifs.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Nenhuma notificação</div>
              )}
              {notifs.map(n => (
                <div key={n.id} onClick={() => dismiss(n.id)}
                  style={{ padding: '11px 14px', background: n.lida ? '#fff' : '#EFF6FF', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = n.lida ? '#fff' : '#EFF6FF'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0A1628', marginBottom: 2 }}>{n.titulo}</div>
                      <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>{n.mensagem}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtRelativo(n.criado_em)}</span>
                      {!n.lida && <span style={{ width: 7, height: 7, background: '#3B82F6', borderRadius: '50%', display: 'inline-block' }} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
