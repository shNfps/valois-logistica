import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchOrdensServico, iniciarOS, concluirOS, cancelarOS, updateOrdemServico } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'
import { ConcluirModal, ReagendarModal, CancelarModal } from './manutencao-modals.jsx'

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
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d) }
  return days
}
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function fmtDia(d) { const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; return DIAS[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') }
function OSBadge({ status }) { const s = STATUS_COLORS[status] || STATUS_COLORS.AGENDADA; return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{status.replace('_', ' ')}</span> }

export function ManutencaoAgendaTab({ user }) {
  const [ordens, setOrdens] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [concluindo, setConcluindo] = useState(null)
  const [reagendando, setReagendando] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [obsOS, setObsOS] = useState(null)
  const [obsTexto, setObsTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const load = useCallback(async () => { setOrdens(await fetchOrdensServico()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('os-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const days = getWeekDays(weekOffset)
  const hoje = new Date()

  const handleAprovar = async (os) => {
    await updateOrdemServico(os.id, { tecnico_nome: user.nome })
    await criarNotificacao(os.solicitante_nome, `✅ OS ${os.numero_os} aprovada`, `Técnico ${user.nome} confirmou para ${new Date(os.data_agendada).toLocaleDateString('pt-BR')} em ${os.cliente_nome}`)
    load()
  }

  const handleReagendar = async (osId, novaData, motivo) => {
    const os = ordens.find(o => o.id === osId)
    await updateOrdemServico(osId, { data_agendada: novaData, tecnico_nome: user.nome })
    if (os) await criarNotificacao(os.solicitante_nome, `📅 OS ${os.numero_os} reagendada`, `Nova data: ${new Date(novaData).toLocaleDateString('pt-BR')} · Motivo: ${motivo} · Técnico: ${user.nome}`)
    setReagendando(null); load()
  }

  const handleObs = async () => {
    if (!obsTexto.trim() || !obsOS) return
    const os = obsOS
    const prev = os.observacao_conclusao || ''
    const nova = prev ? `${prev}\n[${user.nome}] ${obsTexto.trim()}` : `[${user.nome}] ${obsTexto.trim()}`
    await updateOrdemServico(os.id, { observacao_conclusao: nova })
    setObsOS(null); setObsTexto(''); load()
  }

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
    setConcluindo(null); load()
  }

  const handleCancelar = async (osId, motivo) => {
    const os = ordens.find(o => o.id === osId)
    await cancelarOS(osId)
    if (os) await criarNotificacao(os.solicitante_nome, `❌ OS ${os.numero_os} cancelada`, `Motivo: ${motivo} · Técnico: ${user.nome}`)
    setCancelando(null); load()
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
            ) : osDay.map(os => {
              const isExp = expandedId === os.id
              return (
                <div key={os.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <div onClick={() => setExpandedId(v => v === os.id ? null : os.id)} style={{ padding: '12px 16px', cursor: 'pointer', background: isExp ? '#FAFAFA' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{OS_TIPO_ICON[os.tipo]}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', flex: 1 }}>{os.cliente_nome}</span>
                      <OSBadge status={os.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      {OS_TIPO_LABEL[os.tipo]} · {PERIODO_LABEL[os.periodo]} · <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>{os.numero_os}</span>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ padding: '0 16px 12px', background: '#FAFAFA' }}>
                      {os.equipamento_tipo && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>📦 {os.equipamento_tipo}</div>}
                      {(os.endereco || os.cidade) && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>📍 {[os.endereco, os.cidade].filter(Boolean).join(' - ')}</div>}
                      <div style={{ fontSize: 12, color: '#334155', marginBottom: 6 }}>{os.descricao}</div>
                      {os.solicitante_nome && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Solicitado por: <b>{os.solicitante_nome}</b></div>}
                      {os.tecnico_nome && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Técnico: <b>{os.tecnico_nome}</b></div>}
                      {os.observacao_conclusao && <div style={{ fontSize: 11, color: '#334155', background: '#F1F5F9', padding: '6px 8px', borderRadius: 6, marginBottom: 6, whiteSpace: 'pre-line' }}>📝 {os.observacao_conclusao}</div>}

                      {os.foto_antes && (
                        <div style={{ marginBottom: 8, padding: 8, background: '#FFF7ED', borderRadius: 8, border: '1px solid #FDE68A' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#B45309', marginBottom: 4 }}>📷 Foto do problema (enviada pelo solicitante)</div>
                          <img src={os.foto_antes} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 6, border: '1px solid #E2E8F0', cursor: 'pointer' }} onClick={() => window.open(os.foto_antes, '_blank')} />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {os.status === 'AGENDADA' && !os.tecnico_nome && <button onClick={() => handleAprovar(os)} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 11 }}>✅ Aprovar</button>}
                        {os.status === 'AGENDADA' && <button onClick={() => setReagendando(os)} style={{ ...btnSmall, background: '#F59E0B', color: '#fff', border: 'none', fontSize: 11 }}>📅 Reagendar</button>}
                        {['AGENDADA', 'EM_ANDAMENTO'].includes(os.status) && <button onClick={() => { setObsOS(os); setObsTexto('') }} style={{ ...btnSmall, fontSize: 11 }}>📝 Nota</button>}
                        {os.status === 'AGENDADA' && <button onClick={() => handleIniciar(os)} style={{ ...btnSmall, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 11 }}>▶ Iniciar</button>}
                        {os.status === 'EM_ANDAMENTO' && <button onClick={() => setConcluindo(os)} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 11 }}>✓ Concluir</button>}
                        {['AGENDADA', 'EM_ANDAMENTO'].includes(os.status) && <button onClick={() => setCancelando(os)} style={{ ...btnSmall, color: '#EF4444', fontSize: 11 }}>✗ Cancelar</button>}
                      </div>

                      {obsOS?.id === os.id && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input value={obsTexto} onChange={e => setObsTexto(e.target.value)} placeholder="Observação..." style={{ ...inputStyle, flex: 1, height: 34, fontSize: 12 }} onKeyDown={e => e.key === 'Enter' && handleObs()} />
                          <button onClick={handleObs} style={{ ...btnSmall, background: '#0A1628', color: '#fff', border: 'none', fontSize: 11 }}>Salvar</button>
                          <button onClick={() => setObsOS(null)} style={{ ...btnSmall, fontSize: 11 }}>✗</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {concluindo && <ConcluirModal os={concluindo} onClose={() => setConcluindo(null)} onConfirm={handleConcluir} />}
      {reagendando && <ReagendarModal os={reagendando} onClose={() => setReagendando(null)} onConfirm={handleReagendar} />}
      {cancelando && <CancelarModal os={cancelando} onClose={() => setCancelando(null)} onConfirm={handleCancelar} />}
    </div>
  )
}
