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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Escolher Avatar</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px' }}>Escolha um emoji para representar você no sistema</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {AVATARES.map(a => (
            <button key={a.id} onClick={() => setSelected(a.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: selected === a.id ? '#DBEAFE' : '#F8FAFC', border: `2px solid ${selected === a.id ? '#3B82F6' : 'transparent'}`, borderRadius: 12, padding: '10px 4px', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{a.id}</span>
              <span style={{ fontSize: 9, color: '#64748B', fontWeight: 500 }}>{a.label}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user?.avatar && <button onClick={() => setSelected(null)} style={{ flex: 1, height: 42, borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Remover avatar</button>}
          <button onClick={salvar} disabled={saving} style={{ flex: 2, height: 42, borderRadius: 10, border: 'none', background: '#0F172A', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '✓ Salvar avatar'}</button>
        </div>
      </div>
    </div>
  )
}
