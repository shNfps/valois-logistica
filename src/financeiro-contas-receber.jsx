import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card, fetchClientes } from './db.js'
import {
  fetchContasReceber, createContaReceber, updateContaReceber, deleteContaReceber,
  statusContaReceber, saldoAberto, valorRecebido, valorOriginal, diasAtrasoConta,
  contaEmAberto, contaVencida, registrarRecebimentoContaReceber, atualizarStatusContaReceber,
  isoHoje, diasAte, clientesInadimplentes, toCsv, downloadCsv,
} from './financeiro-db.js'
import { Field, FormAlert } from './field.jsx'
import { InadimplenciaCard } from './financeiro-inadimplencia.jsx'

const STATUS_LABEL = {
  PENDENTE:   { label: 'Pendente',   bg: '#FEF3C7', color: '#B45309' },
  RECEBIDO:   { label: 'Recebido',   bg: '#D1FAE5', color: '#065F46' },
  ATRASADO:   { label: 'Atrasado',   bg: '#FEE2E2', color: '#B91C1C' },
  CANCELADO:  { label: 'Cancelado',  bg: '#F1F5F9', color: '#64748B' },
  PARCIAL:    { label: 'Parcial',    bg: '#DBEAFE', color: '#1D4ED8' },
  RENEGOCIADO:{ label: 'Renegociado',bg: '#EDE9FE', color: '#6D28D9' },
}
const ORIGEM_LABEL = {
  pedido_nf: { label: 'Pedido/NF', bg: '#E0F2FE', color: '#0369A1' },
  manual:    { label: 'Manual',    bg: '#F1F5F9', color: '#475569' },
  backfill:  { label: 'Backfill',  bg: '#FEF9C3', color: '#854D0E' },
  banco:     { label: 'Banco',     bg: '#DCFCE7', color: '#166534' },
  cnab:      { label: 'CNAB',      bg: '#DCFCE7', color: '#166534' },
  webhook:   { label: 'Webhook',   bg: '#DCFCE7', color: '#166534' },
  csv:       { label: 'CSV',       bg: '#DCFCE7', color: '#166534' },
}
const FORMAS = [{ v: 'a_vista', l: 'À vista' }, { v: 'boleto', l: 'Boleto' }, { v: 'cartao', l: 'Cartão' }, { v: 'pix', l: 'PIX' }]
function fmtData(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('pt-BR') }

// ─── Modal de lançamento MANUAL/avulso (fora do fluxo de pedidos/NF) ───
function ContaManualModal({ editando, onClose, onSaved }) {
  const [cliente, setCliente] = useState(editando?.cliente_nome || '')
  const [numNf, setNumNf] = useState(editando?.numero_nf || '')
  const [valor, setValor] = useState(editando?.valor || '')
  const [dataEm, setDataEm] = useState(editando?.data_emissao || isoHoje())
  const [dataVenc, setDataVenc] = useState(editando?.data_vencimento || isoHoje())
  const [forma, setForma] = useState(editando?.forma_pagamento || 'boleto')
  const [obs, setObs] = useState(editando?.observacoes || '')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const salvar = async () => {
    setErro('')
    if (!cliente.trim() || !valor || !dataVenc) return setErro('Preencha cliente, valor e vencimento.')
    setSaving(true)
    const valorN = Number(valor)
    const base = { cliente_nome: cliente.trim(), numero_nf: numNf.trim() || null, valor: valorN, data_emissao: dataEm, data_vencimento: dataVenc, forma_pagamento: forma, observacoes: obs.trim() || null }
    if (editando) {
      const saldo = Math.max(valorN - Number(editando.valor_recebido || 0), 0)
      await updateContaReceber(editando.id, { ...base, saldo_em_aberto: saldo })
    } else {
      await createContaReceber({ ...base, origem: 'manual', valor_recebido: 0, saldo_em_aberto: valorN, status: diasAte(dataVenc) < 0 ? 'ATRASADO' : 'PENDENTE' })
    }
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, margin: '24px 0' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{editando ? 'Editar conta manual' : 'Nova conta manual (avulsa)'}</h3>
        <div style={{ marginBottom: 14 }}><FormAlert tipo="aviso">Use esta opção apenas para lançamentos manuais fora do fluxo de pedidos/NF. Cobranças de pedidos são geradas automaticamente ao anexar a NF.</FormAlert></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Cliente" required><input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" style={inputStyle} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nº NF"><input value={numNf} onChange={e => setNumNf(e.target.value)} style={inputStyle} /></Field>
            <Field label="Valor R$" required><input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" style={inputStyle} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Emissão"><input type="date" value={dataEm} onChange={e => setDataEm(e.target.value)} style={inputStyle} /></Field>
            <Field label="Vencimento" required><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} style={inputStyle} /></Field>
          </div>
          <Field label="Forma de pagamento"><select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>{FORMAS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}</select></Field>
          <Field label="Observações"><textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Observações" style={{ ...inputStyle, height: 'auto', padding: 10, resize: 'vertical' }} /></Field>
          {erro && <FormAlert tipo="erro">{erro}</FormAlert>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de BAIXA: recebimento total/parcial, cancelar, renegociar ───
const ACOES = [
  { k: 'total',   l: '✅ Receber total' },
  { k: 'parcial', l: '➗ Receber parcial' },
  { k: 'reneg',   l: '🤝 Renegociar' },
  { k: 'cancelar',l: '✖ Cancelar' },
]
function BaixaModal({ conta, onClose, onSaved }) {
  const saldo = saldoAberto(conta)
  const [acao, setAcao] = useState('total')
  const [data, setData] = useState(isoHoje())
  const [valorParc, setValorParc] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  if (!conta) return null
  const confirmar = async () => {
    setErro(''); setSaving(true)
    try {
      if (acao === 'total') {
        await registrarRecebimentoContaReceber({ contaId: conta.id, valorRecebido: saldo, dataRecebimento: data, origem: 'manual', observacao: obs.trim() || null })
      } else if (acao === 'parcial') {
        const v = Number(valorParc)
        if (!(v > 0)) { setErro('Informe um valor recebido maior que zero.'); setSaving(false); return }
        await registrarRecebimentoContaReceber({ contaId: conta.id, valorRecebido: v, dataRecebimento: data, origem: 'manual', observacao: obs.trim() || null })
      } else if (acao === 'reneg') {
        if (!obs.trim()) { setErro('Descreva a renegociação na observação.'); setSaving(false); return }
        await atualizarStatusContaReceber(conta.id, 'RENEGOCIADO', obs.trim())
      } else if (acao === 'cancelar') {
        if (!obs.trim()) { setErro('Justifique o cancelamento na observação.'); setSaving(false); return }
        await atualizarStatusContaReceber(conta.id, 'CANCELADO', obs.trim())
      }
      setSaving(false); onSaved(); onClose()
    } catch (e) { console.error(e); setErro('Erro ao salvar.'); setSaving(false) }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, margin: '24px 0' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17 }}>Baixa da conta</h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{conta.cliente_nome}{conta.numero_nf ? ` · NF ${conta.numero_nf}` : ''}</div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <span>Original: <b>{fmtMoney(valorOriginal(conta))}</b></span>
          <span>Recebido: <b>{fmtMoney(valorRecebido(conta))}</b></span>
          <span style={{ color: 'var(--danger)' }}>Saldo: <b>{fmtMoney(saldo)}</b></span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {ACOES.map(a => (
            <button key={a.k} onClick={() => setAcao(a.k)} style={{ ...btnSmall, fontSize: 12, background: acao === a.k ? 'var(--valois-blue)' : '#F1F5F9', color: acao === a.k ? '#fff' : 'var(--text-primary)', border: 'none' }}>{a.l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(acao === 'total' || acao === 'parcial') && <Field label="Data do recebimento"><input type="date" value={data} onChange={e => setData(e.target.value)} style={inputStyle} /></Field>}
          {acao === 'parcial' && <Field label="Valor recebido agora" required hint={`Saldo em aberto: ${fmtMoney(saldo)}`}><input type="number" step="0.01" value={valorParc} onChange={e => setValorParc(e.target.value)} placeholder="0,00" style={inputStyle} /></Field>}
          <Field label="Observação financeira" required={acao === 'reneg' || acao === 'cancelar'}><textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder={acao === 'reneg' ? 'Nova condição acordada...' : acao === 'cancelar' ? 'Motivo do cancelamento...' : 'Opcional'} style={{ ...inputStyle, height: 'auto', padding: 10, resize: 'vertical' }} /></Field>
          {erro && <FormAlert tipo="erro">{erro}</FormAlert>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
            <button onClick={confirmar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Confirmar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function aplicaPeriodo(periodo, c, custom) {
  const venc = c.data_vencimento; const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const isoH = hoje.toISOString().slice(0, 10)
  if (periodo === 'hoje') return venc === isoH
  if (periodo === 'semana') { const fim = new Date(hoje); fim.setDate(hoje.getDate() + 7); return venc >= isoH && venc <= fim.toISOString().slice(0, 10) }
  if (periodo === 'mes') { const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10); const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10); return venc >= ini && venc <= fim }
  if (periodo === 'custom') return (!custom.de || venc >= custom.de) && (!custom.ate || venc <= custom.ate)
  return true
}

export function ContasReceberTab() {
  const [items, setItems] = useState([])
  const [clientesById, setClientesById] = useState({})
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('todos')
  const [custom, setCustom] = useState({ de: '', ate: '' })
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [baixando, setBaixando] = useState(null)

  const load = useCallback(async () => { setItems(await fetchContasReceber()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { fetchClientes().then(cs => setClientesById(Object.fromEntries(cs.map(c => [c.id, c])))) }, [])

  const inadimp = useMemo(() => clientesInadimplentes(items, clientesById), [items, clientesById])

  const filtradas = useMemo(() => items.filter(c => {
    const eff = statusContaReceber(c)
    if (filtroStatus === 'atrasadas') { if (!contaVencida(c)) return false }
    else if (filtroStatus) { if (eff !== filtroStatus) return false }
    if (filtroCliente && c.cliente_nome !== filtroCliente) return false
    if (busca && !c.cliente_nome.toLowerCase().includes(busca.toLowerCase()) && !(c.numero_nf || '').includes(busca)) return false
    if (periodo !== 'todos' && !aplicaPeriodo(periodo, c, custom)) return false
    return true
  }), [items, filtroStatus, filtroCliente, busca, periodo, custom])

  const cards = useMemo(() => {
    const hoje = isoHoje()
    const ini = new Date(); ini.setDate(1); const iniIso = ini.toISOString().slice(0, 10)
    const fimSem = new Date(); fimSem.setDate(fimSem.getDate() + 7); const fimSemIso = fimSem.toISOString().slice(0, 10)
    const emAberto = items.filter(contaEmAberto)
    const atrasadas = items.filter(contaVencida)
    const semana = emAberto.filter(c => c.data_vencimento >= hoje && c.data_vencimento <= fimSemIso)
    const recebMes = items.filter(c => valorRecebido(c) > 0 && (c.data_ultimo_recebimento || c.data_recebimento || '') >= iniIso)
    const sumSaldo = a => a.reduce((s, x) => s + saldoAberto(x), 0)
    return {
      aReceber: sumSaldo(emAberto),
      atrasadas: { v: sumSaldo(atrasadas), n: atrasadas.length },
      semana: sumSaldo(semana),
      recebMes: recebMes.reduce((s, c) => s + valorRecebido(c), 0),
    }
  }, [items])

  const excluir = async (c) => { if (confirm(`Excluir lançamento manual de ${c.cliente_nome}?`)) { await deleteContaReceber(c.id); load() } }
  const exportar = () => {
    const headers = [
      { label: 'Cliente', get: c => c.cliente_nome }, { label: 'Vendedor', get: c => c.vendedor_nome || '' },
      { label: 'NF', get: c => c.numero_nf || '' }, { label: 'Origem', get: c => c.origem || '' },
      { label: 'Valor', get: c => valorOriginal(c).toFixed(2) }, { label: 'Recebido', get: c => valorRecebido(c).toFixed(2) },
      { label: 'Saldo', get: c => saldoAberto(c).toFixed(2) }, { label: 'Emissao', key: 'data_emissao' },
      { label: 'Vencimento', key: 'data_vencimento' }, { label: 'Dias atraso', get: c => diasAtrasoConta(c) },
      { label: 'Recebido em', get: c => c.data_ultimo_recebimento || c.data_recebimento || '' },
      { label: 'Forma', key: 'forma_pagamento' }, { label: 'Status', get: c => statusContaReceber(c) },
    ]
    downloadCsv(toCsv(filtradas, headers), `contas-receber-${isoHoje()}.csv`)
  }
  const clientesUnicos = useMemo(() => [...new Set(items.map(c => c.cliente_nome))].sort(), [items])

  const COLS = '1fr 96px 132px 104px 96px 96px'
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #0EA5E9', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>📊 Saldo a receber</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.aReceber)}</div></div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #B91C1C', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>🔴 Vencidas (saldo)</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.atrasadas.v)}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>{cards.atrasadas.n} conta{cards.atrasadas.n !== 1 ? 's' : ''}</div></div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #F59E0B', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>📅 Vence esta semana</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.semana)}</div></div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #059669', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>✅ Recebido no mês</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.recebMes)}</div></div>
      </div>

      <InadimplenciaCard inadimplentes={inadimp} onSelecionar={i => setFiltroCliente(i.cliente_nome)} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="todos">Todos períodos</option><option value="hoje">Vencendo hoje</option><option value="semana">Esta semana</option><option value="mes">Este mês</option><option value="custom">Personalizado</option>
        </select>
        {periodo === 'custom' && <>
          <input type="date" value={custom.de} onChange={e => setCustom(c => ({ ...c, de: e.target.value }))} style={{ ...inputStyle, width: 'auto', height: 36 }} />
          <input type="date" value={custom.ate} onChange={e => setCustom(c => ({ ...c, ate: e.target.value }))} style={{ ...inputStyle, width: 'auto', height: 36 }} />
        </>}
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="">Todos status</option><option value="PENDENTE">Pendentes</option><option value="PARCIAL">Parciais</option><option value="RECEBIDO">Recebidas</option><option value="atrasadas">Atrasadas</option><option value="RENEGOCIADO">Renegociadas</option><option value="CANCELADO">Canceladas</option>
        </select>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer', maxWidth: 200 }}>
          <option value="">Todos clientes</option>{clientesUnicos.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, width: 160, height: 36 }} />
        <button onClick={exportar} style={{ ...btnSmall, height: 36, fontSize: 12 }}>📥 CSV</button>
        <button onClick={() => { setEditando(null); setShowModal(true) }} title="Lançamento avulso fora do fluxo de pedidos/NF" style={{ ...btnPrimary, height: 36, padding: '0 14px', fontSize: 13, marginLeft: 'auto' }}>+ Conta manual</button>
      </div>

      {loading ? <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Carregando...</div> : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 12px', background: '#F8FAFC', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <div>Cliente / Vendedor</div><div>NF / Origem</div><div style={{ textAlign: 'right' }}>Valor / Saldo</div><div>Vencim.</div><div>Status</div><div>Ações</div>
            </div>
            {filtradas.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>Nenhuma conta encontrada</div>}
            {filtradas.map(c => {
              const eff = statusContaReceber(c); const s = STATUS_LABEL[eff]; const o = ORIGEM_LABEL[c.origem] || ORIGEM_LABEL.manual
              const atraso = diasAtrasoConta(c); const rec = valorRecebido(c); const saldo = saldoAberto(c)
              const inad = inadimp.find(x => x.cliente_nome === c.cliente_nome)
              const podeBaixar = eff !== 'RECEBIDO' && eff !== 'CANCELADO' && eff !== 'RENEGOCIADO'
              const ehManual = (c.origem || 'manual') === 'manual'
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 12px', borderTop: '1px solid #F1F5F9', fontSize: 12, alignItems: 'center', background: contaVencida(c) ? '#FEF2F2' : '#fff' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{inad && '🚨 '}{c.cliente_nome}</div>
                    {c.vendedor_nome && <div style={{ fontSize: 10, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👤 {c.vendedor_nome}</div>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{c.numero_nf || '—'}</div>
                    <span style={{ background: o.bg, color: o.color, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5 }}>{o.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#0A1628' }}>{fmtMoney(valorOriginal(c))}</div>
                    {rec > 0 && eff !== 'RECEBIDO' && <div style={{ fontSize: 10, color: '#1D4ED8' }}>saldo {fmtMoney(saldo)}</div>}
                  </div>
                  <div>
                    <div>{fmtData(c.data_vencimento)}</div>
                    {atraso > 0 && <div style={{ fontSize: 10, color: '#B91C1C', fontWeight: 700 }}>{atraso}d atraso</div>}
                    {c.vencimento_automatico && <div title="Vencimento calculado pelo prazo (sem data exata do boleto)" style={{ fontSize: 9, color: '#94A3B8' }}>~auto</div>}
                  </div>
                  <div><span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{s.label}</span></div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {podeBaixar && <button onClick={() => setBaixando(c)} title="Baixa (receber/cancelar/renegociar)" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, background: '#D1FAE5', color: '#065F46' }}>💰</button>}
                    {ehManual && <button onClick={() => { setEditando(c); setShowModal(true) }} title="Editar (só contas manuais)" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11 }}>✏️</button>}
                    {ehManual && <button onClick={() => excluir(c)} title="Excluir (só contas manuais)" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, color: '#B91C1C' }}>🗑️</button>}
                    {!ehManual && <span title="Conta gerada por pedido/NF: baixe pelo 💰. Campos críticos são travados." style={{ fontSize: 11, color: '#CBD5E1' }}>🔒</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showModal && <ContaManualModal editando={editando} onClose={() => setShowModal(false)} onSaved={load} />}
      {baixando && <BaixaModal conta={baixando} onClose={() => setBaixando(null)} onSaved={load} />}
    </div>
  )
}
