import { useState } from 'react'
import { supabase } from './supabase.js'

export const AVATARES = [
  { id: '🧹', label: 'Vassoura' }, { id: '🧽', label: 'Esponja' },
  { id: '🧴', label: 'Sabonete' }, { id: '🫧', label: 'Bolhas' },
  { id: '🧼', label: 'Sabão' }, { id: '🪣', label: 'Balde' },
  { id: '🧤', label: 'Luvas' }, { id: '🫗', label: 'Derramando' },
  { id: '🧻', label: 'Papel' }, { id: '🪥', label: 'Escova' },
  { id: '💧', label: 'Gota' }, { id: '✨', label: 'Brilho' },
  { id: '🌊', label: 'Onda' }, { id: '🧪', label: 'Ensaio' },
  { id: '🔬', label: 'Microscópio' }, { id: '🛁', label: 'Banheira' },
]

const COLORS = ['#DBEAFE', '#D1FAE5', '#FDE68A', '#FCE7F3', '#EDE9FE', '#FEE2E2', '#E0F2FE', '#F0FDF4']

export function getAvatarColor(nome) {
  if (!nome) return '#E2E8F0'
  let h = 0; for (let i = 0; i < nome.length; i++) h += nome.charCodeAt(i)
  return COLORS[h % COLORS.length]
}

// Avatar do usuário logado (recebe o objeto user completo)
export function AvatarCircle({ user, size = 36, onClick }) {
  const bg = getAvatarColor(user?.nome)
  return (
    <div onClick={onClick} style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: user?.avatar ? size * 0.58 : size * 0.44, fontWeight: 700, color: '#475569', cursor: onClick ? 'pointer' : 'default', border: '2px solid rgba(255,255,255,0.2)', userSelect: 'none' }}>
      {user?.avatar || user?.nome?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// Avatar por nome + emoji (para listas e rankings)
// rank: 0=ouro, 1=prata, 2=bronze, undefined=sem borda
export function AvatarByNome({ nome, avatar, size = 32, rank }) {
  const bg = getAvatarColor(nome)
  const borderColor = rank === 0 ? '#F59E0B' : rank === 1 ? '#94A3B8' : rank === 2 ? '#B45309' : null
  const extraStyle = borderColor ? { border: `3px solid ${borderColor}`, boxShadow: `0 0 8px ${borderColor}55` } : {}
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: avatar ? size * 0.58 : size * 0.44, fontWeight: 700, color: '#475569', userSelect: 'none', ...extraStyle }}>
      {avatar || nome?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

// Modal de seleção de avatar
export function AvatarPickerModal({ user, onClose, onSaved }) {
  const [selected, setSelected] = useState(user?.avatar || null)
  const [saving, setSaving] = useState(false)

  const salvar = async () => {
    setSaving(true)
    const { error } = await supabase.from('usuarios').update({ avatar: selected }).eq('id', user.id)
    if (error) { alert('Erro ao salvar: ' + error.message); setSaving(false); return }
    onSaved({ ...user, avatar: selected })
    setSaving(false); onClose()
  }

  return (
    <>
      <style>{`.avp-btn{transition:all 0.15s}.avp-btn:hover{transform:scale(1.1);box-shadow:0 4px 14px rgba(0,0,0,0.15)!important}`}</style>
      <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99998 }}/>
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 99999, background: '#fff', borderRadius: 20, width: '90%', maxWidth: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
        {/* Cabeçalho fixo */}
        <div style={{ padding: '20px 24px 12px', position: 'relative', flexShrink: 0 }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8', lineHeight: 1, padding: 4 }}>✕</button>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A1628', textAlign: 'center' }}>Escolha seu avatar</h3>
          <p style={{ fontSize: 12, color: '#64748B', margin: '6px 0 0', textAlign: 'center' }}>Escolha um emoji para representar você</p>
        </div>
        {/* Grid com scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px', scrollbarWidth: 'thin', scrollbarColor: '#CBD5E1 transparent' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {AVATARES.map(a => {
              const sel = selected === a.id
              return (
                <button key={a.id} onClick={() => setSelected(a.id)} className="avp-btn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, background: sel ? '#DBEAFE' : '#F8FAFC', border: `3px solid ${sel ? '#3B82F6' : 'transparent'}`, borderRadius: 16, padding: 0, cursor: 'pointer', fontFamily: 'inherit', width: '100%', height: 72, boxShadow: sel ? '0 4px 12px rgba(59,130,246,0.3)' : 'none' }}>
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{a.id}</span>
                  <span style={{ fontSize: 9, color: sel ? '#1D4ED8' : '#64748B', fontWeight: 500 }}>{a.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        {/* Rodapé fixo */}
        <div style={{ padding: '12px 24px 20px', borderTop: '1px solid #F1F5F9', flexShrink: 0, display: 'flex', gap: 8 }}>
          {user?.avatar && <button onClick={() => setSelected(null)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Remover avatar</button>}
          <button onClick={salvar} disabled={saving} style={{ flex: 2, height: 42, borderRadius: 10, border: 'none', background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '✓ Salvar avatar'}</button>
        </div>
      </div>
    </>
  )
}
