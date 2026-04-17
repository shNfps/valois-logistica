import { useState } from 'react'
import { inputStyle, btnPrimary, btnSmall } from './db.js'

const OS_TIPO_ICON = { instalacao: '🔧', manutencao: '⚙️', troca: '🔄', desinstalacao: '❌' }
const OS_TIPO_LABEL = { instalacao: 'Instalação', manutencao: 'Manutenção', troca: 'Troca', desinstalacao: 'Desinstalação' }
const PERIODO_LABEL = { manha: '☀️ Manhã', tarde: '🌅 Tarde', dia_todo: '📅 Dia todo' }
const STATUS_COLORS = {
  AGENDADA: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  EM_ANDAMENTO: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  CONCLUIDA: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  CANCELADA: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
}

function InfoRow({ icon, label, value }) {
  if (!value) return null
  return <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 13 }}>
    <span style={{ flexShrink: 0 }}>{icon}</span>
    <div><div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>{label}</div><div style={{ color: '#0A1628', fontWeight: 500 }}>{value}</div></div>
  </div>
}

export function OSDetalhePanel({ os, user, onClose, onAprovar, onReagendar, onIniciar, onConcluir, onCancelar, onObs }) {
  const [showObs, setShowObs] = useState(false)
  const [obsTexto, setObsTexto] = useState('')
  const sc = STATUS_COLORS[os.status] || STATUS_COLORS.AGENDADA

  const handleSaveObs = () => {
    if (!obsTexto.trim()) return
    onObs(os, obsTexto.trim())
    setObsTexto(''); setShowObs(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 180 }} />
      {/* Panel */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 420, background: '#fff', zIndex: 190, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B', padding: 0, lineHeight: 1 }}>✕</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18 }}>{OS_TIPO_ICON[os.tipo]}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0A1628' }}>{OS_TIPO_LABEL[os.tipo]}</span>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>{os.numero_os}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{os.status.replace('_', ' ')}</span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <InfoRow icon="👤" label="Cliente" value={os.cliente_nome} />
          <InfoRow icon="📍" label="Endereço" value={[os.endereco, os.cidade].filter(Boolean).join(' - ')} />
          <InfoRow icon="📦" label="Equipamento" value={os.equipamento_tipo} />
          <InfoRow icon="📅" label="Data agendada" value={`${new Date(os.data_agendada).toLocaleDateString('pt-BR')} · ${PERIODO_LABEL[os.periodo]}`} />
          <InfoRow icon="👷" label="Solicitado por" value={os.solicitante_nome} />
          {os.tecnico_nome && <InfoRow icon="🔧" label="Técnico" value={os.tecnico_nome} />}
          <InfoRow icon="🕐" label="Criado em" value={os.criado_em ? new Date(os.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : null} />

          {/* Descrição */}
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, marginBottom: 14, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Descrição do serviço</div>
            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{os.descricao}</div>
          </div>

          {/* Foto do problema */}
          {os.foto_antes && (
            <div style={{ marginBottom: 14, background: '#FFF7ED', borderRadius: 10, padding: 12, border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>📷 Foto do problema (enviada pelo solicitante)</div>
              <img src={os.foto_antes} onClick={() => window.open(os.foto_antes, '_blank')} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer' }} />
            </div>
          )}

          {/* Observações */}
          {os.observacao_conclusao && (
            <div style={{ background: '#F1F5F9', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>📝 Observações</div>
              <div style={{ fontSize: 12, color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{os.observacao_conclusao}</div>
            </div>
          )}

          {/* Inline note */}
          {showObs && (
            <div style={{ marginBottom: 14, display: 'flex', gap: 6 }}>
              <input value={obsTexto} onChange={e => setObsTexto(e.target.value)} placeholder="Adicionar observação..." style={{ ...inputStyle, flex: 1, height: 36, fontSize: 12 }} onKeyDown={e => e.key === 'Enter' && handleSaveObs()} autoFocus />
              <button onClick={handleSaveObs} style={{ ...btnSmall, background: '#0A1628', color: '#fff', border: 'none', fontSize: 11 }}>OK</button>
              <button onClick={() => setShowObs(false)} style={{ ...btnSmall, fontSize: 11 }}>✗</button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {['AGENDADA', 'EM_ANDAMENTO'].includes(os.status) && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {os.status === 'AGENDADA' && !os.tecnico_nome && <button onClick={() => onAprovar(os)} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 12, flex: 1 }}>✅ Aprovar</button>}
              {os.status === 'AGENDADA' && <button onClick={() => onReagendar(os)} style={{ ...btnSmall, background: '#F59E0B', color: '#fff', border: 'none', fontSize: 12, flex: 1 }}>📅 Reagendar</button>}
              {os.status === 'AGENDADA' && <button onClick={() => onIniciar(os)} style={{ ...btnSmall, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 12, flex: 1 }}>▶ Iniciar</button>}
              {os.status === 'EM_ANDAMENTO' && <button onClick={() => onConcluir(os)} style={{ ...btnPrimary, background: '#10B981', fontSize: 12, flex: 2 }}>✓ Concluir</button>}
              <button onClick={() => setShowObs(true)} style={{ ...btnSmall, fontSize: 12 }}>📝 Nota</button>
              <button onClick={() => onCancelar(os)} style={{ ...btnSmall, color: '#EF4444', fontSize: 12 }}>✗ Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
