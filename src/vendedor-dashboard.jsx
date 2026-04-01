import { useState, useEffect } from 'react'
import { fmtMoney, card, fetchClientes, fetchMetas } from './db.js'
import { BarraProgresso } from './comissoes-metas.jsx'

// ─── DASHBOARD DE COMISSÃO DO VENDEDOR ───
export function VendedorDashboardTab({ user, pedidos }) {
  const [clientes, setClientes] = useState([])
  const [metas, setMetas] = useState([])
  useEffect(() => { fetchClientes().then(setClientes) }, [])
  useEffect(() => { fetchMetas().then(setMetas) }, [])

  // Pedidos dos clientes deste vendedor
  const meusPedidos = pedidos.filter(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    return c?.vendedor_nome === user.nome
  })

  const validos = meusPedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const now = new Date()
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1)
  const semIni = new Date(now); semIni.setDate(now.getDate() - now.getDay()); semIni.setHours(0, 0, 0, 0)
  const semFim = new Date(semIni); semFim.setDate(semIni.getDate() + 6); semFim.setHours(23, 59, 59)

  const pedidosMes = validos.filter(p => new Date(p.criado_em) >= mesIni)
  const pedidosSemana = validos.filter(p => { const d = new Date(p.criado_em); return d >= semIni && d <= semFim })
  const tMes = pedidosMes.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tSemana = pedidosSemana.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)

  const mSemana = metas.find(m => m.tipo === 'semanal' && (!m.vendedor_nome || m.vendedor_nome === user.nome))
  const mMes = metas.find(m => m.tipo === 'mensal' && (!m.vendedor_nome || m.vendedor_nome === user.nome))

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

      {/* Card comissão do mês */}
      <div style={{ ...card, background: '#F0FDF4', border: '2px solid #86EFAC', padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: 1.2 }}>💰 Minha Comissão — Mês Atual</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#059669', margin: '8px 0 4px' }}>{fmtMoney(tMes * 0.05)}</div>
        <div style={{ fontSize: 12, color: '#64748B' }}>5% de {fmtMoney(tMes)} · {pedidosMes.length} pedido{pedidosMes.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Lista pedidos que geraram comissão */}
      {pedidosMes.length > 0 && <>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>Pedidos do Mês</div>
        {pedidosMes.map(p => (
          <div key={p.id} style={{ ...card, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 13 }}>{p.cliente}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{fmtMoney(p.valor_total || 0)}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>comissão: {fmtMoney((p.valor_total || 0) * 0.05)}</div>
            </div>
          </div>
        ))}
      </>}
      {pedidosMes.length === 0 && clientes.length > 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
          Nenhum pedido com venda confirmada este mês
        </div>
      )}
    </div>
  )
}
