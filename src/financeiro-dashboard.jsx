import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, card } from './db.js'
import { fetchDespesas, fetchContasReceber, fetchReembolsos, fetchCategoriasDespesa, statusEfetivo, diasAte, isoHoje } from './financeiro-db.js'
import { BarrasReceitaDespesa, DonutCategorias, FluxoProjetado, MESES_CURTO } from './financeiro-charts.jsx'
import { rodarAlertasFinanceiros } from './financeiro-alertas.js'

function ymKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') }
function rangeMeses(n) { const hoje = new Date(); const arr = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1); arr.push({ d, key: ymKey(d), label: MESES_CURTO[d.getMonth()] }) } return arr }

const KPI = ({ label, valor, sub, cor }) => (
  <div style={{ ...card, padding: 16, borderLeft: `4px solid ${cor}`, margin: 0 }}>
    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: '#0A1628', marginTop: 4 }}>{fmtMoney(valor)}</div>
    {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
  </div>
)

export function DashboardTab() {
  const [despesas, setDespesas] = useState([])
  const [receber, setReceber] = useState([])
  const [reembolsos, setReembolsos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [d, r, re, cat] = await Promise.all([fetchDespesas(), fetchContasReceber(), fetchReembolsos({ status: 'PENDENTE' }), fetchCategoriasDespesa()])
    setDespesas(d); setReceber(r); setReembolsos(re); setCategorias(cat); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { rodarAlertasFinanceiros() }, [])

  const kpi = useMemo(() => {
    const ini = new Date(); ini.setDate(1); const iniIso = ini.toISOString().slice(0, 10)
    const aPagar = despesas.filter(x => ['PENDENTE', 'ATRASADO'].includes(statusEfetivo(x))).reduce((s, x) => s + Number(x.valor || 0), 0)
    const aReceber = receber.filter(x => ['PENDENTE', 'ATRASADO'].includes(statusEfetivo(x))).reduce((s, x) => s + Number(x.valor || 0), 0)
    const pagasMes = despesas.filter(x => x.status === 'PAGO' && x.data_pagamento >= iniIso).reduce((s, x) => s + Number(x.valor || 0), 0)
    const recebidasMes = receber.filter(x => x.status === 'RECEBIDO' && x.data_recebimento >= iniIso).reduce((s, x) => s + Number(x.valor || 0), 0)
    return { aPagar, aReceber, pagasMes, recebidasMes, saldoMes: recebidasMes - pagasMes }
  }, [despesas, receber])

  const dadosBarras = useMemo(() => rangeMeses(6).map(m => {
    const rec = receber.filter(c => c.data_recebimento && c.status === 'RECEBIDO' && c.data_recebimento.startsWith(m.key)).reduce((s, x) => s + Number(x.valor || 0), 0)
    const des = despesas.filter(d => d.data_pagamento && d.status === 'PAGO' && d.data_pagamento.startsWith(m.key)).reduce((s, x) => s + Number(x.valor || 0), 0)
    return { label: m.label, receita: rec, despesa: des }
  }), [despesas, receber])

  const dadosCategorias = useMemo(() => {
    const ini = new Date(); ini.setDate(1); const iniIso = ini.toISOString().slice(0, 10)
    const map = {}
    despesas.filter(d => d.data_pagamento >= iniIso || statusEfetivo(d) === 'PENDENTE').forEach(d => {
      const cat = categorias.find(c => c.id === d.categoria_id)
      const k = cat?.id || 'sem'
      if (!map[k]) map[k] = { label: cat?.nome || 'Sem categoria', cor: cat?.cor || '#94A3B8', valor: 0 }
      map[k].valor += Number(d.valor || 0)
    })
    return Object.values(map).sort((a, b) => b.valor - a.valor).slice(0, 8)
  }, [despesas, categorias])

  const dadosFluxo = useMemo(() => {
    const arr = []; let saldo = kpi.recebidasMes - kpi.pagasMes
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    for (let i = 0; i < 30; i++) {
      const d = new Date(hoje); d.setDate(hoje.getDate() + i); const iso = d.toISOString().slice(0, 10)
      const r = receber.filter(c => c.data_vencimento === iso && c.status !== 'RECEBIDO' && c.status !== 'CANCELADO').reduce((s, x) => s + Number(x.valor || 0), 0)
      const p = despesas.filter(c => c.data_vencimento === iso && c.status !== 'PAGO' && c.status !== 'CANCELADO').reduce((s, x) => s + Number(x.valor || 0), 0)
      saldo += r - p
      arr.push({ label: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'), saldo })
    }
    return arr
  }, [despesas, receber, kpi])

  const topFornecedores = useMemo(() => {
    const ini = new Date(); ini.setDate(1); const iniIso = ini.toISOString().slice(0, 10)
    const map = {}
    despesas.filter(d => d.data_pagamento >= iniIso && d.status === 'PAGO' && d.fornecedor).forEach(d => {
      const k = d.fornecedor
      if (!map[k]) map[k] = { fornecedor: k, total: 0, count: 0 }
      map[k].total += Number(d.valor || 0); map[k].count++
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [despesas])

  const alertas = useMemo(() => {
    const list = []
    const venc3 = despesas.filter(d => d.status === 'PENDENTE' && diasAte(d.data_vencimento) >= 0 && diasAte(d.data_vencimento) <= 3)
    if (venc3.length) list.push({ tipo: 'warn', msg: `⚠️ ${venc3.length} boleto${venc3.length > 1 ? 's' : ''} vence${venc3.length > 1 ? 'm' : ''} em até 3 dias (${fmtMoney(venc3.reduce((s, x) => s + Number(x.valor || 0), 0))})` })
    const inadCount = new Set(receber.filter(c => statusEfetivo(c) === 'ATRASADO').map(c => c.cliente_id || c.cliente_nome)).size
    if (inadCount) list.push({ tipo: 'danger', msg: `🚨 ${inadCount} cliente${inadCount > 1 ? 's' : ''} com contas atrasadas` })
    if (reembolsos.length) list.push({ tipo: 'info', msg: `💸 ${reembolsos.length} reembolso${reembolsos.length > 1 ? 's' : ''} pendente${reembolsos.length > 1 ? 's' : ''} de aprovação` })
    return list
  }, [despesas, receber, reembolsos])

  if (loading) return <div style={{ color: '#94A3B8', textAlign: 'center', padding: 40 }}>Carregando...</div>

  return (
    <div>
      {alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: a.tipo === 'danger' ? '#FEE2E2' : a.tipo === 'warn' ? '#FEF3C7' : '#DBEAFE', color: a.tipo === 'danger' ? '#991B1B' : a.tipo === 'warn' ? '#92400E' : '#1D4ED8' }}>{a.msg}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KPI label="💰 Saldo do mês" valor={kpi.saldoMes} cor={kpi.saldoMes >= 0 ? '#059669' : '#B91C1C'} sub={`${fmtMoney(kpi.recebidasMes)} − ${fmtMoney(kpi.pagasMes)}`} />
        <KPI label="📈 Recebido no mês" valor={kpi.recebidasMes} cor="#059669" />
        <KPI label="📉 Pago no mês" valor={kpi.pagasMes} cor="#DC2626" />
        <KPI label="⏰ A receber" valor={kpi.aReceber} cor="#0EA5E9" />
        <KPI label="💳 A pagar" valor={kpi.aPagar} cor="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
        <BarrasReceitaDespesa dados={dadosBarras} />
        <DonutCategorias dados={dadosCategorias} />
      </div>

      <div style={{ marginBottom: 12 }}><FluxoProjetado dados={dadosFluxo} /></div>

      <div style={{ ...card, padding: 16, margin: 0 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 13, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Top 5 fornecedores (mês)</h4>
        {topFornecedores.length === 0 ? <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center', padding: 12 }}>Sem despesas pagas no mês</div> : topFornecedores.map((f, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>#{i + 1} {f.fornecedor}</span>
            <span style={{ fontSize: 11, color: '#94A3B8', marginRight: 12 }}>{f.count} boleto{f.count !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 700, color: '#0A1628' }}>{fmtMoney(f.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
