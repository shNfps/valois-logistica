import { useState, useEffect } from 'react'
import { fmtMoney, fmt, getRef, card, fetchClientes, fetchMetas, STATUS_MAP } from './db.js'
import { BarraProgresso } from './comissoes-metas.jsx'

function getPeriodoRange(periodo) {
  const now = new Date()
  if (periodo === 'semana') {
    const ini = new Date(now); ini.setDate(now.getDate() - now.getDay()); ini.setHours(0, 0, 0, 0)
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23, 59, 59)
    return [ini, fim]
  }
  if (periodo === 'anterior') {
    return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)]
  }
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)]
}

// ─── DASHBOARD DE COMISSÃO DO VENDEDOR ───
export function VendedorDashboardTab({ user, pedidos }) {
  const [clientes, setClientes] = useState([])
  const [metas, setMetas] = useState([])
  const [periodo, setPeriodo] = useState('mes')
  useEffect(() => { fetchClientes().then(setClientes) }, [])
  useEffect(() => { fetchMetas().then(setMetas) }, [])

  const meusPedidos = pedidos.filter(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    return c?.vendedor_nome === user.nome
  })

  const [ini, fim] = getPeriodoRange(periodo)
  const pedNoPeriodo = meusPedidos.filter(p => { const d = new Date(p.criado_em); return d >= ini && d <= fim })
  const totalEntregue = pedNoPeriodo.filter(p => p.status === 'ENTREGUE').reduce((s, p) => s + (Number(p.valor_total) || 0), 0)

  // Para as metas (semana/mês atual)
  const now = new Date()
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1)
  const semIni = new Date(now); semIni.setDate(now.getDate() - now.getDay()); semIni.setHours(0, 0, 0, 0)
  const semFim = new Date(semIni); semFim.setDate(semIni.getDate() + 6); semFim.setHours(23, 59, 59)
  const validos = meusPedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const tSemana = validos.filter(p => { const d = new Date(p.criado_em); return d >= semIni && d <= semFim }).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tMes = validos.filter(p => new Date(p.criado_em) >= mesIni).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const mSemana = metas.find(m => m.tipo === 'semanal' && (!m.vendedor_nome || m.vendedor_nome === user.nome))
  const mMes = metas.find(m => m.tipo === 'mensal' && (!m.vendedor_nome || m.vendedor_nome === user.nome))

  const PERIODO_LABELS = { semana: 'Esta semana', mes: 'Este mês', anterior: 'Mês anterior' }

  // Agrupar por status para subtotais
  const byStatus = {}
  pedNoPeriodo.forEach(p => {
    if (!byStatus[p.status]) byStatus[p.status] = { count: 0, valor: 0 }
    byStatus[p.status].count++; byStatus[p.status].valor += Number(p.valor_total) || 0
  })

  return (
    <div>
      {/* Barras de Meta */}
      {(mSemana || mMes) ? (
        <div style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>🎯 Minhas Metas</div>
          {mSemana && <BarraProgresso atual={tSemana} meta={Number(mSemana.valor_meta)} label="Meta Semanal" />}
          {mMes && <BarraProgresso atual={tMes} meta={Number(mMes.valor_meta)} label="Meta Mensal" />}
        </div>
      ) : (
        <div style={{ ...card, padding: 12, background: '#FEF3C7', border: '1px solid #FDE68A', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
          ⏳ Nenhuma meta definida pelo admin ainda
        </div>
      )}

      {/* Seletor de período */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {Object.entries(PERIODO_LABELS).map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: periodo === k ? '#0A1628' : '#E2E8F0', color: periodo === k ? '#fff' : '#64748B', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>

      {/* Card comissão */}
      <div style={{ ...card, background: '#F0FDF4', border: '2px solid #86EFAC', padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: 1.2 }}>💰 Minha Comissão — {PERIODO_LABELS[periodo]}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#059669', margin: '8px 0 4px' }}>{fmtMoney(totalEntregue * 0.05)}</div>
        <div style={{ fontSize: 12, color: '#64748B' }}>5% de {fmtMoney(totalEntregue)} entregues · {pedNoPeriodo.length} pedido{pedNoPeriodo.length !== 1 ? 's' : ''} no período</div>
      </div>

      {/* Subtotais por status */}
      {pedNoPeriodo.length > 0 && (
        <div style={{ ...card, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Resumo por status</div>
          {Object.entries(byStatus).map(([st, d]) => {
            const s = STATUS_MAP[st] || { label: st, color: '#64748B', bg: '#F1F5F9' }
            return (
              <div key={st} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
                <span style={{ color: '#334155', fontWeight: 600 }}>{fmtMoney(d.valor)} <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>({d.count} pedido{d.count !== 1 ? 's' : ''})</span></span>
              </div>
            )
          })}
        </div>
      )}

      {/* Lista de pedidos */}
      {pedNoPeriodo.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>Pedidos no período ({pedNoPeriodo.length})</div>
        {pedNoPeriodo.map(p => {
          const s = STATUS_MAP[p.status] || { label: p.status, color: '#64748B', bg: '#F1F5F9' }
          return (
            <div key={p.id} style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{getRef(p)}</span>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 13 }}>{p.cliente}</div>
                {p.cidade && <div style={{ fontSize: 11, color: '#94A3B8' }}>📍 {p.cidade}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtMoney(p.valor_total || 0)}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{fmt(p.criado_em)}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 7px', borderRadius: 6 }}>{s.label}</span>
            </div>
          )
        })}
      </>}
      {pedNoPeriodo.length === 0 && clientes.length > 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhum pedido no período selecionado</div>
      )}
    </div>
  )
}
