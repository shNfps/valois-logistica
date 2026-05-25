import { useEffect, useMemo, useState } from 'react'
import { fmtMoney, card, btnPrimary, btnSmall, inputStyle } from './db.js'
import { Loader } from './components.jsx'
import {
  fetchTop50Produtos,
  fetchUltimasCotacoes,
  criarCotacaoSku,
  exportarTop50Excel
} from './relatorios-db.js'

const STATUS_INFO = {
  CRITICO:   { label: 'Crítico',   bg: '#FEE2E2', border: '#FECACA', color: '#991B1B', icon: '🔴' },
  ATENCAO:   { label: 'Atenção',   bg: '#FEF3C7', border: '#FDE68A', color: '#92400E', icon: '🟡' },
  ESTAVEL:   { label: 'Estável',   bg: '#E0F2FE', border: '#BAE6FD', color: '#075985', icon: '🔵' },
  CRESCENDO: { label: 'Crescendo', bg: '#D1FAE5', border: '#A7F3D0', color: '#065F46', icon: '🟢' }
}
const ABC_INFO = {
  A: { label: 'A', bg: '#FEF3C7', color: '#92400E', desc: 'Top — até 80% acum.' },
  B: { label: 'B', bg: '#E0F2FE', color: '#075985', desc: '80-95% acum.' },
  C: { label: 'C', bg: '#F1F5F9', color: '#475569', desc: '>95% acum.' }
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : null

function StatusPill({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.ESTAVEL
  return (
    <span style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}`,
                   padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {info.icon} {info.label}
    </span>
  )
}

function AbcPill({ classe }) {
  const info = ABC_INFO[classe] || ABC_INFO.C
  return (
    <span title={info.desc} style={{ background: info.bg, color: info.color, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, letterSpacing: 0.4 }}>
      {info.label}
    </span>
  )
}

function DeltaPill({ value, suffix = '%' }) {
  if (value == null) return <span style={{ color: '#94A3B8' }}>—</span>
  const positivo = value > 0
  const cor = Math.abs(value) < 5 ? '#64748B' : (positivo ? '#059669' : '#DC2626')
  return <span style={{ color: cor, fontWeight: 600 }}>{positivo ? '+' : ''}{Number(value).toFixed(1)}{suffix}</span>
}

function Card({ titulo, valor, sub, cor, bg }) {
  return (
    <div style={{ ...card, marginBottom: 0, padding: 16, borderLeft: `4px solid ${cor}`, background: bg || '#fff' }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function ModalCotacao({ linha, user, ultima, onClose, onSaved }) {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [precoValois, setPrecoValois] = useState('')
  const [c1n, setC1n] = useState(''); const [c1p, setC1p] = useState('')
  const [c2n, setC2n] = useState(''); const [c2p, setC2p] = useState('')
  const [c3n, setC3n] = useState(''); const [c3p, setC3p] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  const num = v => v === '' || v == null ? null : Number(String(v).replace(',', '.'))

  const salvar = async () => {
    if (!data) { alert('Defina a data'); return }
    if (!precoValois) { alert('Preencha pelo menos o preço Valois'); return }
    setSalvando(true)
    const { error } = await criarCotacaoSku({
      sku_codigo: linha.codigo,
      data_cotacao: data,
      preco_valois: num(precoValois),
      preco_concorrente_1: num(c1p), nome_concorrente_1: c1n || null,
      preco_concorrente_2: num(c2p), nome_concorrente_2: c2n || null,
      preco_concorrente_3: num(c3p), nome_concorrente_3: c3n || null,
      observacao: obs || null,
      criado_por: user.nome
    })
    setSalvando(false)
    if (error) { alert('Erro: ' + (error.message || 'desconhecido')); return }
    onSaved?.(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 540, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>💰 Nova cotação</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>{linha.codigo} · {linha.nome_produto}</div>
        {ultima && (
          <div style={{ fontSize: 11, color: '#475569', background: '#F8FAFC', padding: '6px 10px', borderRadius: 6, marginBottom: 12 }}>
            Última cotação: {fmtDate(ultima.data_cotacao)} · Valois R$ {Number(ultima.preco_valois || 0).toFixed(2)}
            {ultima.melhor_concorrente_nome && ` · melhor: ${ultima.melhor_concorrente_nome} R$ ${Number(ultima.melhor_concorrente_preco || 0).toFixed(2)}`}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={lbl}>Data da cotação</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={lbl}>Preço Valois (R$)</label>
            <input type="text" inputMode="decimal" value={precoValois} onChange={e => setPrecoValois(e.target.value)} placeholder="0,00" style={inputStyle} />
          </div>
        </div>

        {[[c1n, setC1n, c1p, setC1p, 'Concorrente 1'],
          [c2n, setC2n, c2p, setC2p, 'Concorrente 2'],
          [c3n, setC3n, c3p, setC3p, 'Concorrente 3']].map(([n, setN, p, setP, lab], i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>{lab}</label>
              <input type="text" value={n} onChange={e => setN(e.target.value)} placeholder="Nome do concorrente" style={inputStyle} />
            </div>
            <div>
              <label style={lbl}>Preço (R$)</label>
              <input type="text" inputMode="decimal" value={p} onChange={e => setP(e.target.value)} placeholder="—" style={inputStyle} />
            </div>
          </div>
        ))}

        <label style={lbl}>Observação</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
          placeholder="Contexto da cotação (cliente, condições, etc.)"
          style={{ ...inputStyle, height: 'auto', padding: 10, resize: 'vertical', marginBottom: 14 }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnSmall, height: 36, padding: '0 16px' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar cotação'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LinhaExpandida({ linha, ultima }) {
  const lista = Array.isArray(linha.top20_clientes) ? linha.top20_clientes : []
  return (
    <div style={{ padding: 18, background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Top {lista.length} clientes deste SKU (12m)
          </div>
          {lista.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94A3B8' }}>Nenhum cliente identificado (todos pedidos órfãos).</div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ background: '#F1F5F9', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '6px 10px', fontSize: 10, textAlign: 'left', color: '#475569' }}>#</th>
                    <th style={{ padding: '6px 10px', fontSize: 10, textAlign: 'left', color: '#475569' }}>Cliente</th>
                    <th style={{ padding: '6px 10px', fontSize: 10, textAlign: 'right', color: '#475569' }}>Qtd</th>
                    <th style={{ padding: '6px 10px', fontSize: 10, textAlign: 'right', color: '#475569' }}>Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '5px 10px', color: '#94A3B8', width: 28 }}>{i + 1}</td>
                      <td style={{ padding: '5px 10px', fontWeight: 600 }}>{c.nome || <em style={{ color: '#94A3B8' }}>(sem cadastro)</em>}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right' }}>{Number(c.qtd || 0).toLocaleString('pt-BR')}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(c.fat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            💰 Última cotação
          </div>
          {ultima ? (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, fontSize: 12 }}>
              <div style={{ marginBottom: 6 }}><strong>Data:</strong> {fmtDate(ultima.data_cotacao)}</div>
              <div style={{ marginBottom: 6 }}><strong>Valois:</strong> {fmtMoney(ultima.preco_valois)}</div>
              {ultima.melhor_concorrente_nome && (
                <div style={{ marginBottom: 6, padding: '6px 10px', background: '#FFFBEB', borderRadius: 6 }}>
                  <strong>Melhor concorrente:</strong> {ultima.melhor_concorrente_nome}<br/>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>{fmtMoney(ultima.melhor_concorrente_preco)}</span>
                  {ultima.preco_valois && ultima.melhor_concorrente_preco && (
                    <span style={{ marginLeft: 8, color: '#64748B', fontSize: 11 }}>
                      ({ultima.preco_valois > ultima.melhor_concorrente_preco
                          ? `+${((ultima.preco_valois - ultima.melhor_concorrente_preco) / ultima.melhor_concorrente_preco * 100).toFixed(1)}% vs Valois`
                          : `Valois mais barato em ${((ultima.melhor_concorrente_preco - ultima.preco_valois) / ultima.melhor_concorrente_preco * 100).toFixed(1)}%`})
                    </span>
                  )}
                </div>
              )}
              {ultima.observacao && <div style={{ color: '#475569', fontStyle: 'italic' }}>"{ultima.observacao}"</div>}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8, padding: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
              Nenhuma cotação registrada.<br/>Use o botão 💰 Cotar pra registrar.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RelatorioTop50Produtos({ user }) {
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [linhas, setLinhas] = useState([])
  const [cotacoes, setCotacoes] = useState({})
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroAbc, setFiltroAbc] = useState('todos')
  const [ordenacao, setOrdenacao] = useState({ campo: 'fat_12m', dir: 'desc' })
  const [expandida, setExpandida] = useState(null)
  const [modalCotacao, setModalCotacao] = useState(null)

  const carregar = async () => {
    setLoading(true); setErro(null)
    const resp = await fetchTop50Produtos()
    if (resp.error) { setErro(resp.error); setLinhas([]); setLoading(false); return }
    setLinhas(resp.data)
    // Cotações em lote
    const cods = resp.data.map(r => r.codigo).filter(Boolean)
    const cot = await fetchUltimasCotacoes(cods)
    setCotacoes(cot.data || {})
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const linhasFiltradas = useMemo(() => {
    let arr = linhas
    if (filtroStatus !== 'todos') arr = arr.filter(l => l.status === filtroStatus)
    if (filtroAbc    !== 'todos') arr = arr.filter(l => l.classe_abc === filtroAbc)
    arr = [...arr].sort((a, b) => {
      const va = a[ordenacao.campo], vb = b[ordenacao.campo]
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
      return ordenacao.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [linhas, filtroStatus, filtroAbc, ordenacao])

  const stats = useMemo(() => {
    const s = {
      A: { qtd: 0, fat: 0 }, B: { qtd: 0, fat: 0 }, C: { qtd: 0, fat: 0 },
      CRITICO: { qtd: 0, fat: 0 }, ATENCAO: { qtd: 0, fat: 0 },
      ESTAVEL: { qtd: 0, fat: 0 }, CRESCENDO: { qtd: 0, fat: 0 },
      total_fat: 0
    }
    linhas.forEach(l => {
      const fat = Number(l.fat_12m || 0)
      s.total_fat += fat
      if (s[l.classe_abc]) { s[l.classe_abc].qtd++; s[l.classe_abc].fat += fat }
      if (s[l.status])     { s[l.status].qtd++;     s[l.status].fat += fat }
    })
    return s
  }, [linhas])

  const trocarOrdem = (campo) => {
    setOrdenacao(o => o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' })
  }
  const setaOrdem = (campo) => ordenacao.campo === campo ? (ordenacao.dir === 'asc' ? ' ↑' : ' ↓') : ''

  if (loading) return <Loader />

  if (erro) return (
    <div style={{ ...card, padding: 24, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>⚠️ Erro ao carregar o relatório</div>
      <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Mensagem:</strong> {erro.message || 'desconhecido'}</div>
      {erro.code    && <div style={{ fontSize: 12 }}><strong>Code:</strong> {erro.code}</div>}
      {erro.details && <div style={{ fontSize: 12 }}><strong>Details:</strong> {erro.details}</div>}
      {erro.hint    && <div style={{ fontSize: 12 }}><strong>Hint:</strong> {erro.hint}</div>}
      <button onClick={carregar} style={{ ...btnSmall, marginTop: 14 }}>🔄 Tentar novamente</button>
    </div>
  )

  const pctClasseA = stats.total_fat > 0 ? (stats.A.fat / stats.total_fat * 100) : 0
  const fatEmRisco = stats.CRITICO.fat + stats.ATENCAO.fat

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>📦 Top 50 Produtos por Faturamento</h2>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Curva ABC · risco de queda · cotação vs concorrência · últimos 12 meses</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportarTop50Excel(linhasFiltradas)} style={{ ...btnPrimary, background: '#059669' }}>📊 Exportar Excel</button>
          <button onClick={carregar} style={btnSmall}>🔄 Recarregar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card titulo="🏆 Classe A no Top 50" valor={stats.A.qtd}
              sub={`${fmtMoney(stats.A.fat)} acumulado`} cor="#D97706" bg="#FFFBEB" />
        <Card titulo="% Faturamento vindo de A" valor={`${pctClasseA.toFixed(1)}%`}
              sub={`do total do top 50`} cor="#3B82F6" />
        <Card titulo="🔴 SKUs CRÍTICO" valor={stats.CRITICO.qtd}
              sub={`${fmtMoney(stats.CRITICO.fat)} associado`} cor="#DC2626" bg="#FEF2F2" />
        <Card titulo="⚠️ Faturamento em risco" valor={fmtMoney(fatEmRisco)}
              sub={`CRÍTICO (${stats.CRITICO.qtd}) + ATENÇÃO (${stats.ATENCAO.qtd})`}
              cor={fatEmRisco > 0 ? '#B45309' : '#059669'} bg={fatEmRisco > 0 ? '#FFFBEB' : undefined} />
      </div>

      {/* Filtros */}
      <div style={{ ...card, padding: 10, marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginRight: 4 }}>Status:</span>
        {[['todos', `Todos (${linhas.length})`], ...Object.entries(STATUS_INFO).map(([k, v]) => [k, `${v.icon} ${v.label} (${stats[k]?.qtd || 0})`])].map(([k, l]) => (
          <button key={k} onClick={() => setFiltroStatus(k)} style={{
            ...btnSmall, height: 28,
            background: filtroStatus === k ? '#0F172A' : '#F1F5F9',
            color:      filtroStatus === k ? '#fff'    : '#0F172A',
            fontWeight: filtroStatus === k ? 700 : 500
          }}>{l}</button>
        ))}
        <div style={{ width: 1, height: 22, background: '#E2E8F0', margin: '0 6px' }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginRight: 4 }}>ABC:</span>
        {[['todos', `Todos`], ['A', `A (${stats.A.qtd})`], ['B', `B (${stats.B.qtd})`], ['C', `C (${stats.C.qtd})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltroAbc(k)} style={{
            ...btnSmall, height: 28,
            background: filtroAbc === k ? '#0F172A' : '#F1F5F9',
            color:      filtroAbc === k ? '#fff'    : '#0F172A',
            fontWeight: filtroAbc === k ? 700 : 500
          }}>{l}</button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1200 }}>
            <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={th()}></th>
                <th style={th()}>Cód.</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'left' }} onClick={() => trocarOrdem('nome_produto')}>Produto{setaOrdem('nome_produto')}</th>
                <th style={th()}>Categoria</th>
                <th style={{ ...th(), cursor: 'pointer' }} onClick={() => trocarOrdem('classe_abc')}>ABC{setaOrdem('classe_abc')}</th>
                <th style={{ ...th(), cursor: 'pointer' }} onClick={() => trocarOrdem('status')}>Status{setaOrdem('status')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('fat_12m')}>Fat 12m{setaOrdem('fat_12m')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('pct_sobre_total')}>% total{setaOrdem('pct_sobre_total')}</th>
                <th style={{ ...th(), textAlign: 'right' }}>% acum</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('yoy_pct')}>YoY{setaOrdem('yoy_pct')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('tendencia_pct')}>Tend. 90d{setaOrdem('tendencia_pct')}</th>
                <th style={{ ...th(), textAlign: 'right' }}>Clientes 90d/12m</th>
                <th style={{ ...th(), textAlign: 'right' }}>Ticket méd</th>
                <th style={th()}>Cotação</th>
                <th style={th()}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map(l => {
                const aberta = expandida === l.codigo
                const info = STATUS_INFO[l.status] || STATUS_INFO.ESTAVEL
                const cot = cotacoes[l.codigo]
                return (
                  <>
                    <tr key={l.codigo} style={{ borderTop: '1px solid #E2E8F0', background: aberta ? info.bg : '#fff' }}>
                      <td style={td()}>
                        <button onClick={() => setExpandida(aberta ? null : l.codigo)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#0F172A' }}>
                          {aberta ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={{ ...td(), fontFamily: 'monospace', color: '#64748B' }}>{l.codigo}</td>
                      <td style={{ ...td(), fontWeight: 600, maxWidth: 320 }}>{l.nome_produto}</td>
                      <td style={{ ...td(), color: '#64748B' }}>{l.categoria || '—'}</td>
                      <td style={td()}><AbcPill classe={l.classe_abc} /></td>
                      <td style={td()}><StatusPill status={l.status} /></td>
                      <td style={{ ...td(), textAlign: 'right', fontWeight: 700 }}>{fmtMoney(l.fat_12m)}</td>
                      <td style={{ ...td(), textAlign: 'right' }}>{l.pct_sobre_total == null ? '—' : `${Number(l.pct_sobre_total).toFixed(2)}%`}</td>
                      <td style={{ ...td(), textAlign: 'right', color: '#64748B' }}>{l.pct_acumulado == null ? '—' : `${Number(l.pct_acumulado).toFixed(1)}%`}</td>
                      <td style={{ ...td(), textAlign: 'right' }}><DeltaPill value={l.yoy_pct} /></td>
                      <td style={{ ...td(), textAlign: 'right' }}><DeltaPill value={l.tendencia_pct} /></td>
                      <td style={{ ...td(), textAlign: 'right' }}>{l.qtd_clientes_unicos_90d} <span style={{ color: '#CBD5E1' }}>/</span> {l.qtd_clientes_unicos_12m}</td>
                      <td style={{ ...td(), textAlign: 'right' }}>{fmtMoney(l.ticket_medio_pedido)}</td>
                      <td style={td()}>
                        {cot ? (
                          <span style={{ fontSize: 11, color: '#475569' }} title={`Valois R$ ${Number(cot.preco_valois || 0).toFixed(2)}`}>
                            📌 {fmtDate(cot.data_cotacao)}
                          </span>
                        ) : <span style={{ fontSize: 11, color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td style={{ ...td(), whiteSpace: 'nowrap' }}>
                        <button onClick={() => setModalCotacao(l)} style={{ ...btnSmall, height: 28, fontSize: 11, background: '#FEF3C7', color: '#92400E' }}>💰 Cotar</button>
                      </td>
                    </tr>
                    {aberta && (
                      <tr><td colSpan={15} style={{ padding: 0 }}><LinhaExpandida linha={l} ultima={cot} /></td></tr>
                    )}
                  </>
                )
              })}
              {linhasFiltradas.length === 0 && (
                <tr><td colSpan={15} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Nenhum SKU nesse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalCotacao && (
        <ModalCotacao
          linha={modalCotacao} user={user}
          ultima={cotacoes[modalCotacao.codigo]}
          onClose={() => setModalCotacao(null)}
          onSaved={carregar}
        />
      )}
    </div>
  )
}

const th  = () => ({ padding: '10px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', textAlign: 'center', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' })
const td  = () => ({ padding: '10px 8px', fontSize: 12, color: '#0F172A', verticalAlign: 'middle' })
const lbl = { fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }
