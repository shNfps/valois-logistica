import { useMemo } from 'react'
import { fmtMoney, fmt, getRef, STATUS_MAP } from './db.js'

function getSemRange() {
  const now = new Date()
  const ini = new Date(now); ini.setDate(now.getDate() - now.getDay()); ini.setHours(0, 0, 0, 0)
  const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23, 59, 59); return [ini, fim]
}
function getMesRange() {
  const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59)]
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0A1628', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MiniBarras({ pedidos }) {
  const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0, 0, 0, 0)
  const semanas = [1, 8, 15, 22].map((d, i) => {
    const ini = new Date(mesIni); ini.setDate(d)
    const fim = new Date(ini); fim.setDate(i < 3 ? d + 6 : 31); fim.setHours(23, 59, 59)
    const valor = pedidos.filter(p => { const x = new Date(p.criado_em); return x >= ini && x <= fim && p.status === 'ENTREGUE' }).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
    return { label: `Sem ${i + 1}`, valor }
  })
  const maxVal = Math.max(...semanas.map(s => s.valor), 1)
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Vendas por semana do mês</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 56 }}>
        {semanas.map((s, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: '100%', background: s.valor > 0 ? 'linear-gradient(to top,#2563EB,#60A5FA)' : '#F1F5F9', borderRadius: '3px 3px 0 0', height: `${Math.max((s.valor / maxVal) * 44, s.valor > 0 ? 4 : 2)}px`, alignSelf: 'flex-end', transition: 'height 0.6s ease' }} />
            <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RankingDetalhe({ nome, tipo, pedidos, clientes }) {
  const pedPessoa = useMemo(() => {
    if (tipo === 'comercial') return pedidos.filter(p => p.criado_por === nome)
    return pedidos.filter(p => {
      const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
      return c?.vendedor_nome === nome
    })
  }, [nome, tipo, pedidos, clientes])

  const [semIni, semFim] = getSemRange()
  const [mesIni, mesFim] = getMesRange()
  const semPed = pedPessoa.filter(p => { const d = new Date(p.criado_em); return d >= semIni && d <= semFim })
  const mesPed = pedPessoa.filter(p => { const d = new Date(p.criado_em); return d >= mesIni && d <= mesFim })
  const tSem = semPed.filter(p => p.status === 'ENTREGUE').reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tMes = mesPed.filter(p => p.status === 'ENTREGUE').reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const entreguesAll = pedPessoa.filter(p => p.status === 'ENTREGUE')
  const comissao = entreguesAll.reduce((s, p) => s + (Number(p.valor_total) || 0) * 0.05, 0)
  const taxaAprov = pedPessoa.length > 0 ? Math.round((entreguesAll.length / pedPessoa.length) * 100) : 0

  const porDia = {}
  pedPessoa.forEach(p => { const d = new Date(p.criado_em).toLocaleDateString('pt-BR'); porDia[d] = (porDia[d] || 0) + (Number(p.valor_total) || 0) })
  const melhorDia = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0]

  const porCliente = {}
  pedPessoa.filter(p => p.status === 'ENTREGUE').forEach(p => { const k = p.cliente || '?'; porCliente[k] = (porCliente[k] || 0) + (Number(p.valor_total) || 0) })
  const topClientes = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const ultimos = pedPessoa.slice(0, 20)

  return (
    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 8, borderLeft: '3px solid #3B82F6', marginTop: -4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        <Stat label="Pedidos semana" value={semPed.length} sub={fmtMoney(tSem)} />
        <Stat label="Pedidos mês" value={mesPed.length} sub={fmtMoney(tMes)} />
        {tipo === 'vendedor'
          ? <Stat label="Comissão acum." value={fmtMoney(comissao)} sub="5% dos entregues" />
          : <Stat label="Taxa aprovação" value={`${taxaAprov}%`} sub={`${entreguesAll.length} entregues`} />}
        <Stat label="Melhor dia" value={melhorDia?.[0] || '—'} sub={melhorDia ? fmtMoney(melhorDia[1]) : null} />
        <Stat label="Top cliente" value={topClientes[0]?.[0]?.split(' ')[0] || '—'} sub={topClientes[0] ? fmtMoney(topClientes[0][1]) : null} />
        <Stat label="Entregues total" value={entreguesAll.length} sub="pedidos" />
      </div>
      <div style={{ marginBottom: 14, background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
        <MiniBarras pedidos={pedPessoa} />
      </div>
      {topClientes.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #E2E8F0', marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Top 5 Clientes</div>
          {topClientes.map(([n, v]) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
              <span style={{ color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>{n}</span>
              <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>{fmtMoney(v)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 10, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Últimos {ultimos.length} pedidos</div>
        {ultimos.map(p => {
          const s = STATUS_MAP[p.status] || { label: p.status, color: '#64748B', bg: '#F1F5F9' }
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid #F8FAFC', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#F1F5F9', color: '#64748B', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>{getRef(p)}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#0A1628', flex: 1, minWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</span>
              {p.cidade && <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>📍{p.cidade}</span>}
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', flexShrink: 0 }}>{fmtMoney(p.valor_total || 0)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, padding: '1px 6px', borderRadius: 5, flexShrink: 0 }}>{s.label}</span>
              <span style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }}>{fmt(p.criado_em)}</span>
            </div>
          )
        })}
        {ultimos.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8', fontSize: 13 }}>Sem pedidos</div>}
      </div>
    </div>
  )
}
