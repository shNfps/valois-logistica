import { useState, useEffect, useCallback } from 'react'
import { card, btnSmall, fetchClientes } from './db.js'
import { fetchOrdensServico, fetchEquipamentos } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'

export function AdminManutencaoCard() {
  const [ordens, setOrdens] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [os, eq] = await Promise.all([fetchOrdensServico(), fetchEquipamentos()])
      setOrdens(os); setEquipamentos(eq); setLoading(false)
      const hoje = new Date().toISOString().slice(0, 10)
      const atrasadas = os.filter(o => o.data_agendada < hoje && !['CONCLUIDA', 'CANCELADA'].includes(o.status))
      if (atrasadas.length > 0) {
        const key = `valois-os-atrasada-${hoje}`
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          await criarNotificacao('admin', `⚠️ ${atrasadas.length} OS atrasada(s)`, atrasadas.map(o => `${o.numero_os} - ${o.cliente_nome}`).slice(0, 3).join(', '))
        }
      }
    }
    load()
  }, [])

  if (loading) return null

  const hoje = new Date().toISOString().slice(0, 10)
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = amanha.toISOString().slice(0, 10)
  const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0, 0, 0, 0)

  const osHoje = ordens.filter(o => o.data_agendada === hoje && !['CANCELADA'].includes(o.status))
  const osAmanha = ordens.filter(o => o.data_agendada === amanhaStr && !['CANCELADA'].includes(o.status))
  const atrasadas = ordens.filter(o => o.data_agendada < hoje && !['CONCLUIDA', 'CANCELADA'].includes(o.status))
  const agendadas = ordens.filter(o => o.status === 'AGENDADA').length
  const emAndamento = ordens.filter(o => o.status === 'EM_ANDAMENTO').length
  const concluidasMes = ordens.filter(o => o.status === 'CONCLUIDA' && o.concluido_em && new Date(o.concluido_em) >= mesInicio).length

  return (
    <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: '4px solid #F97316' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>🔧 Manutenção</div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: '#FFF7ED', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#EA580C' }}>{osHoje.length}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#9A3412' }}>Hoje</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: '#EFF6FF', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#2563EB' }}>{osAmanha.length}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#1E40AF' }}>Amanhã</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: atrasadas.length > 0 ? '#FEE2E2' : '#F1F5F9', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: atrasadas.length > 0 ? '#DC2626' : '#94A3B8' }}>{atrasadas.length}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: atrasadas.length > 0 ? '#991B1B' : '#64748B' }}>Atrasadas</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', background: '#D1FAE5', borderRadius: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#065F46' }}>{concluidasMes}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#065F46' }}>Mês</div>
        </div>
      </div>

      {/* Status counters */}
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span><b style={{ color: '#B45309' }}>{agendadas}</b> agendadas</span>
        <span>·</span>
        <span><b style={{ color: '#1D4ED8' }}>{emAndamento}</b> em andamento</span>
        <span>·</span>
        <span><b style={{ color: '#065F46' }}>{concluidasMes}</b> concluídas este mês</span>
      </div>

      {/* Atrasadas list */}
      {atrasadas.length > 0 && (
        <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', marginTop: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>OS Atrasadas</div>
          {atrasadas.slice(0, 4).map(os => (
            <div key={os.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid #FECACA', fontSize: 12 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#DC2626', background: '#FEE2E2', padding: '1px 5px', borderRadius: 4 }}>{os.numero_os}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.cliente_nome}</span>
              <span style={{ color: '#DC2626', fontSize: 10, fontWeight: 600 }}>{new Date(os.data_agendada).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Today's OS */}
      {osHoje.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#EA580C', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hoje</div>
          {osHoje.map(os => {
            const sc = { AGENDADA: '#B45309', EM_ANDAMENTO: '#1D4ED8', CONCLUIDA: '#065F46' }
            return <div key={os.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12, borderBottom: '1px solid #F1F5F9' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{os.numero_os}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.cliente_nome}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: sc[os.status] || '#64748B' }}>{os.status.replace('_', ' ')}</span>
            </div>
          })}
        </div>
      )}
    </div>
  )
}

export function ClienteEquipamentosSection({ clienteId, clienteNome, user }) {
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!clienteId) return
    const { fetchEquipamentosByCliente } = await import('./manutencao-db.js')
    setEquipamentos(await fetchEquipamentosByCliente(clienteId)); setLoading(false)
  }, [clienteId])

  useEffect(() => { load() }, [load])

  if (loading || equipamentos.length === 0) return null

  const hoje = new Date(); const dias90 = 90 * 24 * 60 * 60 * 1000
  const STATUS_EQ = {
    instalado: { label: 'Instalado', bg: '#D1FAE5', color: '#065F46' },
    em_estoque: { label: 'Estoque', bg: '#DBEAFE', color: '#1D4ED8' },
    defeito: { label: 'Defeito', bg: '#FEE2E2', color: '#B91C1C' },
    descartado: { label: 'Descartado', bg: '#F1F5F9', color: '#64748B' }
  }

  return (
    <div style={{ ...card, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>🔧 Equipamentos Instalados ({equipamentos.length})</div>
      {equipamentos.map(eq => {
        const st = STATUS_EQ[eq.status] || STATUS_EQ.instalado
        const needsMaint = eq.status === 'instalado' && ((eq.ultima_manutencao && (hoje - new Date(eq.ultima_manutencao)) > dias90) || (!eq.ultima_manutencao && eq.data_instalacao && (hoje - new Date(eq.data_instalacao)) > dias90))
        return (
          <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 16 }}>📦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#0A1628' }}>{eq.tipo}</div>
              {eq.modelo && <div style={{ fontSize: 11, color: '#64748B' }}>{eq.modelo}</div>}
              {eq.local_instalacao && <div style={{ fontSize: 11, color: '#94A3B8' }}>📍 {eq.local_instalacao}</div>}
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: st.bg, color: st.color }}>{st.label}</span>
            {needsMaint && <span style={{ fontSize: 10, fontWeight: 700, color: '#B45309' }}>⚠️</span>}
          </div>
        )
      })}
    </div>
  )
}
