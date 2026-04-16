import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'
import { inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchOrdensServico, iniciarOS, concluirOS, cancelarOS, uploadFotoManutencao } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'

const OS_TIPO_ICON = { instalacao: '🔧', manutencao: '⚙️', troca: '🔄', desinstalacao: '❌' }
const OS_TIPO_LABEL = { instalacao: 'Instalação', manutencao: 'Manutenção', troca: 'Troca', desinstalacao: 'Desinstalação' }
const PERIODO_LABEL = { manha: '☀️ Manhã', tarde: '🌅 Tarde', dia_todo: '📅 Dia todo' }
const STATUS_COLORS = {
  AGENDADA: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  EM_ANDAMENTO: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  CONCLUIDA: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  CANCELADA: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
}

function getWeekDays(offset = 0) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay() + offset * 7)
  start.setHours(0, 0, 0, 0)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtDia(d) {
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return DIAS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
}

function OSBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.AGENDADA
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status.replace('_', ' ')}</span>
}

function ConcluirModal({ os, onClose, onConfirm }) {
  const [obs, setObs] = useState('')
  const [foto, setFoto] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fRef = useRef(null)
  const handleConfirm = async () => {
    setUploading(true)
    let fotoUrl = null
    if (foto) fotoUrl = await uploadFotoManutencao(foto)
    await onConfirm(os.id, obs, fotoUrl, os.equipamento_id)
    setUploading(false)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Concluir OS {os.numero_os}</h3>
        <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Observações da conclusão..." rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />
        <input type="file" accept="image/*" ref={fRef} onChange={e => setFoto(e.target.files[0])} style={{ display: 'none' }} />
        <button onClick={() => fRef.current.click()} style={{ ...btnSmall, width: '100%', justifyContent: 'center', marginBottom: 16, color: foto ? '#10B981' : '#64748B' }}>
          {foto ? `✓ ${foto.name}` : '📷 Foto depois (opcional)'}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={uploading} style={{ ...btnPrimary, flex: 2, opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Salvando...' : '✓ Concluir OS'}</button>
        </div>
      </div>
    </div>
  )
}

export function ManutencaoAgendaTab({ user }) {
  const [ordens, setOrdens] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [concluindo, setConcluindo] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setOrdens(await fetchOrdensServico())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel('os-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const days = getWeekDays(weekOffset)
  const hoje = new Date()

  const handleIniciar = async (os) => {
    await iniciarOS(os.id, user.nome)
    await criarNotificacao(os.solicitante_nome, `⚙️ OS ${os.numero_os} iniciada`, `Técnico ${user.nome} iniciou o serviço em ${os.cliente_nome}`)
    load()
  }

  const handleConcluir = async (osId, obs, fotoUrl, eqId) => {
    await concluirOS(osId, obs, fotoUrl, eqId)
    const os = ordens.find(o => o.id === osId)
    if (os) {
      await criarNotificacao(os.solicitante_nome, `✅ OS ${os.numero_os} concluída`, `Serviço em ${os.cliente_nome} finalizado por ${user.nome}`)
      await criarNotificacao('admin', `✅ OS ${os.numero_os} concluída`, `${os.cliente_nome} · ${user.nome}`)
    }
    setConcluindo(null)
    load()
  }

  const handleCancelar = async (os) => {
    if (!confirm(`Cancelar OS ${os.numero_os}?`)) return
    await cancelarOS(os.id)
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando agenda...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={btnSmall}>← Anterior</button>
        <button onClick={() => setWeekOffset(0)} style={{ ...btnSmall, fontWeight: 700 }}>Hoje</button>
        <button onClick={() => setWeekOffset(w => w + 1)} style={btnSmall}>Próxima →</button>
      </div>

      {days.map(day => {
        const key = day.toISOString().slice(0, 10)
        const isHoje = isSameDay(day, hoje)
        const osDay = ordens.filter(o => o.data_agendada === key && o.status !== 'CANCELADA')

        return (
          <div key={key} style={{ ...card, padding: 0, marginBottom: 10, border: isHoje ? '2px solid #F97316' : '1px solid rgba(226,232,240,0.8)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: isHoje ? '#FFF7ED' : '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isHoje ? '#EA580C' : '#334155' }}>{isHoje && '📌 '}{fmtDia(day)}</span>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{osDay.length} OS</span>
            </div>
            {osDay.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>Sem serviços agendados</div>
            ) : osDay.map(os => (
              <div key={os.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{OS_TIPO_ICON[os.tipo]}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', flex: 1 }}>{os.cliente_nome}</span>
                  <OSBadge status={os.status} />
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>
                  {OS_TIPO_LABEL[os.tipo]} · {PERIODO_LABEL[os.periodo]} · <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>{os.numero_os}</span>
                </div>
                {os.equipamento_tipo && <div style={{ fontSize: 11, color: '#64748B' }}>📦 {os.equipamento_tipo}</div>}
                {(os.endereco || os.cidade) && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>📍 {[os.endereco, os.cidade].filter(Boolean).join(' - ')}</div>}
                <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>{os.descricao}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {os.status === 'AGENDADA' && <button onClick={() => handleIniciar(os)} style={{ ...btnSmall, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 11 }}>▶ Iniciar</button>}
                  {os.status === 'EM_ANDAMENTO' && <button onClick={() => setConcluindo(os)} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 11 }}>✓ Concluir</button>}
                  {['AGENDADA', 'EM_ANDAMENTO'].includes(os.status) && <button onClick={() => handleCancelar(os)} style={{ ...btnSmall, color: '#EF4444', fontSize: 11 }}>✗ Cancelar</button>}
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {concluindo && <ConcluirModal os={concluindo} onClose={() => setConcluindo(null)} onConfirm={handleConcluir} />}
    </div>
  )
}
