import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchConfigFinanceiro } from './financeiro-db.js'
import { periodoIntervalo, periodoAnterior, fetchDadosDRE, calcularDRE } from './dre-calculo.js'
import { DRETabela, CardsMargens, DrillDownModal } from './dre-tabela.jsx'
import { Waterfall } from './dre-waterfall.jsx'
import { gerarDREPdf } from './dre-export.js'

function KPI({ icone, label, valor, sub }) {
  return (
    <div style={{ ...card, padding: 14, margin: 0 }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{icone} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0A1628', marginTop: 4 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function rotuloPeriodo(tipo, range, custom) {
  if (tipo === 'mes') return new Date(range.de + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  if (tipo === 'mes_anterior') return 'Mês anterior — ' + new Date(range.de + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  if (tipo === 'trimestre') return 'Trimestre — ' + new Date(range.de + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  if (tipo === 'ano') return 'Ano ' + new Date(range.de + 'T00:00:00').getFullYear()
  return `${range.de} → ${range.ate}`
}

export function DRETab() {
  const [tipo, setTipo] = useState('mes')
  const [custom, setCustom] = useState({ de: '', ate: '' })
  const [dados, setDados] = useState(null)
  const [dadosAnt, setDadosAnt] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [drillDown, setDrillDown] = useState(null)

  const range = useMemo(() => periodoIntervalo(tipo, new Date(), custom), [tipo, custom])
  const rangeAnt = useMemo(() => periodoAnterior(range), [range])

  const load = useCallback(async () => {
    setLoading(true)
    const [c, d, a] = await Promise.all([fetchConfigFinanceiro(), fetchDadosDRE(range), fetchDadosDRE(rangeAnt)])
    setCfg(c); setDados(d); setDadosAnt(a); setLoading(false)
  }, [range, rangeAnt])
  useEffect(() => { load() }, [load])

  const dre = useMemo(() => dados && cfg ? calcularDRE(dados, cfg) : null, [dados, cfg])
  const dreAnt = useMemo(() => dadosAnt && cfg ? calcularDRE(dadosAnt, cfg) : null, [dadosAnt, cfg])

  const alertas = useMemo(() => {
    if (!dre) return []
    const list = []
    if (dreAnt && dreAnt.margemLiquida > 0 && (dre.margemLiquida < dreAnt.margemLiquida - dreAnt.margemLiquida * 0.2)) {
      list.push({ tipo: 'danger', msg: `🔴 Margem líquida caiu mais de 20% vs período anterior (${dreAnt.margemLiquida.toFixed(1)}% → ${dre.margemLiquida.toFixed(1)}%)` })
    }
    if (dre.receitaBruta > 0 && dre.cmv / dre.receitaBruta > 0.6) {
      list.push({ tipo: 'warn', msg: `⚠️ CMV está em ${((dre.cmv / dre.receitaBruta) * 100).toFixed(1)}% da receita — investigue produtos pouco rentáveis` })
    }
    if (dreAnt && dre.totalOperacional > dreAnt.totalOperacional && dre.receitaBruta && dreAnt.receitaBruta) {
      const crescOp = (dre.totalOperacional - dreAnt.totalOperacional) / dreAnt.totalOperacional
      const crescRec = (dre.receitaBruta - dreAnt.receitaBruta) / dreAnt.receitaBruta
      if (crescOp > crescRec + 0.05) list.push({ tipo: 'warn', msg: `⚠️ Despesa operacional cresceu ${(crescOp * 100).toFixed(1)}% — acima do crescimento de receita (${(crescRec * 100).toFixed(1)}%)` })
    }
    if (dre.produtosSemCusto.length) {
      list.push({ tipo: 'info', msg: `📦 ${dre.produtosSemCusto.length} produto${dre.produtosSemCusto.length > 1 ? 's vendidos' : ' vendido'} sem custo cadastrado — cadastre em Admin → Produtos` })
    }
    return list
  }, [dre, dreAnt])

  if (loading || !dre) return <div style={{ color: '#94A3B8', textAlign: 'center', padding: 40 }}>Calculando DRE...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="mes">Este mês</option>
          <option value="mes_anterior">Mês anterior</option>
          <option value="trimestre">Trimestre</option>
          <option value="ano">Ano</option>
          <option value="custom">Personalizado</option>
        </select>
        {tipo === 'custom' && <>
          <input type="date" value={custom.de} onChange={e => setCustom(c => ({ ...c, de: e.target.value }))} style={{ ...inputStyle, width: 'auto', height: 36 }} />
          <input type="date" value={custom.ate} onChange={e => setCustom(c => ({ ...c, ate: e.target.value }))} style={{ ...inputStyle, width: 'auto', height: 36 }} />
        </>}
        <span style={{ fontSize: 12, color: '#64748B', textTransform: 'capitalize' }}>{rotuloPeriodo(tipo, range, custom)}</span>
        <button onClick={() => gerarDREPdf({ dre, periodoLabel: rotuloPeriodo(tipo, range, custom), periodoRange: range })} style={{ ...btnSmall, height: 36, fontSize: 12, marginLeft: 'auto' }}>📄 Exportar PDF</button>
      </div>

      {alertas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {alertas.map((a, i) => (
            <div key={i} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: a.tipo === 'danger' ? '#FEE2E2' : a.tipo === 'warn' ? '#FEF3C7' : '#DBEAFE', color: a.tipo === 'danger' ? '#991B1B' : a.tipo === 'warn' ? '#92400E' : '#1D4ED8' }}>{a.msg}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
        <KPI icone="💰" label="Ticket Médio" valor={fmtMoney(dre.ticketMedio)} />
        <KPI icone="📊" label="Pedidos entregues" valor={dre.qtdPedidos} />
        <KPI icone="👥" label="Clientes ativos" valor={dre.clientesAtivos} />
        <KPI icone="💳" label="Inadimplência" valor={dre.inadimplencia.toFixed(1) + '%'} sub="(% do total a receber)" />
      </div>

      <CardsMargens dre={dre} />

      {cfg?.dre_visao !== 'simplificado' && <div style={{ marginBottom: 14 }}><Waterfall dre={dre} /></div>}

      <DRETabela dre={dre} dreAnterior={dreAnt} onDrillDown={setDrillDown} />

      <DrillDownModal chave={drillDown} dados={dados} dre={dre} onClose={() => setDrillDown(null)} />
    </div>
  )
}
