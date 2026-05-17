import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchContasReceber, createContaReceber, updateContaReceber, deleteContaReceber, statusEfetivo, isoHoje, clientesInadimplentes, toCsv, downloadCsv } from './financeiro-db.js'
import { InadimplenciaCard } from './financeiro-inadimplencia.jsx'

const STATUS_LABEL = {
  PENDENTE:  { label: 'Pendente',  bg: '#FEF3C7', color: '#B45309' },
  RECEBIDO:  { label: 'Recebido',  bg: '#D1FAE5', color: '#065F46' },
  ATRASADO:  { label: 'Atrasado',  bg: '#FEE2E2', color: '#B91C1C' },
  CANCELADO: { label: 'Cancelado', bg: '#F1F5F9', color: '#64748B' },
  PARCIAL:   { label: 'Parcial',   bg: '#DBEAFE', color: '#1D4ED8' },
}
const FORMAS = [{ v: 'a_vista', l: 'À vista' }, { v: 'boleto', l: 'Boleto' }, { v: 'cartao', l: 'Cartão' }, { v: 'pix', l: 'PIX' }]
function fmtData(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('pt-BR') }

function NovoModal({ editando, onClose, onSaved }) {
  const [cliente, setCliente] = useState(editando?.cliente_nome || '')
  const [numNf, setNumNf] = useState(editando?.numero_nf || '')
  const [valor, setValor] = useState(editando?.valor || '')
  const [dataEm, setDataEm] = useState(editando?.data_emissao || isoHoje())
  const [dataVenc, setDataVenc] = useState(editando?.data_vencimento || isoHoje())
  const [forma, setForma] = useState(editando?.forma_pagamento || 'boleto')
  const [obs, setObs] = useState(editando?.observacoes || '')
  const [saving, setSaving] = useState(false)
  const salvar = async () => {
    if (!cliente.trim() || !valor || !dataVenc) { alert('Preencha cliente, valor e vencimento'); return }
    setSaving(true)
    const payload = { cliente_nome: cliente.trim(), numero_nf: numNf.trim() || null, valor: Number(valor), data_emissao: dataEm, data_vencimento: dataVenc, forma_pagamento: forma, observacoes: obs.trim() || null }
    if (editando) await updateContaReceber(editando.id, payload)
    else await createContaReceber({ ...payload, status: 'PENDENTE' })
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 18 }}>{editando ? 'Editar conta a receber' : 'Nova conta a receber'}</h3>
        <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Cliente *" style={{ ...inputStyle, marginBottom: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={numNf} onChange={e => setNumNf(e.target.value)} placeholder="Nº NF" style={inputStyle} />
          <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor R$ *" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div><label style={{ fontSize: 11, color: '#64748B' }}>Emissão</label><input type="date" value={dataEm} onChange={e => setDataEm(e.target.value)} style={inputStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#64748B' }}>Vencimento</label><input type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} style={inputStyle} /></div>
        </div>
        <select value={forma} onChange={e => setForma(e.target.value)} style={{ ...inputStyle, marginBottom: 10, cursor: 'pointer' }}>
          {FORMAS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
        <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Observações" style={{ ...inputStyle, height: 'auto', padding: 10, marginBottom: 14, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

function ReceberModal({ conta, onClose, onSaved }) {
  const [data, setData] = useState(isoHoje())
  const [saving, setSaving] = useState(false)
  if (!conta) return null
  const confirmar = async () => {
    setSaving(true)
    await updateContaReceber(conta.id, { status: 'RECEBIDO', data_recebimento: data })
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17 }}>Marcar como recebido</h3>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>{conta.cliente_nome} · {fmtMoney(conta.valor)}</div>
        <label style={{ fontSize: 12, color: '#64748B' }}>Data do recebimento</label>
        <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
          <button onClick={confirmar} disabled={saving} style={{ ...btnPrimary, flex: 2, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Confirmar'}</button>
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
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('todos')
  const [custom, setCustom] = useState({ de: '', ate: '' })
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [recebendo, setRecebendo] = useState(null)

  const load = useCallback(async () => { setItems(await fetchContasReceber()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  const inadimp = useMemo(() => clientesInadimplentes(items), [items])

  const filtradas = useMemo(() => items.filter(c => {
    if (filtroStatus === 'atrasadas') { if (statusEfetivo(c) !== 'ATRASADO') return false }
    else if (filtroStatus) { if (statusEfetivo(c) !== filtroStatus) return false }
    if (filtroCliente && c.cliente_nome !== filtroCliente) return false
    if (busca && !c.cliente_nome.toLowerCase().includes(busca.toLowerCase()) && !(c.numero_nf || '').includes(busca)) return false
    if (periodo !== 'todos' && !aplicaPeriodo(periodo, c, custom)) return false
    return true
  }), [items, filtroStatus, filtroCliente, busca, periodo, custom])

  const cards = useMemo(() => {
    const hoje = isoHoje(); const ini = new Date(); ini.setDate(1); const iniIso = ini.toISOString().slice(0, 10)
    const fimSem = new Date(); fimSem.setDate(fimSem.getDate() + 7); const fimSemIso = fimSem.toISOString().slice(0, 10)
    const sum = a => a.reduce((s, x) => s + Number(x.valor || 0), 0)
    const aReceber = items.filter(c => ['PENDENTE', 'ATRASADO'].includes(statusEfetivo(c)))
    const atrasadas = items.filter(c => statusEfetivo(c) === 'ATRASADO')
    const semana = items.filter(c => statusEfetivo(c) === 'PENDENTE' && c.data_vencimento >= hoje && c.data_vencimento <= fimSemIso)
    const recebMes = items.filter(c => c.status === 'RECEBIDO' && c.data_recebimento >= iniIso)
    return { aReceber: sum(aReceber), atrasadas: { v: sum(atrasadas), n: atrasadas.length }, semana: sum(semana), recebMes: sum(recebMes) }
  }, [items])

  const excluir = async (c) => { if (confirm(`Excluir cobrança de ${c.cliente_nome}?`)) { await deleteContaReceber(c.id); load() } }
  const exportar = () => {
    const headers = [
      { label: 'Cliente', get: c => c.cliente_nome }, { label: 'NF', get: c => c.numero_nf || '' },
      { label: 'Valor', get: c => Number(c.valor).toFixed(2) }, { label: 'Emissao', key: 'data_emissao' },
      { label: 'Vencimento', key: 'data_vencimento' }, { label: 'Recebido em', get: c => c.data_recebimento || '' },
      { label: 'Forma', key: 'forma_pagamento' }, { label: 'Status', get: c => statusEfetivo(c) }
    ]
    downloadCsv(toCsv(filtradas, headers), `contas-receber-${isoHoje()}.csv`)
  }
  const clientesUnicos = useMemo(() => [...new Set(items.map(c => c.cliente_nome))].sort(), [items])

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #0EA5E9', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>📊 Total a receber</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.aReceber)}</div></div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #B91C1C', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>🔴 Atrasadas</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.atrasadas.v)}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>{cards.atrasadas.n} conta{cards.atrasadas.n !== 1 ? 's' : ''}</div></div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #F59E0B', margin: 0 }}><div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>📅 Esta semana</div><div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.semana)}</div></div>
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
          <option value="">Todos status</option><option value="PENDENTE">Pendentes</option><option value="RECEBIDO">Recebidas</option><option value="atrasadas">Atrasadas</option><option value="CANCELADO">Canceladas</option>
        </select>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer', maxWidth: 200 }}>
          <option value="">Todos clientes</option>{clientesUnicos.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, width: 180, height: 36 }} />
        <button onClick={exportar} style={{ ...btnSmall, height: 36, fontSize: 12 }}>📥 CSV</button>
        <button onClick={() => { setEditando(null); setShowModal(true) }} style={{ ...btnPrimary, height: 36, padding: '0 14px', fontSize: 13, marginLeft: 'auto' }}>+ Nova conta</button>
      </div>

      {loading ? <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Carregando...</div> : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 80px 100px 120px', gap: 8, padding: '10px 12px', background: '#F8FAFC', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div>Cliente</div><div>NF</div><div style={{ textAlign: 'right' }}>Valor</div><div>Vencim.</div><div>Forma</div><div>Status</div><div>Ações</div>
          </div>
          {filtradas.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>Nenhuma conta encontrada</div>}
          {filtradas.map(c => {
            const eff = statusEfetivo(c); const s = STATUS_LABEL[eff]
            const inadCliente = inadimp.find(x => x.cliente_nome === c.cliente_nome)
            return (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 80px 100px 120px', gap: 8, padding: '10px 12px', borderTop: '1px solid #F1F5F9', fontSize: 12, alignItems: 'center', background: eff === 'ATRASADO' ? '#FEF2F2' : '#fff' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inadCliente && '🚨 '}{c.cliente_nome}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{c.numero_nf || '—'}</div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: '#0A1628' }}>{fmtMoney(c.valor)}</div>
                <div>{fmtData(c.data_vencimento)}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{c.forma_pagamento}</div>
                <div><span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{s.label}</span></div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {c.status !== 'RECEBIDO' && c.status !== 'CANCELADO' && <button onClick={() => setRecebendo(c)} title="Marcar recebido" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, background: '#D1FAE5', color: '#065F46' }}>✅</button>}
                  <button onClick={() => { setEditando(c); setShowModal(true) }} title="Editar" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11 }}>✏️</button>
                  <button onClick={() => excluir(c)} title="Excluir" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, color: '#B91C1C' }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <NovoModal editando={editando} onClose={() => setShowModal(false)} onSaved={load} />}
      {recebendo && <ReceberModal conta={recebendo} onClose={() => setRecebendo(null)} onSaved={load} />}
    </div>
  )
}
