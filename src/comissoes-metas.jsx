import { useState, useEffect, useCallback } from 'react'
import { fmtMoney, fmt, getRef, btnPrimary, btnSmall, card, inputStyle, fetchClientes, fetchMetas, saveMeta, deleteMeta, STATUS_MAP } from './db.js'
import { AvatarByNome } from './avatar.jsx'

// ─── BARRA DE PROGRESSO ───
export function BarraProgresso({ atual, meta, label }) {
  const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0
  const cor = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444'
  const bateu = pct >= 100
  return (
    <div style={{ marginBottom: 14 }}>
      <style>{`@keyframes shine{0%{opacity:.7}50%{opacity:1}100%{opacity:.7}}@keyframes pulse-green{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {bateu && <span style={{ fontSize: 16, animation: 'pulse-green 1s infinite' }}>🎉</span>}
          <span style={{ fontSize: 13, fontWeight: 800, color: cor }}>{Math.round(pct)}%</span>
        </div>
      </div>
      <div style={{ height: 20, borderRadius: 10, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 10, transition: 'width 0.8s ease', minWidth: pct > 0 ? 8 : 0, position: 'relative' }}>
          {bateu && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)', animation: 'shine 1.5s infinite' }} />}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{fmtMoney(atual)} / {fmtMoney(meta)}</div>
    </div>
  )
}

// ─── SEÇÃO DE METAS NO DASHBOARD ───
export function MetasProgressSection({ pedidos, vendedorNome }) {
  const [metas, setMetas] = useState([])
  useEffect(() => { fetchMetas().then(setMetas) }, [])
  const pv = pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const now = new Date()
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1)
  const semIni = new Date(now); semIni.setDate(now.getDate() - now.getDay()); semIni.setHours(0, 0, 0, 0)
  const semFim = new Date(semIni); semFim.setDate(semIni.getDate() + 6); semFim.setHours(23, 59, 59)
  const tMes = pv.filter(p => new Date(p.criado_em) >= mesIni).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tSemana = pv.filter(p => { const d = new Date(p.criado_em); return d >= semIni && d <= semFim }).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const mSemana = metas.find(m => m.tipo === 'semanal' && (!m.vendedor_nome || m.vendedor_nome === vendedorNome))
  const mMes = metas.find(m => m.tipo === 'mensal' && (!m.vendedor_nome || m.vendedor_nome === vendedorNome))
  if (!mSemana && !mMes) return null
  return (
    <div style={{ ...card, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>🎯 Metas</div>
      {mSemana && <BarraProgresso atual={tSemana} meta={Number(mSemana.valor_meta)} label="Meta Semanal" />}
      {mMes && <BarraProgresso atual={tMes} meta={Number(mMes.valor_meta)} label="Meta Mensal" />}
    </div>
  )
}

// ─── COMISSÕES TAB (admin) ─── cards clicáveis e expansíveis
export function ComissoesTab({ pedidos }) {
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [periodo, setPeriodo] = useState('atual')
  const [mesAno, setMesAno] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}` })
  const [expandido, setExpandido] = useState(null)
  useEffect(() => { fetchClientes().then(setClientes) }, [])

  const getRange = () => {
    if (periodo === 'atual') { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59)] }
    if (periodo === 'anterior') { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0, 23, 59, 59)] }
    const [y, m] = mesAno.split('-').map(Number); return [new Date(y, m - 1, 1), new Date(y, m, 0, 23, 59, 59)]
  }

  const [start, end] = getRange()
  const pedNoPeriodo = pedidos.filter(p => { const d = new Date(p.criado_em); return d >= start && d <= end })

  const vMap = {}
  pedNoPeriodo.forEach(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    const v = c?.vendedor_nome || 'Valois'
    if (!vMap[v]) vMap[v] = { pedidos: [], totalEntregue: 0 }
    vMap[v].pedidos.push(p)
    if (p.status === 'ENTREGUE') vMap[v].totalEntregue += Number(p.valor_total) || 0
  })

  const grupos = Object.entries(vMap).sort((a, b) => b[1].totalEntregue - a[1].totalEntregue)
  const totalGeral = grupos.reduce((s, [, g]) => s + g.totalEntregue, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['atual', 'Mês Atual'], ['anterior', 'Mês Anterior'], ['custom', 'Escolher']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: periodo === k ? '#0A1628' : '#E2E8F0', color: periodo === k ? '#fff' : '#64748B', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>{l}</button>
        ))}
        {periodo === 'custom' && <input type="month" value={mesAno} onChange={e => setMesAno(e.target.value)} style={{ ...inputStyle, width: 160, padding: '6px 10px' }} />}
      </div>
      <div style={{ ...card, background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: 1 }}>Total Comissões (entregues)</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', margin: '4px 0 2px' }}>{fmtMoney(totalGeral * 0.05)}</div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>5% de {fmtMoney(totalGeral)} entregues</div>
      </div>
      {grupos.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Nenhum pedido no período</div>}
      {grupos.map(([nome, g]) => {
        const aberto = expandido === nome
        const byStatus = {}; g.pedidos.forEach(p => { byStatus[p.status] = (byStatus[p.status] || { count: 0, valor: 0 }); byStatus[p.status].count++; byStatus[p.status].valor += Number(p.valor_total) || 0 })
        return (
          <div key={nome} style={{ ...card, borderLeft: '4px solid #10B981', cursor: 'pointer' }} onClick={() => setExpandido(aberto ? null : nome)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AvatarByNome nome={nome} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0A1628' }}>{nome}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{g.pedidos.length} pedido{g.pedidos.length !== 1 ? 's' : ''} no período · {aberto ? '▲ Fechar' : '▼ Ver detalhes'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Comissão 5%</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{fmtMoney(g.totalEntregue * 0.05)}</div>
              </div>
            </div>
            {aberto && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E2E8F0' }} onClick={e => e.stopPropagation()}>
                {g.pedidos.map(p => {
                  const s = STATUS_MAP[p.status] || { label: p.status, color: '#64748B', bg: '#F1F5F9' }
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#F1F5F9', color: '#64748B', padding: '1px 5px', borderRadius: 4 }}>{getRef(p)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0A1628', flex: 1, minWidth: 100 }}>{p.cliente}</span>
                      {p.cidade && <span style={{ fontSize: 11, color: '#94A3B8' }}>📍{p.cidade}</span>}
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>{fmtMoney(p.valor_total || 0)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 6px', borderRadius: 6 }}>{s.label}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{fmt(p.criado_em)}</span>
                    </div>
                  )
                })}
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10 }}>
                  {Object.entries(byStatus).map(([st, d]) => {
                    const s = STATUS_MAP[st] || { label: st, color: '#64748B' }
                    return <div key={st} style={{ fontSize: 12, color: '#334155', marginBottom: 3 }}><span style={{ color: s.color, fontWeight: 700 }}>{s.label}:</span> {fmtMoney(d.valor)} ({d.count} pedido{d.count !== 1 ? 's' : ''})</div>
                  })}
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, color: '#059669' }}>
                    Comissão: 5% de {fmtMoney(g.totalEntregue)} = {fmtMoney(g.totalEntregue * 0.05)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── METAS TAB (admin) ───
export function MetasTab({ pedidos }) {
  const [metas, setMetas] = useState([])
  const [tipo, setTipo] = useState('semanal')
  const [valor, setValor] = useState('')
  const [vendNome, setVendNome] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => setMetas(await fetchMetas()), [])
  useEffect(() => { load() }, [load])
  const getPeriodo = t => {
    const n = new Date()
    if (t === 'semanal') { const ini = new Date(n); ini.setDate(n.getDate() - n.getDay()); ini.setHours(0, 0, 0, 0); const fim = new Date(ini); fim.setDate(ini.getDate() + 6); return { ini, fim } }
    return { ini: new Date(n.getFullYear(), n.getMonth(), 1), fim: new Date(n.getFullYear(), n.getMonth() + 1, 0) }
  }
  const criar = async () => {
    if (!valor || isNaN(Number(valor)) || Number(valor) <= 0) { alert('Informe o valor da meta'); return }
    setSaving(true)
    const { ini, fim } = getPeriodo(tipo)
    await saveMeta({ tipo, valor_meta: Number(valor), periodo_inicio: ini.toISOString().split('T')[0], periodo_fim: fim.toISOString().split('T')[0], vendedor_nome: vendNome.trim() || null })
    setValor(''); setVendNome(''); await load(); setSaving(false)
  }
  const pv = pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const { ini: sIni, fim: sFim } = getPeriodo('semanal'); const { ini: mIni } = getPeriodo('mensal')
  const tS = pv.filter(p => { const d = new Date(p.criado_em); return d >= sIni && d <= sFim }).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tM = pv.filter(p => new Date(p.criado_em) >= mIni).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const mS = metas.find(m => m.tipo === 'semanal' && !m.vendedor_nome)
  const mM = metas.find(m => m.tipo === 'mensal' && !m.vendedor_nome)
  return (
    <div>
      {(mS || mM) && <div style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Progresso Atual</div>
        {mS && <BarraProgresso atual={tS} meta={Number(mS.valor_meta)} label="🎯 Meta Semanal (geral)" />}
        {mM && <BarraProgresso atual={tM} meta={Number(mM.valor_meta)} label="📅 Meta Mensal (geral)" />}
      </div>}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0A1628' }}>Definir Meta</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['semanal', 'mensal'].map(t => <button key={t} onClick={() => setTipo(t)} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: tipo === t ? '#0A1628' : '#E2E8F0', color: tipo === t ? '#fff' : '#64748B', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>{t === 'semanal' ? '📅 Semanal' : '📆 Mensal'}</button>)}
        </div>
        <input value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Valor da meta (ex: 15000)" inputMode="decimal" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={vendNome} onChange={e => setVendNome(e.target.value)} placeholder="Vendedor (vazio = meta geral pra todos)" style={{ ...inputStyle, marginBottom: 14 }} />
        <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '✓ Definir Meta'}</button>
      </div>
      {metas.length > 0 && <><div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2 }}>Metas Ativas ({metas.length})</div>
        {metas.map(m => (<div key={m.id} style={{ ...card, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><span style={{ fontWeight: 700, color: '#0A1628', fontSize: 13 }}>{m.tipo === 'semanal' ? '📅' : '📆'} {m.tipo} — {fmtMoney(m.valor_meta)}</span>{m.vendedor_nome && <span style={{ fontSize: 11, color: '#64748B', marginLeft: 8 }}>({m.vendedor_nome})</span>}<div style={{ fontSize: 11, color: '#94A3B8' }}>{m.periodo_inicio} → {m.periodo_fim}</div></div>
          <button onClick={async () => { await deleteMeta(m.id); load() }} style={{ ...btnSmall, fontSize: 11, padding: '3px 8px', color: '#EF4444' }}>✗</button>
        </div>))}</>}
    </div>
  )
}
