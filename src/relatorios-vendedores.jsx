import { useState, useEffect, useMemo, useRef } from 'react'
import { fmtMoney, card } from './db.js'
import { Loader } from './components.jsx'
import { DateRangePicker, defaultRange, isoRange } from './date-range-picker.jsx'
import {
  fetchRankingVendedores, fetchTopProdutosVendedor, fetchTopClientesVendedor,
  fetchPedidosVendedor, fetchSegmentosClientes,
} from './relatorios-db.js'
import { baixarRelatorioVendedoresPdf } from './relatorios-vendedores-pdf.js'

const LS_FILTROS = 'valois_relatorio_vend_filtros'
const medalha = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`
const fmtDataCurta = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const groupBy = (rows, key = 'vendedor') => {
  const m = {}; (rows || []).forEach(r => { (m[r[key]] ||= []).push(r) }); return m
}

// ─────────────────────────── Sub-componentes ───────────────────────────

function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--valois-blue-soft)', borderRadius: 'var(--radius-control)', padding: 3, gap: 2 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
          fontSize: 13, fontWeight: value === o.key ? 700 : 600, whiteSpace: 'nowrap',
          background: value === o.key ? 'var(--valois-blue)' : 'transparent',
          color: value === o.key ? '#fff' : 'var(--valois-blue)',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

function ComissaoBadge({ pct, valor }) {
  const zero = !pct
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap',
      background: zero ? 'var(--background)' : 'var(--valois-green-soft)',
      color: zero ? 'var(--text-secondary)' : '#2F6B0E',
    }}>{zero ? '0% · —' : `${Number(pct)}% · ${fmtMoney(valor)}`}</span>
  )
}

function EmptyState({ msg }) {
  return (
    <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{msg}</div>
    </div>
  )
}

function SummaryCards({ ranking }) {
  const tot = ranking.reduce((s, v) => s + Number(v.faturamento || 0), 0)
  const ped = ranking.reduce((s, v) => s + Number(v.pedidos || 0), 0)
  const cards = [
    ['Faturamento (NF emitida)', fmtMoney(tot)],
    ['Pedidos', String(ped)],
    ['Ticket médio', fmtMoney(ped ? tot / ped : 0)],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 14 }}>
      {cards.map(([t, v]) => (
        <div key={t} style={{ ...card, marginBottom: 0, padding: 16, borderLeft: '4px solid var(--valois-blue)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{t}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function RankingRow({ v, i }) {
  const pct = Number(v.pct_participacao || 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
      <div style={{ width: 30, textAlign: 'center', fontSize: i < 3 ? 18 : 13, flexShrink: 0, color: 'var(--text-secondary)', fontWeight: 700 }}>{medalha(i)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vendedor}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{fmtMoney(v.faturamento)}</span>
        </div>
        <div style={{ height: 6, background: 'var(--background)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: 'var(--valois-blue)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {v.pedidos} pedido{v.pedidos !== 1 ? 's' : ''} · ticket {fmtMoney(v.ticket_medio)} · {pct.toFixed(1)}% de participação
        </div>
      </div>
    </div>
  )
}

const secTitle = { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '2px 0 6px' }
// SEMPRE duas colunas (1º–5º esquerda, 6º–10º direita) — nunca colapsar em lista única.
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 18px' }
const vazioStyle = { fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0 6px' }
// Ordenação aplicada no resultado FINAL exibido (garante decrescente mesmo pós-filtro).
const ordenarPorFaturamento = arr => [...(arr || [])].sort((a, b) => Number(b.faturamento || 0) - Number(a.faturamento || 0))

function VendedorSection({ v, i, produtos, clientes, pedidos, expanded, onToggle }) {
  const prod = produtos || [], cli = clientes || [], peds = pedidos || []
  const col = (arr, ini, fim) => arr.slice(ini, fim)
  const linhaProd = (p) => (
    <div key={p.posicao} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{p.posicao}.</span> {p.produto}
      </span>
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMoney(p.valor)}</span>
    </div>
  )
  const linhaCli = (c) => (
    <div key={c.posicao} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>{c.posicao}.</span> {c.cliente} <span style={{ opacity: 0.6 }}>({c.pedidos}p)</span>
      </span>
      <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMoney(c.valor)}</span>
    </div>
  )
  const totalPed = peds.reduce((s, p) => s + Number(p.valor_total || 0), 0)
  const totalCom = peds.reduce((s, p) => s + Number(p.comissao_valor || 0), 0)

  return (
    <div style={{ borderTop: i ? '1px solid var(--border)' : 'none' }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 4px', border: 'none',
        background: 'transparent', cursor: 'pointer', fontFamily: "'Inter',sans-serif", textAlign: 'left',
      }}>
        <span style={{ width: 30, textAlign: 'center', fontSize: i < 3 ? 18 : 13, color: 'var(--text-secondary)', fontWeight: 700, flexShrink: 0 }}>{medalha(i)}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {v.vendedor} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 12 }}>· {v.pedidos} pedidos</span>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{fmtMoney(v.faturamento)}</span>
        <ComissaoBadge pct={v.comissao_pct} valor={v.comissao_total} />
        <span style={{ color: 'var(--text-secondary)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: '4px 4px 18px' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Ticket médio {fmtMoney(v.ticket_medio)} · {Number(v.pct_participacao || 0).toFixed(1)}% do período
          </div>

          <div style={secTitle}>📦 Top 10 produtos vendidos</div>
          {prod.length === 0
            ? <div style={vazioStyle}>Sem itens lançados nos pedidos deste período.</div>
            : <div style={grid2}><div>{col(prod, 0, 5).map(linhaProd)}</div><div>{col(prod, 5, 10).map(linhaProd)}</div></div>}

          <div style={{ ...secTitle, marginTop: 16 }}>👥 Top 10 clientes</div>
          {cli.length === 0
            ? <div style={vazioStyle}>Sem clientes no período.</div>
            : <div style={grid2}><div>{col(cli, 0, 5).map(linhaCli)}</div><div>{col(cli, 5, 10).map(linhaCli)}</div></div>}

          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, margin: '2px 0 6px' }}>🧾 Pedidos do período</div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-control)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 460 }}>
              <thead>
                <tr style={{ background: 'var(--background)', color: 'var(--text-secondary)', fontSize: 11, textAlign: 'left' }}>
                  <th style={thTd}>Data</th><th style={thTd}>Cliente</th><th style={thTd}>Nº NF</th>
                  <th style={{ ...thTd, textAlign: 'right' }}>Valor</th><th style={{ ...thTd, textAlign: 'right' }}>Comissão</th>
                </tr>
              </thead>
              <tbody>
                {peds.map((p, k) => (
                  <tr key={k} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...thTd, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDataCurta(p.criado_em)}</td>
                    <td style={{ ...thTd, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente || '—'}</td>
                    <td style={{ ...thTd, color: 'var(--text-secondary)' }}>{p.numero_nf || '—'}</td>
                    <td style={{ ...thTd, textAlign: 'right', fontWeight: 600 }}>{fmtMoney(p.valor_total)}</td>
                    <td style={{ ...thTd, textAlign: 'right', color: p.comissao_valor > 0 ? '#2F6B0E' : 'var(--text-secondary)' }}>{p.comissao_valor > 0 ? fmtMoney(p.comissao_valor) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td style={thTd} colSpan={3}>Total · {peds.length} pedidos</td>
                  <td style={{ ...thTd, textAlign: 'right' }}>{fmtMoney(totalPed)}</td>
                  <td style={{ ...thTd, textAlign: 'right', color: totalCom > 0 ? '#2F6B0E' : 'var(--text-secondary)' }}>{totalCom > 0 ? fmtMoney(totalCom) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
const thTd = { padding: '7px 9px' }

function CheckChips({ options, selected, onToggle, render }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(o => {
        const on = selected.has(o.value)
        return (
          <button key={o.value} onClick={() => onToggle(o.value)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid ' + (on ? 'var(--valois-blue)' : 'var(--border)'),
            background: on ? 'var(--valois-blue-soft)' : 'var(--surface)', color: on ? 'var(--valois-blue)' : 'var(--text-secondary)',
            borderRadius: 8, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer', fontFamily: "'Inter',sans-serif", fontWeight: on ? 600 : 500,
          }}>
            <span style={{ fontSize: 12 }}>{on ? '☑' : '☐'}</span>{render ? render(o) : o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────── Componente principal ───────────────────────────

export default function RelatorioVendasVendedor() {
  const [tab, setTab] = useState('simples')
  const [range, setRange] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const [ranking, setRanking] = useState([])
  const [produtos, setProdutos] = useState({})
  const [clientes, setClientes] = useState({})
  const [pedidos, setPedidos] = useState({})

  const [expanded, setExpanded] = useState(() => new Set())
  const [segOptions, setSegOptions] = useState([]) // [{segmento, clientes}]
  const [vendSel, setVendSel] = useState(null) // Set | null (null = ainda não inicializado)
  const [segSel, setSegSel] = useState(null)
  const savedRef = useRef(null)
  const [gerando, setGerando] = useState(false)
  const [erroPdf, setErroPdf] = useState('')

  // Config salva (Personalizado) — carrega uma vez.
  useEffect(() => {
    try { savedRef.current = JSON.parse(localStorage.getItem(LS_FILTROS) || 'null') } catch { savedRef.current = null }
    fetchSegmentosClientes().then(r => setSegOptions(r.data || []))
  }, [])

  // Lista de vendedores p/ os checkboxes = ranking sem filtro do período atual.
  const [vendOptions, setVendOptions] = useState([])
  useEffect(() => {
    const [ini, fim] = isoRange(range)
    fetchRankingVendedores(ini, fim).then(r => setVendOptions((r.data || []).map(x => x.vendedor)))
  }, [range])

  // Inicializa seleção (salva > tudo marcado) quando as opções chegam.
  useEffect(() => {
    if (vendSel === null && vendOptions.length) {
      const saved = savedRef.current?.vendedores
      setVendSel(new Set(saved ? vendOptions.filter(v => saved.includes(v)) : vendOptions))
    }
  }, [vendOptions, vendSel])
  useEffect(() => {
    if (segSel === null && segOptions.length) {
      const saved = savedRef.current?.segmentos
      setSegSel(new Set(saved ? segOptions.map(s => s.segmento).filter(s => saved.includes(s)) : segOptions.map(s => s.segmento)))
    }
  }, [segOptions, segSel])

  // Persiste a config do Personalizado.
  useEffect(() => {
    if (vendSel === null || segSel === null) return
    localStorage.setItem(LS_FILTROS, JSON.stringify({ vendedores: [...vendSel], segmentos: [...segSel] }))
  }, [vendSel, segSel])

  // "tudo marcado" → null (sem filtro); nada marcado → [] (resultado vazio).
  const pick = (opts, sel) => {
    if (!sel) return null
    const on = opts.filter(o => sel.has(o))
    if (on.length === 0) return []
    if (on.length >= opts.length) return null
    return on
  }
  const isPerso = tab === 'personalizado'
  const vFilter = isPerso ? pick(vendOptions, vendSel) : null
  const sFilter = isPerso ? pick(segOptions.map(s => s.segmento), segSel) : null
  const filtroKey = isPerso ? JSON.stringify([vFilter, sFilter]) : ''

  // Busca de dados (agregação sempre no banco).
  useEffect(() => {
    let alive = true
    setLoading(true); setErro(null)
    const [ini, fim] = isoRange(range)
    async function run() {
      if (tab === 'simples') {
        const r = await fetchRankingVendedores(ini, fim)
        if (!alive) return
        setRanking(ordenarPorFaturamento(r.data)); setErro(r.error)
      } else {
        const [rk, pr, cl, pd] = await Promise.all([
          fetchRankingVendedores(ini, fim, vFilter, sFilter),
          fetchTopProdutosVendedor(ini, fim, { vendedores: vFilter, segmentos: sFilter }),
          fetchTopClientesVendedor(ini, fim, { vendedores: vFilter, segmentos: sFilter }),
          fetchPedidosVendedor(ini, fim, { vendedores: vFilter, segmentos: sFilter }),
        ])
        if (!alive) return
        setRanking(ordenarPorFaturamento(rk.data)); setProdutos(groupBy(pr.data)); setClientes(groupBy(cl.data)); setPedidos(groupBy(pd.data))
        setErro(rk.error || pr.error || cl.error || pd.error)
        setExpanded(new Set((rk.data || []).slice(0, 1).map(v => v.vendedor))) // 1º expandido
      }
      if (alive) setLoading(false)
    }
    // Personalizado espera a seleção inicializar.
    if (isPerso && (vendSel === null || segSel === null)) return
    run()
    return () => { alive = false }
  }, [tab, range, filtroKey, isPerso, vendSel, segSel])

  const toggle = (nome) => setExpanded(s => { const n = new Set(s); n.has(nome) ? n.delete(nome) : n.add(nome); return n })
  const allExpanded = ranking.length > 0 && ranking.every(v => expanded.has(v.vendedor))
  const toggleAll = () => setExpanded(allExpanded ? new Set() : new Set(ranking.map(v => v.vendedor)))

  const toggleSet = (setter) => (val) => setter(s => { const n = new Set(s); n.has(val) ? n.delete(val) : n.add(val); return n })
  const semSegCount = segOptions.find(s => s.segmento === 'Sem segmento')?.clientes || 0

  // Toast de erro do PDF some sozinho.
  useEffect(() => { if (!erroPdf) return; const t = setTimeout(() => setErroPdf(''), 4000); return () => clearTimeout(t) }, [erroPdf])

  // Filtros aplicados (só Personalizado) → cabeçalho do PDF. 'todos' quando nada foi restringido.
  const filtrosPdf = () => {
    if (!isPerso) return undefined
    const vArr = vendOptions.filter(v => (vendSel || new Set()).has(v))
    const sArr = segOptions.map(s => s.segmento).filter(s => (segSel || new Set()).has(s))
    return {
      vendedores: vArr.length >= vendOptions.length ? ['todos'] : vArr,
      segmentos: sArr.length >= segOptions.length ? ['todos'] : sArr,
    }
  }

  // Gera o PDF do relatório ATUAL com os MESMOS dados já na tela (nunca recalcula).
  const baixarPdf = async () => {
    setGerando(true); setErroPdf('')
    await new Promise(r => setTimeout(r, 30)) // deixa o "Gerando…" pintar antes do trabalho síncrono do jspdf
    try {
      baixarRelatorioVendedoresPdf({ tipo: tab, periodo: range, ranking, produtos, clientes, pedidos, filtros: filtrosPdf() })
    } catch (e) { console.error('PDF vendedores:', e); setErroPdf('Falha ao gerar o PDF. Tente novamente.') }
    finally { setGerando(false) }
  }

  return (
    <div style={{ maxWidth: 940, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Vendas por vendedor</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>Somente pedidos com NF emitida · ordenado por faturamento</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={baixarPdf} disabled={gerando || loading || !ranking.length} title="Baixar PDF do relatório atual" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 16px',
            borderRadius: 'var(--radius-control)', border: '1px solid var(--valois-blue)',
            background: gerando ? 'var(--valois-blue-soft)' : 'var(--valois-blue)',
            color: gerando ? 'var(--valois-blue)' : '#fff', fontSize: 14, fontWeight: 600, fontFamily: "'Inter',sans-serif",
            cursor: (gerando || loading || !ranking.length) ? 'default' : 'pointer',
            opacity: (loading || !ranking.length) && !gerando ? 0.55 : 1,
          }}>{gerando ? '⏳ Gerando…' : '⬇ Baixar PDF'}</button>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Segmented value={tab} onChange={setTab} options={[
          { key: 'simples', label: 'Simples' }, { key: 'completo', label: 'Completo' }, { key: 'personalizado', label: 'Personalizado' },
        ]} />
      </div>

      {isPerso && (
        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 7 }}>Vendedores</div>
          <CheckChips options={vendOptions.map(v => ({ value: v, label: v }))} selected={vendSel || new Set()} onToggle={toggleSet(setVendSel)} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 7px' }}>Segmentos do cliente</div>
          <CheckChips options={segOptions.map(s => ({ value: s.segmento, label: s.segmento, n: s.clientes }))} selected={segSel || new Set()} onToggle={toggleSet(setSegSel)}
            render={o => <>{o.label} <span style={{ opacity: 0.65 }}>({o.n})</span></>} />
          {semSegCount > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#8A5A00', background: '#FDF5E5', border: '1px solid #F5E3B8', borderRadius: 8, padding: '8px 10px' }}>
              ⚠️ {semSegCount} clientes sem segmento — não somem: entram no bucket “Sem segmento”.
            </div>
          )}
        </div>
      )}

      {loading ? <Loader /> : erro ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>
          Erro ao carregar o relatório. Tente novamente.
        </div>
      ) : ranking.length === 0 ? (
        <EmptyState msg="Nenhum pedido com NF emitida no período selecionado." />
      ) : tab === 'simples' ? (
        <>
          <SummaryCards ranking={ranking} />
          <div style={{ ...card, padding: 18 }}>
            {ranking.map((v, i) => <RankingRow key={v.vendedor} v={v} i={i} />)}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button onClick={toggleAll} style={{
              height: 32, padding: '0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--valois-blue)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter',sans-serif",
            }}>{allExpanded ? 'Recolher tudo' : 'Expandir tudo'}</button>
          </div>
          <div style={{ ...card, padding: '4px 14px' }}>
            {ranking.map((v, i) => (
              <VendedorSection key={v.vendedor} v={v} i={i}
                produtos={produtos[v.vendedor]} clientes={clientes[v.vendedor]} pedidos={pedidos[v.vendedor]}
                expanded={expanded.has(v.vendedor)} onToggle={() => toggle(v.vendedor)} />
            ))}
          </div>
        </>
      )}

      {erroPdf && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: 'var(--danger)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.22)' }}>
          {erroPdf}
        </div>
      )}
    </div>
  )
}
