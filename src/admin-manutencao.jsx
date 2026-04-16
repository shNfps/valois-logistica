import { useState, useEffect, useCallback } from 'react'
import { card, btnSmall, btnPrimary, fetchClientes } from './db.js'
import { fetchOrdensServico, fetchEquipamentos } from './manutencao-db.js'
import { criarNotificacao } from './notificacoes.js'

const STATUS_COLORS = {
  AGENDADA: { bg: '#FEF3C7', color: '#B45309' },
  EM_ANDAMENTO: { bg: '#DBEAFE', color: '#1D4ED8' },
  CONCLUIDA: { bg: '#D1FAE5', color: '#065F46' },
  CANCELADA: { bg: '#F1F5F9', color: '#64748B' }
}

export function AdminManutencaoCard() {
  const [ordens, setOrdens] = useState([])
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [os, eq] = await Promise.all([fetchOrdensServico(), fetchEquipamentos()])
      setOrdens(os)
      setEquipamentos(eq)
      setLoading(false)

      // Notificar admin sobre OS atrasadas
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
  const osHoje = ordens.filter(o => o.data_agendada === hoje && !['CANCELADA'].includes(o.status))
  const atrasadas = ordens.filter(o => o.data_agendada < hoje && !['CONCLUIDA', 'CANCELADA'].includes(o.status))
  const instalados = equipamentos.filter(e => e.status === 'instalado').length

  return (
    <div style={{ ...card, padding: 18, marginBottom: 14, borderLeft: '4px solid #F97316' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        🔧 Manutenção
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <div style={{ textAlign: 'center', padding: 8, background: '#FFF7ED', borderRadius: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#EA580C' }}>{osHoje.length}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9A3412' }}>OS Hoje</div>
        </div>
        <div style={{ textAlign: 'center', padding: 8, background: atrasadas.length > 0 ? '#FEE2E2' : '#F1F5F9', borderRadius: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: atrasadas.length > 0 ? '#DC2626' : '#94A3B8' }}>{atrasadas.length}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: atrasadas.length > 0 ? '#991B1B' : '#64748B' }}>Atrasadas</div>
        </div>
        <div style={{ textAlign: 'center', padding: 8, background: '#D1FAE5', borderRadius: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#065F46' }}>{instalados}</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#065F46' }}>Instalados</div>
        </div>
      </div>
      {atrasadas.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {atrasadas.slice(0, 3).map(os => (
            <div key={os.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid #FEE2E2', fontSize: 12 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#DC2626', background: '#FEE2E2', padding: '1px 5px', borderRadius: 4 }}>{os.numero_os}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#0A1628' }}>{os.cliente_nome}</span>
              <span style={{ color: '#DC2626', fontSize: 11, fontWeight: 600 }}>{new Date(os.data_agendada).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
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
    const eq = await fetchEquipamentosByCliente(clienteId)
    setEquipamentos(eq)
    setLoading(false)
  }, [clienteId])

  useEffect(() => { load() }, [load])

  if (loading || equipamentos.length === 0) return null

  const hoje = new Date()
  const dias90 = 90 * 24 * 60 * 60 * 1000

  const STATUS_EQ = {
    instalado: { label: 'Instalado', bg: '#D1FAE5', color: '#065F46' },
    em_estoque: { label: 'Estoque', bg: '#DBEAFE', color: '#1D4ED8' },
    defeito: { label: 'Defeito', bg: '#FEE2E2', color: '#B91C1C' },
    descartado: { label: 'Descartado', bg: '#F1F5F9', color: '#64748B' }
  }

  return (
    <div style={{ ...card, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
        🔧 Equipamentos Instalados ({equipamentos.length})
      </div>
      {equipamentos.map(eq => {
        const st = STATUS_EQ[eq.status] || STATUS_EQ.instalado
        const needsMaint = eq.status === 'instalado' && (
          (eq.ultima_manutencao && (hoje - new Date(eq.ultima_manutencao)) > dias90) ||
          (!eq.ultima_manutencao && eq.data_instalacao && (hoje - new Date(eq.data_instalacao)) > dias90)
        )
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
