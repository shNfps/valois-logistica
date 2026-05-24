import { useEffect, useMemo, useState } from 'react'
import { fmtMoney, card, btnPrimary, btnSmall, inputStyle } from './db.js'
import { Loader } from './components.jsx'
import {
  fetchDiagnosticoTop20,
  fetchDiagnosticoResumo,
  fetchUltimaVisita,
  criarVisitaRetencao,
  exportarDiagnosticoExcel
} from './relatorios-db.js'

const STATUS_INFO = {
  CRITICO:   { label: 'Crítico',    bg: '#FEE2E2', border: '#FECACA', color: '#991B1B', icon: '🔴' },
  ATENCAO:   { label: 'Atenção',    bg: '#FEF3C7', border: '#FDE68A', color: '#92400E', icon: '🟡' },
  ESTAVEL:   { label: 'Estável',    bg: '#E0F2FE', border: '#BAE6FD', color: '#075985', icon: '🔵' },
  CRESCENDO: { label: 'Crescendo',  bg: '#D1FAE5', border: '#A7F3D0', color: '#065F46', icon: '🟢' }
}

const fmtPct = (v) => v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

function StatusPill({ status }) {
  const info = STATUS_INFO[status] || STATUS_INFO.ESTAVEL
  return (
    <span style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}`,
                   padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                   letterSpacing: 0.4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {info.icon} {info.label}
    </span>
  )
}

function DeltaPill({ value, suffix = '%' }) {
  if (value == null) return <span style={{ color: '#94A3B8' }}>—</span>
  const positivo = value > 0
  const cor = Math.abs(value) < 5 ? '#64748B' : (positivo ? '#059669' : '#DC2626')
  return <span style={{ color: cor, fontWeight: 600 }}>{positivo ? '+' : ''}{Number(value).toFixed(1)}{suffix}</span>
}

// Mini bar chart SVG dos últimos 12 meses
function MiniChart({ fatMensal }) {
  if (!fatMensal || typeof fatMensal !== 'object') return null
  const meses = Object.keys(fatMensal).sort()
  if (!meses.length) return null
  const valores = meses.map(m => Number(fatMensal[m] || 0))
  const max = Math.max(...valores, 1)
  const W = 360, H = 110, BW = (W - 20) / meses.length
  return (
    <svg width={W} height={H + 26} style={{ display: 'block' }}>
      {valores.map((v, i) => {
        const h = (v / max) * H
        const x = 10 + i * BW
        const y = H - h
        return (
          <g key={i}>
            <rect x={x + 2} y={y} width={BW - 4} height={h} rx={2} fill="#3B82F6" opacity={0.85}>
              <title>{`${meses[i]}: ${fmtMoney(v)}`}</title>
            </rect>
            <text x={x + BW / 2} y={H + 14} fontSize={9} textAnchor="middle" fill="#64748B" fontFamily="Inter,sans-serif">
              {meses[i].slice(2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
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

function ModalAgendar({ linha, user, onClose, onSaved }) {
  const [data, setData] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [vendedor, setVendedor] = useState(linha?.vendedor_nome || '')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!data) { alert('Defina a data da visita'); return }
    setSalvando(true)
    const { error } = await criarVisitaRetencao({
      cliente_id: linha.cliente_id,
      vendedor_responsavel: vendedor || null,
      data_agendada: data,
      observacao: obs || null,
      status: 'AGENDADA',
      criado_por: user.nome
    })
    setSalvando(false)
    if (error) { alert('Erro ao agendar: ' + (error.message || 'desconhecido')); return }
    onSaved?.()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 460 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📅 Agendar visita</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>{linha.nome} · {linha.cidade || 'sem cidade'}</div>

        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Data</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />

        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Vendedor responsável</label>
        <input type="text" value={vendedor} onChange={e => setVendedor(e.target.value)} placeholder="Nome do vendedor" style={{ ...inputStyle, marginBottom: 12 }} />

        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Observação / roteiro</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={4}
          placeholder="O que cobrir na visita (ex: SKUs descontinuados, mudança de preço, etc)"
          style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 16, resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnSmall, height: 36, padding: '0 16px' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Agendar visita'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalVisitado({ linha, user, onClose, onSaved }) {
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    const { error } = await criarVisitaRetencao({
      cliente_id: linha.cliente_id,
      vendedor_responsavel: linha.vendedor_nome || null,
      data_agendada: new Date().toISOString().slice(0, 10),
      data_realizada: new Date().toISOString(),
      observacao: obs || null,
      status: 'REALIZADA',
      criado_por: user.nome
    })
    setSalvando(false)
    if (error) { alert('Erro ao registrar: ' + (error.message || 'desconhecido')); return }
    onSaved?.()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 22, width: '100%', maxWidth: 460 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>✅ Marcar como visitado</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>{linha.nome}</div>

        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>O que rolou na visita</label>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={5}
          placeholder="Observações da visita realizada"
          style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 16, resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnSmall, height: 36, padding: '0 16px' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Registrar visita'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LinhaExpandida({ linha }) {
  return (
    <div style={{ padding: 18, background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Faturamento mensal (últimos 12 meses)
          </div>
          <MiniChart fatMensal={linha.fat_mensal} />

          <div style={{ marginTop: 16, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748B' }}>YoY jan-abr</div>
              <div style={{ fontWeight: 700 }}><DeltaPill value={linha.yoy_pct} /></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B' }}>YoY móvel 90d</div>
              <div style={{ fontWeight: 700 }}><DeltaPill value={linha.yoy_90d_pct} /></div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#64748B' }}>vs. mediana segmento</div>
              <div style={{ fontWeight: 700 }}>
                {linha.yoy_segmento_mediana == null ? '—' : (
                  <>
                    <DeltaPill value={linha.yoy_segmento_mediana} />
                    <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>mediana</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Top 5 SKUs (valor 12m)
          </div>
          {Array.isArray(linha.top5_skus) && linha.top5_skus.length ? (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {linha.top5_skus.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '4px 6px', color: '#64748B', width: 50 }}>{s.codigo}</td>
                    <td style={{ padding: '4px 6px' }}>{s.nome}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div style={{ fontSize: 12, color: '#94A3B8' }}>Sem SKUs com código.</div>}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          🚨 SKUs descontinuados (comprou em 90d anteriores, NÃO comprou em 90d recentes)
        </div>
        {Array.isArray(linha.skus_descontinuados) && linha.skus_descontinuados.length ? (
          <div style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FEF2F2' }}>
                <tr>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: '#991B1B' }}>Código</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: '#991B1B' }}>Produto</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: '#991B1B' }}>Qtd anterior</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 10, color: '#991B1B' }}>Valor perdido</th>
                </tr>
              </thead>
              <tbody>
                {linha.skus_descontinuados.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F5D5D5' }}>
                    <td style={{ padding: '5px 10px', color: '#64748B' }}>{s.codigo}</td>
                    <td style={{ padding: '5px 10px' }}>{s.nome}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right' }}>{Number(s.qtd_anterior || 0).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#991B1B' }}>{fmtMoney(s.valor_perdido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ fontSize: 12, color: '#94A3B8' }}>Nenhum SKU descontinuado — cliente mantém o mix.</div>}
      </div>
    </div>
  )
}

export default function RelatorioDiagnosticoTop20({ user }) {
  const [loading, setLoading] = useState(true)
  const [linhas, setLinhas] = useState([])
  const [resumo, setResumo] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [ordenacao, setOrdenacao] = useState({ campo: 'fat_12m', dir: 'desc' })
  const [expandida, setExpandida] = useState(null)
  const [modalAgendar, setModalAgendar] = useState(null)
  const [modalVisitado, setModalVisitado] = useState(null)
  const [ultimasVisitas, setUltimasVisitas] = useState({})

  const carregar = async () => {
    setLoading(true)
    const [l, r] = await Promise.all([fetchDiagnosticoTop20(), fetchDiagnosticoResumo()])
    setLinhas(l); setResumo(r)
    // últimas visitas por cliente (mostradas como indicador na linha)
    const map = {}
    await Promise.all(l.map(async row => {
      const v = await fetchUltimaVisita(row.cliente_id)
      if (v) map[row.cliente_id] = v
    }))
    setUltimasVisitas(map)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const linhasFiltradas = useMemo(() => {
    let arr = filtroStatus === 'todos' ? linhas : linhas.filter(l => l.status === filtroStatus)
    arr = [...arr].sort((a, b) => {
      const va = a[ordenacao.campo], vb = b[ordenacao.campo]
      if (va == null) return 1; if (vb == null) return -1
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
      return ordenacao.dir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [linhas, filtroStatus, ordenacao])

  const contagens = useMemo(() => {
    const c = { CRITICO: { qtd: 0, fat: 0 }, ATENCAO: { qtd: 0, fat: 0 }, ESTAVEL: { qtd: 0, fat: 0 }, CRESCENDO: { qtd: 0, fat: 0 } }
    linhas.forEach(l => { if (c[l.status]) { c[l.status].qtd++; c[l.status].fat += Number(l.fat_12m || 0) } })
    return c
  }, [linhas])

  const trocarOrdem = (campo) => {
    setOrdenacao(o => o.campo === campo ? { campo, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' })
  }

  const setaOrdem = (campo) => ordenacao.campo === campo ? (ordenacao.dir === 'asc' ? ' ↑' : ' ↓') : ''

  if (loading) return <Loader />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>🔬 Diagnóstico Top 20 Clientes</h2>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Risco de churn e oportunidades de retenção · últimos 12 meses</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportarDiagnosticoExcel(linhasFiltradas)} style={{ ...btnPrimary, background: '#059669' }}>
            📊 Exportar Excel
          </button>
          <button onClick={carregar} style={btnSmall}>🔄 Recarregar</button>
        </div>
      </div>

      {/* Cards resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 }}>
        <Card
          titulo="🔴 Clientes Críticos"
          valor={contagens.CRITICO.qtd}
          sub={`${fmtMoney(contagens.CRITICO.fat)} em risco`}
          cor="#DC2626" bg="#FEF2F2"
        />
        <Card
          titulo="🟡 Em Atenção"
          valor={contagens.ATENCAO.qtd}
          sub={`${fmtMoney(contagens.ATENCAO.fat)} associado`}
          cor="#D97706" bg="#FFFBEB"
        />
        <Card
          titulo="Top 20 · Concentração"
          valor={resumo ? `${fmtMoney(resumo.fat_top20_12m)}` : '—'}
          sub={resumo ? `${Number(resumo.pct_concentracao || 0).toFixed(1)}% do faturamento total da empresa` : ''}
          cor="#3B82F6"
        />
        <Card
          titulo="Tendência (90d vs 90d anteriores)"
          valor={resumo ? <DeltaPill value={resumo.tendencia_pct} /> : '—'}
          sub={resumo ? `${fmtMoney(resumo.fat_top20_90d)} agora · ${fmtMoney(resumo.fat_top20_90d_anterior)} antes` : ''}
          cor={resumo && (resumo.tendencia_pct || 0) >= 0 ? '#059669' : '#DC2626'}
        />
      </div>

      {/* Filtros */}
      <div style={{ ...card, padding: 10, marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginRight: 6 }}>Filtrar:</span>
        {[['todos', `Todos (${linhas.length})`], ...Object.entries(STATUS_INFO).map(([k, v]) => [k, `${v.icon} ${v.label} (${contagens[k]?.qtd || 0})`])].map(([k, l]) => (
          <button key={k} onClick={() => setFiltroStatus(k)} style={{
            ...btnSmall,
            background: filtroStatus === k ? '#0F172A' : '#F1F5F9',
            color:      filtroStatus === k ? '#fff'    : '#0F172A',
            fontWeight: filtroStatus === k ? 700 : 500
          }}>{l}</button>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={th()}></th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'left' }} onClick={() => trocarOrdem('nome')}>Cliente{setaOrdem('nome')}</th>
                <th style={th()}>Cidade</th>
                <th style={th()}>Segmento</th>
                <th style={th()}>Vendedor</th>
                <th style={{ ...th(), cursor: 'pointer' }} onClick={() => trocarOrdem('status')}>Status{setaOrdem('status')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('fat_12m')}>Fat 12m{setaOrdem('fat_12m')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('yoy_pct')}>YoY{setaOrdem('yoy_pct')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('yoy_90d_pct')}>YoY 90d{setaOrdem('yoy_90d_pct')}</th>
                <th style={{ ...th(), textAlign: 'right' }}>Ticket 12p</th>
                <th style={{ ...th(), textAlign: 'right' }}>Ticket 3p</th>
                <th style={{ ...th(), textAlign: 'right' }}>SKUs 90d</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('mix_var_pct')}>Mix Δ{setaOrdem('mix_var_pct')}</th>
                <th style={{ ...th(), cursor: 'pointer', textAlign: 'right' }} onClick={() => trocarOrdem('dias_sem_pedido')}>Dias sem{setaOrdem('dias_sem_pedido')}</th>
                <th style={th()}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhasFiltradas.map((l) => {
                const info = STATUS_INFO[l.status] || STATUS_INFO.ESTAVEL
                const aberta = expandida === l.cliente_id
                const ultima = ultimasVisitas[l.cliente_id]
                const podeAgendar = l.status === 'CRITICO' || l.status === 'ATENCAO'
                return (
                  <>
                    <tr key={l.cliente_id} style={{ borderTop: '1px solid #E2E8F0', background: aberta ? info.bg : '#fff' }}>
                      <td style={td()}>
                        <button onClick={() => setExpandida(aberta ? null : l.cliente_id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#0F172A' }}>{aberta ? '▾' : '▸'}</button>
                      </td>
                      <td style={{ ...td(), fontWeight: 600 }}>
                        {l.nome}
                        {ultima && <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                          📌 última visita {ultima.status === 'AGENDADA' ? 'agendada' : 'registrada'} em {fmtDate(ultima.data_agendada || ultima.criado_em)}
                        </div>}
                      </td>
                      <td style={td()}>{l.cidade || '—'}</td>
                      <td style={td()}>{l.segmento || <span style={{ color: '#CBD5E1', fontSize: 10 }}>—</span>}</td>
                      <td style={td()}>{l.vendedor_nome || '—'}</td>
                      <td style={td()}><StatusPill status={l.status} /></td>
                      <td style={{ ...td(), textAlign: 'right', fontWeight: 700 }}>{fmtMoney(l.fat_12m)}</td>
                      <td style={{ ...td(), textAlign: 'right' }}><DeltaPill value={l.yoy_pct} /></td>
                      <td style={{ ...td(), textAlign: 'right' }}><DeltaPill value={l.yoy_90d_pct} /></td>
                      <td style={{ ...td(), textAlign: 'right' }}>{fmtMoney(l.ticket_medio_12p)}</td>
                      <td style={{ ...td(), textAlign: 'right' }}>{fmtMoney(l.ticket_medio_3p)}</td>
                      <td style={{ ...td(), textAlign: 'right' }}>{l.skus_90d} <span style={{ color: '#94A3B8' }}>/ {l.skus_12m}</span></td>
                      <td style={{ ...td(), textAlign: 'right' }}><DeltaPill value={l.mix_var_pct} /></td>
                      <td style={{ ...td(), textAlign: 'right', fontWeight: l.dias_sem_pedido > 60 ? 700 : 400, color: l.dias_sem_pedido > 60 ? '#991B1B' : l.dias_sem_pedido > 30 ? '#92400E' : '#0F172A' }}>{l.dias_sem_pedido ?? '—'}</td>
                      <td style={{ ...td(), whiteSpace: 'nowrap' }}>
                        <button onClick={() => setModalVisitado(l)} style={{ ...btnSmall, fontSize: 11, padding: '0 8px', height: 28 }}>✅ Visitado</button>
                        {podeAgendar && (
                          <button onClick={() => setModalAgendar(l)} style={{ ...btnSmall, fontSize: 11, padding: '0 8px', height: 28, marginLeft: 4, background: '#FEF3C7', color: '#92400E' }}>📅 Agendar</button>
                        )}
                      </td>
                    </tr>
                    {aberta && (
                      <tr>
                        <td colSpan={15} style={{ padding: 0 }}><LinhaExpandida linha={l} /></td>
                      </tr>
                    )}
                  </>
                )
              })}
              {linhasFiltradas.length === 0 && (
                <tr><td colSpan={15} style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Nenhum cliente nesse filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAgendar  && <ModalAgendar  linha={modalAgendar}  user={user} onClose={() => setModalAgendar(null)}  onSaved={carregar} />}
      {modalVisitado && <ModalVisitado linha={modalVisitado} user={user} onClose={() => setModalVisitado(null)} onSaved={carregar} />}
    </div>
  )
}

const th = () => ({ padding: '10px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569', textAlign: 'center', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' })
const td = () => ({ padding: '10px 8px', fontSize: 12, color: '#0F172A', verticalAlign: 'middle' })
