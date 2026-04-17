import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { btnSmall, card } from './db.js'
import { fetchOrdensServico, iniciarOS, concluirOS, cancelarOS, updateOrdemServico } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'
import { ConcluirModal, ReagendarModal, CancelarModal } from './manutencao-modals.jsx'
import { OSDetalhePanel } from './manutencao-agenda-panel.jsx'

const OS_TIPO_ICON = { instalacao: '🔧', manutencao: '⚙️', troca: '🔄', desinstalacao: '❌' }
const TIPO_BORDER = { instalacao: '#10B981', manutencao: '#F97316', troca: '#3B82F6', desinstalacao: '#64748B' }
const PERIODO_SHORT = { manha: 'Manhã', tarde: 'Tarde', dia_todo: 'Dia todo' }
const STATUS_COLORS = {
  AGENDADA: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' },
  EM_ANDAMENTO: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' },
  CONCLUIDA: { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
  CANCELADA: { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
}
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function getWeekDays(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + diff + offset * 7)
  start.setHours(0, 0, 0, 0)
  const days = []
  for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d) }
  return days
}
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function getWeekNumber(d) { const t = new Date(d.getFullYear(), 0, 1); return Math.ceil(((d - t) / 86400000 + t.getDay() + 1) / 7) }
function useIsMobile() { const [m, setM] = useState(window.innerWidth < 768); useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, []); return m }

export function ManutencaoAgendaTab({ user }) {
  const [ordens, setOrdens] = useState([])
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedOS, setSelectedOS] = useState(null)
  const [concluindo, setConcluindo] = useState(null)
  const [reagendando, setReagendando] = useState(null)
  const [cancelando, setCancelando] = useState(null)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  const load = useCallback(async () => { setOrdens(await fetchOrdensServico()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('os-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const days = getWeekDays(weekOffset)
  const hoje = new Date()
  const weekNum = getWeekNumber(days[0])
  const monthName = MESES[days[3].getMonth()]
  const year = days[3].getFullYear()

  const handleAprovar = async (os) => {
    await updateOrdemServico(os.id, { tecnico_nome: user.nome })
    await criarNotificacao(os.solicitante_nome, `✅ OS ${os.numero_os} aprovada`, `Técnico ${user.nome} confirmou para ${new Date(os.data_agendada).toLocaleDateString('pt-BR')} em ${os.cliente_nome}`)
    load(); setSelectedOS(prev => prev?.id === os.id ? { ...prev, tecnico_nome: user.nome } : prev)
  }
  const handleReagendar = async (osId, novaData, motivo) => {
    const os = ordens.find(o => o.id === osId)
    await updateOrdemServico(osId, { data_agendada: novaData, tecnico_nome: user.nome })
    if (os) await criarNotificacao(os.solicitante_nome, `📅 OS ${os.numero_os} reagendada`, `Nova data: ${new Date(novaData).toLocaleDateString('pt-BR')} · Motivo: ${motivo} · Técnico: ${user.nome}`)
    setReagendando(null); setSelectedOS(null); load()
  }
  const handleIniciar = async (os) => {
    await iniciarOS(os.id, user.nome)
    await criarNotificacao(os.solicitante_nome, `⚙️ OS ${os.numero_os} iniciada`, `Técnico ${user.nome} iniciou o serviço em ${os.cliente_nome}`)
    load(); setSelectedOS(prev => prev?.id === os.id ? { ...prev, status: 'EM_ANDAMENTO', tecnico_nome: user.nome } : prev)
  }
  const handleConcluir = async (osId, obs, fotoUrl, eqId) => {
    await concluirOS(osId, obs, fotoUrl, eqId)
    const os = ordens.find(o => o.id === osId)
    if (os) {
      await criarNotificacao(os.solicitante_nome, `✅ OS ${os.numero_os} concluída`, `Serviço em ${os.cliente_nome} finalizado por ${user.nome}`)
      await criarNotificacao('admin', `✅ OS ${os.numero_os} concluída`, `${os.cliente_nome} · ${user.nome}`)
    }
    setConcluindo(null); setSelectedOS(null); load()
  }
  const handleCancelar = async (osId, motivo) => {
    const os = ordens.find(o => o.id === osId)
    await cancelarOS(osId, motivo)
    if (os) await criarNotificacao(os.solicitante_nome, `❌ OS ${os.numero_os} cancelada`, `Motivo: ${motivo} · Técnico: ${user.nome}`)
    setCancelando(null); setSelectedOS(null); load()
  }
  const handleObs = async (os, texto) => {
    const prev = os.observacao_conclusao || ''
    const nova = prev ? `${prev}\n[${user.nome}] ${texto}` : `[${user.nome}] ${texto}`
    await updateOrdemServico(os.id, { observacao_conclusao: nova })
    load(); setSelectedOS(p => p?.id === os.id ? { ...p, observacao_conclusao: nova } : p)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando agenda...</div>

  return (
    <div>
      {/* Header navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, background: '#fff', borderRadius: 12, padding: '10px 16px', border: '1px solid #E2E8F0' }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ ...btnSmall, fontSize: 12 }}>← Anterior</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0A1628' }}>Sem. {weekNum} - {monthName} {year}</div>
          {weekOffset !== 0 && <button onClick={() => setWeekOffset(0)} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginTop: 2 }}>Voltar para hoje</button>}
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)} style={{ ...btnSmall, fontSize: 12 }}>Próxima →</button>
      </div>

      {/* Calendar grid - desktop */}
      {!isMobile ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          {/* Column headers */}
          {days.map((day, i) => {
            const isH = isSameDay(day, hoje)
            return <div key={'h' + i} style={{ padding: '8px 4px', textAlign: 'center', background: isH ? '#EFF6FF' : '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderRight: i < 6 ? '1px solid #F1F5F9' : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isH ? '#2563EB' : '#64748B' }}>{DIAS_CURTO[i]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isH ? '#2563EB' : '#0A1628' }}>{day.getDate()}</div>
            </div>
          })}
          {/* Day cells */}
          {days.map((day, i) => {
            const key = day.toISOString().slice(0, 10)
            const isH = isSameDay(day, hoje)
            const osDay = ordens.filter(o => o.data_agendada === key && o.status !== 'CANCELADA')
            return <div key={key} style={{ minHeight: 120, padding: 4, borderRight: i < 6 ? '1px solid #F1F5F9' : 'none', background: isH ? '#F0F7FF' : '#fff', verticalAlign: 'top' }}>
              {osDay.length === 0 && <div style={{ fontSize: 10, color: '#CBD5E1', fontStyle: 'italic', padding: '8px 4px', textAlign: 'center' }}>Sem OS</div>}
              {osDay.map(os => {
                const bc = TIPO_BORDER[os.tipo] || '#94A3B8'
                const sc = STATUS_COLORS[os.status] || STATUS_COLORS.AGENDADA
                return <div key={os.id} onClick={() => setSelectedOS(os)} style={{ padding: '5px 6px', marginBottom: 3, borderRadius: 6, borderLeft: `3px solid ${bc}`, background: '#FAFAFA', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 12 }}>{OS_TIPO_ICON[os.tipo]}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0A1628', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.cliente_nome}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: '#94A3B8' }}>{PERIODO_SHORT[os.periodo]}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: sc.bg, color: sc.color }}>{os.status === 'EM_ANDAMENTO' ? 'ANDAMENTO' : os.status}</span>
                  </div>
                </div>
              })}
            </div>
          })}
        </div>
      ) : (
        /* Mobile: daily list */
        <div>
          {days.map((day, i) => {
            const key = day.toISOString().slice(0, 10)
            const isH = isSameDay(day, hoje)
            const osDay = ordens.filter(o => o.data_agendada === key && o.status !== 'CANCELADA')
            if (osDay.length === 0 && !isH) return null
            return <div key={key} style={{ ...card, padding: 0, marginBottom: 8, border: isH ? '2px solid #2563EB' : '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: isH ? '#EFF6FF' : '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isH ? '#2563EB' : '#334155' }}>{isH && '📌 '}{DIAS_CURTO[i]} {day.getDate()}/{String(day.getMonth() + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{osDay.length} OS</span>
              </div>
              {osDay.length === 0 ? <div style={{ padding: '10px 14px', fontSize: 11, color: '#CBD5E1', fontStyle: 'italic' }}>Sem agendamentos</div> : osDay.map(os => {
                const bc = TIPO_BORDER[os.tipo] || '#94A3B8'; const sc = STATUS_COLORS[os.status] || STATUS_COLORS.AGENDADA
                return <div key={os.id} onClick={() => setSelectedOS(os)} style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', borderLeft: `4px solid ${bc}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{OS_TIPO_ICON[os.tipo]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.cliente_nome}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{PERIODO_SHORT[os.periodo]} · {os.solicitante_nome && `por ${os.solicitante_nome}`}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: sc.bg, color: sc.color, flexShrink: 0 }}>{os.status.replace('_', ' ')}</span>
                </div>
              })}
            </div>
          })}
        </div>
      )}

      {/* Side panel */}
      {selectedOS && <OSDetalhePanel os={selectedOS} user={user} onClose={() => setSelectedOS(null)}
        onAprovar={handleAprovar} onReagendar={os => setReagendando(os)} onIniciar={handleIniciar}
        onConcluir={os => setConcluindo(os)} onCancelar={os => setCancelando(os)} onObs={handleObs} />}

      {concluindo && <ConcluirModal os={concluindo} onClose={() => setConcluindo(null)} onConfirm={handleConcluir} />}
      {reagendando && <ReagendarModal os={reagendando} onClose={() => setReagendando(null)} onConfirm={handleReagendar} />}
      {cancelando && <CancelarModal os={cancelando} onClose={() => setCancelando(null)} onConfirm={handleCancelar} />}
    </div>
  )
}
