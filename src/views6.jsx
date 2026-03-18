import { useState, useEffect } from 'react'
import { fmt, fmtMoney, getRef, btnSmall, card, fetchPedidosByCliente, fetchItensByPedidoIds, fmtCnpj } from './db.js'
import { Badge } from './components.jsx'
import { ClienteBadges } from './cliente-badges.jsx'

// ─── CLIENTE DETALHE ───
export function ClienteDetalhe({ cliente, onBack }) {
  const [pedidos, setPedidos] = useState([])
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState(new Set())

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      const peds = await fetchPedidosByCliente(cliente.nome)
      setPedidos(peds)
      if (peds.length > 0) setItens(await fetchItensByPedidoIds(peds.map(p => p.id)))
      setLoading(false)
    }
    load()
  }, [cliente.nome])

  const validos = pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const valorTotal = validos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const ticketMedio = validos.length > 0 ? valorTotal / validos.length : 0

  const prodMap = {}
  itens.forEach(i => {
    if (!i.nome_produto) return
    if (!prodMap[i.nome_produto]) prodMap[i.nome_produto] = { qtd: 0, valor: 0 }
    prodMap[i.nome_produto].qtd += Number(i.quantidade) || 0
    prodMap[i.nome_produto].valor += Number(i.preco_total) || 0
  })
  const topProds = Object.entries(prodMap).sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 5)

  const toggle = id => setExpandidos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const itensDo = id => itens.filter(i => i.pedido_id === id)

  return (
    <div>
      <button onClick={onBack} style={{ ...btnSmall, marginBottom: 16 }}>← Voltar</button>

      <div style={{ ...card, padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0A1628' }}>{cliente.nome}</h3>
          <ClienteBadges pedidos={pedidos} />
        </div>
        <div style={{ fontSize: 13, color: '#64748B', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {cliente.cidade && <span>📍 {cliente.cidade}</span>}
          {cliente.telefone && <span>📞 {cliente.telefone}</span>}
          {cliente.email && <span>✉ {cliente.email}</span>}
        </div>
        {cliente.cnpj && <div style={{ fontSize: 13, color: '#64748B', marginTop: 6 }}>🏢 CNPJ: <span style={{ fontWeight: 600 }}>{fmtCnpj(cliente.cnpj)}</span></div>}
        {cliente.endereco && <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>🏠 {cliente.endereco}</div>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Carregando dados...</div>
      ) : (<>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          {[
            ['💰 Total gasto', fmtMoney(valorTotal), '#059669'],
            ['📋 Pedidos', String(validos.length), '#3B82F6'],
            ['📊 Ticket médio', fmtMoney(ticketMedio), '#8B5CF6'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '12px 8px', textAlign: 'center', borderTop: `3px solid ${color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Top Produtos */}
        <div style={{ ...card, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Top Produtos</div>
          {topProds.length === 0
            ? <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Nenhum dado — extraia itens dos pedidos com a IA 🤖</div>
            : topProds.map(([nome, d], i) => (
              <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < topProds.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#CBD5E1', minWidth: 20 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{nome}</span>
                <span style={{ fontSize: 11, color: '#64748B', marginRight: 4 }}>{d.qtd} un.</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{fmtMoney(d.valor)}</span>
              </div>
            ))}
        </div>

        {/* Últimos Pedidos */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
            Últimos Pedidos ({pedidos.length})
          </div>
          {pedidos.length === 0
            ? <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Nenhum pedido encontrado</div>
            : pedidos.slice(0, 10).map(p => {
              const exp = expandidos.has(p.id)
              const pItens = itensDo(p.id)
              return (
                <div key={p.id} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 8, marginBottom: 8 }}>
                  <div onClick={() => toggle(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>{getRef(p)}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8', flex: 1 }}>{fmt(p.criado_em)}</span>
                    {p.valor_total > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{fmtMoney(p.valor_total)}</span>}
                    <Badge status={p.status} />
                    <span style={{ fontSize: 11, color: '#CBD5E1', flexShrink: 0 }}>{exp ? '▲' : '▼'}</span>
                  </div>
                  {exp && (
                    <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #E2E8F0' }}>
                      {pItens.length === 0
                        ? <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: '4px 0' }}>Sem itens extraídos — use 🤖 Extrair itens no pedido</div>
                        : pItens.map((it, idx) => (
                          <div key={idx} style={{ fontSize: 11, color: '#334155', display: 'flex', gap: 8, padding: '3px 0' }}>
                            <span style={{ color: '#94A3B8', flexShrink: 0 }}>{it.quantidade}×</span>
                            {it.codigo && <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>{it.codigo}</span>}
                            <span style={{ flex: 1 }}>{it.nome_produto}</span>
                            <span style={{ color: '#059669', flexShrink: 0 }}>{fmtMoney(it.preco_total)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </>)}
    </div>
  )
}
