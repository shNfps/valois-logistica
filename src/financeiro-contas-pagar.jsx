import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, fmtCnpj, inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchDespesas, fetchCategoriasDespesa, deleteDespesa, statusEfetivo, diasAte, isoHoje, toCsv, downloadCsv } from './financeiro-db.js'
import { DespesaModal, PagarModal } from './financeiro-despesa-modal.jsx'

const STATUS_LABEL = {
  PENDENTE:  { label: 'Pendente',  bg: '#FEF3C7', color: '#B45309' },
  PAGO:      { label: 'Pago',      bg: '#D1FAE5', color: '#065F46' },
  ATRASADO:  { label: 'Atrasado',  bg: '#FEE2E2', color: '#B91C1C' },
  CANCELADO: { label: 'Cancelado', bg: '#F1F5F9', color: '#64748B' },
}

function fmtData(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('pt-BR') }

function periodoRange(periodo) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  if (periodo === 'semana') {
    const fim = new Date(hoje); fim.setDate(hoje.getDate() + 7)
    return { de: hoje.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) }
  }
  if (periodo === 'mes') {
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) }
  }
  if (periodo === 'prox_mes') {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0)
    return { de: ini.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) }
  }
  return {}
}

export function ContasPagarTab({ user }) {
  const [despesas, setDespesas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [pagando, setPagando] = useState(null)

  const load = useCallback(async () => {
    const [d, c] = await Promise.all([fetchDespesas(), fetchCategoriasDespesa()])
    setDespesas(d); setCategorias(c); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const fornecedoresHist = useMemo(() => {
    const map = {}
    despesas.forEach(d => { if (d.fornecedor && !map[d.fornecedor]) map[d.fornecedor] = { nome: d.fornecedor, cnpj: d.cnpj_fornecedor } })
    return Object.values(map)
  }, [despesas])

  const filtradas = useMemo(() => {
    let lista = despesas
    if (periodo === 'atrasadas') lista = lista.filter(d => statusEfetivo(d) === 'ATRASADO')
    else {
      const r = periodoRange(periodo)
      if (r.de) lista = lista.filter(d => d.data_vencimento >= r.de && d.data_vencimento <= r.ate)
    }
    if (filtroCat) lista = lista.filter(d => d.categoria_id === filtroCat)
    if (filtroStatus) lista = lista.filter(d => statusEfetivo(d) === filtroStatus)
    return lista
  }, [despesas, periodo, filtroCat, filtroStatus])

  const cards = useMemo(() => {
    const hoje = isoHoje()
    const vencHoje = despesas.filter(d => d.data_vencimento === hoje && d.status === 'PENDENTE')
    const prox7 = despesas.filter(d => { const dias = diasAte(d.data_vencimento); return dias > 0 && dias <= 7 && d.status === 'PENDENTE' })
    const atrasadas = despesas.filter(d => statusEfetivo(d) === 'ATRASADO')
    const ini = new Date(); ini.setDate(1); const iniIso = ini.toISOString().slice(0, 10)
    const pagasMes = despesas.filter(d => d.status === 'PAGO' && d.data_pagamento && d.data_pagamento >= iniIso)
    const sum = arr => arr.reduce((s, d) => s + Number(d.valor || 0), 0)
    return {
      hoje: { v: sum(vencHoje), n: vencHoje.length },
      prox7: { v: sum(prox7), n: prox7.length },
      atrasadas: { v: sum(atrasadas), n: atrasadas.length },
      pagasMes: { v: sum(pagasMes), n: pagasMes.length },
    }
  }, [despesas])

  const corLinha = (d) => {
    const eff = statusEfetivo(d); if (eff === 'ATRASADO') return '#FEF2F2'
    if (eff === 'PENDENTE' && diasAte(d.data_vencimento) <= 3) return '#FFFBEB'
    return '#fff'
  }
  const excluir = async (d) => { if (confirm(`Excluir "${d.descricao}"?`)) { await deleteDespesa(d.id); load() } }
  const cat = (id) => categorias.find(c => c.id === id)
  const exportar = () => {
    const headers = [
      { label: 'Descricao', key: 'descricao' }, { label: 'Categoria', get: d => cat(d.categoria_id)?.nome || '' },
      { label: 'Fornecedor', key: 'fornecedor' }, { label: 'CNPJ', key: 'cnpj_fornecedor' },
      { label: 'Valor', get: d => Number(d.valor).toFixed(2) }, { label: 'Vencimento', key: 'data_vencimento' },
      { label: 'Pago em', get: d => d.data_pagamento || '' }, { label: 'Forma', key: 'forma_pagamento' },
      { label: 'Status', get: d => statusEfetivo(d) }
    ]
    downloadCsv(toCsv(filtradas, headers), `contas-pagar-${isoHoje()}.csv`)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mês</option>
          <option value="prox_mes">Próximo mês</option>
          <option value="atrasadas">Atrasadas</option>
        </select>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="">Todas categorias</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ ...inputStyle, width: 'auto', height: 36, cursor: 'pointer' }}>
          <option value="">Todos status</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="PAGO">Pagas</option>
          <option value="ATRASADO">Atrasadas</option>
        </select>
        <button onClick={exportar} style={{ ...btnSmall, height: 36, fontSize: 12, marginLeft: 'auto' }}>📥 CSV</button>
        <button onClick={() => { setEditando(null); setShowModal(true) }} style={{ ...btnPrimary, height: 36, padding: '0 14px', fontSize: 13 }}>+ Nova despesa</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #DC2626', margin: 0 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>🔴 Vencendo hoje</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.hoje.v)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{cards.hoje.n} boleto{cards.hoje.n !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #F59E0B', margin: 0 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>🟡 Próximos 7 dias</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.prox7.v)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{cards.prox7.n} boleto{cards.prox7.n !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #B91C1C', margin: 0 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>🔴 Atrasadas</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.atrasadas.v)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{cards.atrasadas.n} boleto{cards.atrasadas.n !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ ...card, padding: 14, borderLeft: '4px solid #059669', margin: 0 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>✅ Pagas no mês</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0A1628' }}>{fmtMoney(cards.pagasMes.v)}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>{cards.pagasMes.n} pagas</div>
        </div>
      </div>

      {loading ? <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Carregando...</div> : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 110px 110px 100px 120px', gap: 8, padding: '10px 12px', background: '#F8FAFC', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div>Vencim.</div><div>Descrição</div><div>Fornecedor</div><div>Categoria</div><div style={{ textAlign: 'right' }}>Valor</div><div>Status</div><div>Ações</div>
          </div>
          {filtradas.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#94A3B8' }}>Nenhuma despesa</div>}
          {filtradas.map(d => {
            const eff = statusEfetivo(d); const s = STATUS_LABEL[eff]; const c = cat(d.categoria_id)
            return (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 110px 110px 100px 120px', gap: 8, padding: '10px 12px', background: corLinha(d), borderTop: '1px solid #F1F5F9', fontSize: 12, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, color: '#0A1628' }}>{fmtData(d.data_vencimento)}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.recorrente && <span title="Recorrente" style={{ marginRight: 4 }}>🔁</span>}
                  {d.descricao}
                </div>
                <div style={{ color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.fornecedor || '—'}
                  {d.cnpj_fornecedor && <div style={{ fontSize: 10, color: '#94A3B8' }}>{fmtCnpj(d.cnpj_fornecedor)}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{c ? `${c.icone} ${c.nome}` : '—'}</div>
                <div style={{ textAlign: 'right', fontWeight: 700, color: '#0A1628' }}>{fmtMoney(d.valor)}</div>
                <div><span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 }}>{s.label}</span></div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {d.status !== 'PAGO' && d.status !== 'CANCELADO' && <button onClick={() => setPagando(d)} title="Marcar como pago" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, background: '#D1FAE5', color: '#065F46' }}>✅</button>}
                  <button onClick={() => { setEditando(d); setShowModal(true) }} title="Editar" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11 }}>✏️</button>
                  {d.anexo_url && <a href={d.anexo_url} target="_blank" rel="noreferrer" title="Anexo" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, textDecoration: 'none' }}>📎</a>}
                  <button onClick={() => excluir(d)} title="Excluir" style={{ ...btnSmall, height: 26, padding: '0 6px', fontSize: 11, color: '#B91C1C' }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <DespesaModal user={user} categorias={categorias} fornecedoresHist={fornecedoresHist} editando={editando} onClose={() => setShowModal(false)} onSaved={load} />}
      {pagando && <PagarModal despesa={pagando} onClose={() => setPagando(null)} onSaved={load} />}
    </div>
  )
}
