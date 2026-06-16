import { useState, useRef } from 'react'
import { inputStyle, btnPrimary, btnSmall } from './db.js'
import { uploadFotoManutencao } from './manutencao-db.js'
import { formatData } from './manutencao-shared.js'

const hojeStr = () => new Date().toISOString().slice(0, 10)

// Aceite da OS: técnico escolhe data no calendário + período (fluxo aceite-primeiro).
export function AceitarModal({ os, onClose, onConfirm }) {
  const [data, setData] = useState('')
  const [periodo, setPeriodo] = useState('manha')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!data) { alert('Selecione a data do atendimento'); return }
    setSaving(true)
    await onConfirm(os.id, data, periodo)
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#065F46' }}>✅ Aceitar OS {os.numero_os}</h3>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>{os.cliente_nome}{os.cidade ? ` · ${os.cidade}` : ''}</div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Data do atendimento *</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)} min={hojeStr()} style={{ ...inputStyle, marginBottom: 12 }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Período</label>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
          <option value="manha">Manhã</option>
          <option value="tarde">Tarde</option>
          <option value="dia_todo">Dia todo</option>
        </select>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={saving} style={{ ...btnPrimary, flex: 2, background: '#10B981', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '✅ Aceitar e agendar'}</button>
        </div>
      </div>
    </div>
  )
}

export function ConcluirModal({ os, onClose, onConfirm }) {
  const [obs, setObs] = useState('')
  const [foto, setFoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fRef = useRef(null)

  const handleConfirm = async () => {
    if (!foto) { alert('A foto do serviço resolvido é obrigatória'); return }
    setUploading(true)
    const fotoUrl = await uploadFotoManutencao(foto)
    await onConfirm(os.id, obs, fotoUrl, os.equipamento_id)
    setUploading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Concluir OS {os.numero_os}</h3>
        <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações da conclusão..." rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />

        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" ref={fRef} onChange={e => setFoto(e.target.files[0])} style={{ display: 'none' }} />
        <button onClick={() => fRef.current.click()} style={{ ...btnSmall, width: '100%', justifyContent: 'center', marginBottom: 8, color: foto ? '#10B981' : '#64748B', borderColor: foto ? '#A7F3D0' : '#E2E8F0' }}>
          {foto ? `✓ ${foto.name}` : '📷 Foto do serviço resolvido (obrigatório) *'}
        </button>
        {!foto && <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 12, textAlign: 'center' }}>A foto do serviço resolvido é obrigatória</div>}
        {foto && <div style={{ marginBottom: 12, textAlign: 'center' }}><img src={URL.createObjectURL(foto)} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} /></div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={uploading} style={{ ...btnPrimary, flex: 2, opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Salvando...' : '✓ Concluir OS'}</button>
        </div>
      </div>
    </div>
  )
}

export function ReagendarModal({ os, onClose, onConfirm }) {
  const [novaData, setNovaData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!novaData) { alert('Selecione a nova data'); return }
    if (!motivo.trim()) { alert('Informe o motivo do reagendamento'); return }
    setSaving(true)
    await onConfirm(os.id, novaData, motivo.trim())
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>📅 Reagendar OS {os.numero_os}</h3>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
          Data atual: <b>{formatData(os.data_agendada) || '—'}</b> · {os.cliente_nome}
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Nova data *</label>
        <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Motivo *</label>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Cliente indisponível, falta de peça..." rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={saving} style={{ ...btnPrimary, flex: 2, background: '#F59E0B', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '📅 Reagendar'}</button>
        </div>
      </div>
    </div>
  )
}

export function CancelarModal({ os, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!motivo.trim()) { alert('Informe o motivo do cancelamento'); return }
    setSaving(true)
    await onConfirm(os.id, motivo.trim())
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#EF4444' }}>❌ Cancelar OS {os.numero_os}</h3>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{os.cliente_nome}{os.data_agendada ? ` · ${formatData(os.data_agendada)}` : ''}</div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Motivo do cancelamento *</label>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo..." rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Voltar</button>
          <button onClick={handleConfirm} disabled={saving} style={{ ...btnPrimary, flex: 2, background: '#EF4444', opacity: saving ? 0.6 : 1 }}>{saving ? 'Cancelando...' : '❌ Confirmar Cancelamento'}</button>
        </div>
      </div>
    </div>
  )
}
