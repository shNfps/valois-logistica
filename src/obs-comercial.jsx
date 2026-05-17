import { useState } from 'react'
import { inputStyle, btnPrimary, btnSmall, updatePedido, addHistorico } from './db.js'

const MAX_OBS = 300

export const CHIPS = [
  { emoji: '🚨', label: 'Urgente', text: '🚨 URGENTE' },
  { emoji: '⚡', label: 'Separar rápido', text: '⚡ Separar rápido' },
  { emoji: '📦', label: 'Itens já enviados', text: '📦 Itens já enviados' },
  { emoji: '⏰', label: 'Entrega prioridade', text: '⏰ Entrega prioridade' },
  { emoji: '🚗', label: 'Cliente buscar', text: '🚗 Cliente buscar' }
]

export const isUrgente = (txt) => {
  if (!txt) return false
  const s = String(txt).toUpperCase()
  return s.includes('URGENTE') || s.includes('🚨')
}

const pulseCss = `@keyframes obs-pulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.55)}50%{box-shadow:0 0 0 10px rgba(245,158,11,0)}}`

// Banner exibido no galpão (grande, com pulse se URGENTE)
export function ObsComercialBanner({ texto, large = false }) {
  if (!texto) return null
  const urgent = isUrgente(texto)
  const padding = large ? '14px 16px' : '10px 12px'
  const fontSize = large ? 15 : 13
  const animation = (large && urgent) ? 'obs-pulse 1.4s ease-in-out infinite' : 'none'
  return (
    <div style={{
      background: '#FEF3C7', borderLeft: '4px solid #F59E0B', borderRadius: 10,
      padding, marginBottom: 10, color: '#78350F', fontWeight: 700, fontSize,
      animation, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
    }}>
      <style>{pulseCss}</style>
      <div style={{ fontSize: large ? 12 : 11, fontWeight: 700, letterSpacing: 0.5, color: '#92400E', marginBottom: 4, textTransform: 'uppercase' }}>📢 Observação do comercial</div>
      <div>{texto}</div>
    </div>
  )
}

// Versão compacta para listas (admin, comercial, motorista)
export function ObsComercialInline({ texto }) {
  if (!texto) return null
  return (
    <div style={{ background: '#FEF3C7', borderLeft: '3px solid #F59E0B', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#78350F', marginBottom: 8, fontWeight: 600 }}>
      📢 {texto}
    </div>
  )
}

function ChipBtn({ chip, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 999, border: '1px solid #FDE68A', background: '#FFFBEB',
      color: '#78350F', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap'
    }}>{chip.emoji} {chip.label}</button>
  )
}

// Textarea + chips para o formulário do comercial
export function ObsComercialInput({ value, onChange }) {
  const append = (txt) => {
    const sep = value && !value.endsWith('\n') && !value.endsWith(' ') ? ' ' : ''
    const next = (value + sep + txt).slice(0, MAX_OBS)
    onChange(next)
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>📢 Observação para o galpão (opcional)</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {CHIPS.map(c => <ChipBtn key={c.label} chip={c} onClick={() => append(c.text)} />)}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value.slice(0, MAX_OBS))}
        rows={3}
        maxLength={MAX_OBS}
        placeholder="Ex: separar rápido, produto X já foi, urgente..."
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: 14, color: '#0F172A', outline: 'none', resize: 'vertical', fontFamily: "'Inter',sans-serif" }}
      />
      <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 2 }}>{value.length}/{MAX_OBS}</div>
    </div>
  )
}

// Modal de edição (usado pelo comercial enquanto pedido está PENDENTE)
export function ObsEditModal({ pedido, user, onClose, onSaved }) {
  const [texto, setTexto] = useState(pedido.obs_comercial || '')
  const [saving, setSaving] = useState(false)
  const salvar = async () => {
    setSaving(true)
    const novo = texto.trim() || null
    const antigo = pedido.obs_comercial || ''
    await updatePedido(pedido.id, { obs_comercial: novo })
    if ((antigo || '') !== (novo || '')) {
      const acao = novo
        ? (antigo ? `Editou observação: ${novo}` : `Adicionou observação: ${novo}`)
        : 'Removeu observação do comercial'
      await addHistorico(pedido.id, user.nome, acao)
    }
    setSaving(false); onSaved && onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 22 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, color: '#0A1628', fontWeight: 700 }}>✏️ Editar observação para o galpão</h3>
        <ObsComercialInput value={texto} onChange={setTexto} />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center', padding: '12px' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
