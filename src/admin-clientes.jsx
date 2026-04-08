import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, fmtCnpj, inputStyle, btnPrimary, btnSmall, card, CIDADES, fetchClientes, createCliente, deleteCliente, updateCliente, updateClientesLote, fetchVendedores } from './db.js'
import { ClienteDetalhe } from './views6.jsx'
import { ClienteBadges, calcClienteBadges, ALL_BADGE_KEYS, BADGE_DEFS } from './cliente-badges.jsx'

const fmtDoc = v => { const n = v.replace(/\D/g, '').slice(0, 14); if (n.length <= 3) return n; if (n.length <= 6) return n.slice(0, 3) + '.' + n.slice(3); if (n.length <= 9) return n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6); if (n.length <= 11) return n.slice(0, 3) + '.' + n.slice(3, 6) + '.' + n.slice(6, 9) + '-' + n.slice(9); if (n.length <= 12) return n.slice(0, 2) + '.' + n.slice(2, 5) + '.' + n.slice(5, 8) + '/' + n.slice(8); return n.slice(0, 2) + '.' + n.slice(2, 5) + '.' + n.slice(5, 8) + '/' + n.slice(8, 12) + '-' + n.slice(12) }

// ─── ADMIN CLIENTES TAB ───
export function AdminClientesTab({ pedidos = [], user }) {
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [nome, setNome] = useState(''); const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState(''); const [email, setEmail] = useState('')
  const [documento, setDocumento] = useState(''); const [endereco, setEndereco] = useState(''); const [cnpj, setCnpj] = useState('')
  const [vendedorNovo, setVendedorNovo] = useState('Valois')
  const [saving, setSaving] = useState(false)
  const [filtroVendedor, setFiltroVendedor] = useState('todos')
  const [modoLote, setModoLote] = useState(false)
  const [selecionados, setSelecionados] = useState(new Set())
  const [vendedorLote, setVendedorLote] = useState('')
  const [toast, setToast] = useState(null)
  const [editandoVendedor, setEditandoVendedor] = useState(null)

  const load = useCallback(async () => { setClientes(await fetchClientes()); setVendedores(await fetchVendedores()) }, [])
  useEffect(() => { load() }, [load])

  const todoVendedores = useMemo(() => ['Valois', ...vendedores.map(v => v.nome)], [vendedores])

  const { badgesMap, valorMap } = useMemo(() => {
    const bm = {}, vm = {}
    clientes.forEach(c => { const cp = pedidos.filter(p => p.cliente?.toLowerCase() === c.nome?.toLowerCase()); bm[c.id] = calcClienteBadges(cp) })
    pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status)).forEach(p => { const k = p.cliente?.toLowerCase(); if (k) vm[k] = (vm[k] || 0) + (Number(p.valor_total) || 0) })
    return { badgesMap: bm, valorMap: vm }
  }, [clientes, pedidos])

  const [activeFilters, setActiveFilters] = useState([])
  const toggleFilter = k => setActiveFilters(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  const displayClientes = useMemo(() => clientes.filter(c => {
    if (filtroVendedor === 'valois') return !c.vendedor_nome || c.vendedor_nome === 'Valois'
    if (filtroVendedor !== 'todos') return c.vendedor_nome === filtroVendedor
    return true
  }).filter(c => activeFilters.length === 0 || activeFilters.every(k => badgesMap[c.id]?.includes(k))), [clientes, filtroVendedor, activeFilters, badgesMap])

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    if (!endereco.trim()) { alert('Informe o endereço'); return }
    if (cnpj.replace(/\D/g, '').length !== 14) { alert('CNPJ deve ter 14 dígitos'); return }
    if (!vendedorNovo) { alert('Selecione o vendedor responsável'); return }
    setSaving(true)
    const docLimpo = documento.replace(/\D/g, '') || null
    const { error } = await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, email: email || null, documento: docLimpo, endereco: endereco.trim(), cnpj: cnpj.replace(/\D/g, ''), vendedor_nome: vendedorNovo })
    if (error) { alert(error.code === '23505' ? 'CNPJ já cadastrado' : 'Erro: ' + error.message); setSaving(false); return }
    setNome(''); setCidade(''); setTelefone(''); setEmail(''); setDocumento(''); setEndereco(''); setCnpj(''); setVendedorNovo('Valois')
    await load(); setSaving(false)
  }

  const alterarVendedor = async (clienteId, novoVendedor, clienteNome) => {
    await updateCliente(clienteId, { vendedor_nome: novoVendedor })
    setEditandoVendedor(null); await load()
    showToast(`✅ ${clienteNome} transferido para ${novoVendedor}`)
  }

  const aplicarLote = async () => {
    if (!vendedorLote) { alert('Selecione o vendedor'); return }
    if (!confirm(`Transferir ${selecionados.size} cliente(s) para ${vendedorLote}?`)) return
    await updateClientesLote([...selecionados], { vendedor_nome: vendedorLote })
    setSelecionados(new Set()); setModoLote(false); setVendedorLote(''); await load()
    showToast(`✅ ${selecionados.size} clientes transferidos para ${vendedorLote}`)
  }

  const toggleLoteItem = id => setSelecionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  if (selecionado) { const c = clientes.find(x => x.id === selecionado); if (!c) { setSelecionado(null); return null }; return <ClienteDetalhe cliente={c} onBack={() => setSelecionado(null)} user={user} onSaved={load} /> }

  return (
    <div>
      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#0A1628', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>{toast}</div>}
      <div style={{ ...card, padding: 20, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Novo Cliente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome *" style={inputStyle} />
          <select value={cidade} onChange={e => setCidade(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', color: cidade ? '#0A1628' : '#94A3B8' }}><option value="">Cidade...</option>{CIDADES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <input value={cnpj} onChange={e => setCnpj(fmtCnpj(e.target.value))} placeholder="CNPJ *" inputMode="numeric" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço *" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={documento} onChange={e => setDocumento(fmtDoc(e.target.value))} placeholder="CPF (opcional)" inputMode="numeric" style={{ ...inputStyle, marginBottom: 10 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={inputStyle} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
        </div>
        <select value={vendedorNovo} onChange={e => setVendedorNovo(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer', borderColor: vendedorNovo ? '#E2E8F0' : '#EF4444' }}>
          <option value="">Vendedor responsável *</option>
          <option value="Valois">Valois (empresa)</option>
          {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
        </select>
        <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '+ Adicionar Cliente'}</button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {[['todos', 'Todos'], ['valois', '🏢 Valois'], ...vendedores.map(v => [v.nome, '💰 ' + v.nome])].map(([k, l]) => (
          <button key={k} onClick={() => setFiltroVendedor(k)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: filtroVendedor === k ? '#0A1628' : '#E2E8F0', color: filtroVendedor === k ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => setActiveFilters([])} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeFilters.length === 0 ? '#0A1628' : '#E2E8F0', color: activeFilters.length === 0 ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>Todos</button>
        {ALL_BADGE_KEYS.map(k => { const cnt = Object.values(badgesMap).filter(b => b.includes(k)).length; if (!cnt) return null; const active = activeFilters.includes(k); return <button key={k} onClick={() => toggleFilter(k)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: active ? '#0A1628' : '#E2E8F0', color: active ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>{BADGE_DEFS[k].icon} {cnt}</button> })}
      </div>

      {/* Barra lote */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2 }}>Clientes ({displayClientes.length})</div>
        <button onClick={() => { setModoLote(v => !v); setSelecionados(new Set()) }} style={{ ...btnSmall, fontSize: 11, padding: '4px 10px', color: modoLote ? '#EF4444' : '#3B82F6' }}>{modoLote ? '✕ Cancelar lote' : '📋 Atribuir em lote'}</button>
      </div>
      {modoLote && selecionados.size > 0 && (
        <div style={{ ...card, padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>{selecionados.size} selecionado(s)</span>
          <select value={vendedorLote} onChange={e => setVendedorLote(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 140, padding: '6px 10px' }}>
            <option value="">Selecionar vendedor...</option>
            <option value="Valois">Valois (empresa)</option>
            {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
          </select>
          <button onClick={aplicarLote} disabled={!vendedorLote} style={{ ...btnPrimary, padding: '8px 14px', fontSize: 12, opacity: vendedorLote ? 1 : 0.5 }}>Aplicar</button>
        </div>
      )}

      {displayClientes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>{activeFilters.length > 0 || filtroVendedor !== 'todos' ? 'Nenhum cliente com este filtro' : 'Nenhum cliente cadastrado'}</div>}
      {displayClientes.map(c => {
        const nPedidos = pedidos.filter(p => p.cliente_id === c.id).length
        const cPedidos = pedidos.filter(p => p.cliente?.toLowerCase() === c.nome?.toLowerCase())
        const valorTotal = valorMap[c.nome?.toLowerCase()] || 0
        const editandoEste = editandoVendedor === c.id
        return (
          <div key={c.id} style={{ ...card, border: '2px solid transparent', cursor: modoLote ? 'pointer' : 'default' }}
            onClick={() => modoLote ? toggleLoteItem(c.id) : null}
            onMouseEnter={e => { if (!modoLote) e.currentTarget.style.borderColor = '#CBD5E1' }}
            onMouseLeave={e => { if (!modoLote) e.currentTarget.style.borderColor = 'transparent' }}
            style={{ ...card, border: modoLote && selecionados.has(c.id) ? '2px solid #3B82F6' : '2px solid transparent', cursor: modoLote ? 'pointer' : 'default', background: modoLote && selecionados.has(c.id) ? '#EFF6FF' : '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {modoLote && <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => toggleLoteItem(c.id)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, marginRight: 8, marginTop: 2, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }} onClick={() => !modoLote && setSelecionado(c.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', cursor: modoLote ? 'default' : 'pointer' }}>
                  <span style={{ fontWeight: 700, color: '#0A1628', fontSize: 15 }}>{c.nome}</span>
                  {nPedidos > 0 && <span style={{ background: '#DBEAFE', color: '#1D4ED8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{nPedidos} pedido{nPedidos > 1 ? 's' : ''}</span>}
                  <ClienteBadges pedidos={cPedidos} />
                  <span style={{ background: '#F0FDF4', color: valorTotal > 0 ? '#059669' : '#94A3B8', fontWeight: 700, padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>{fmtMoney(valorTotal)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                  {c.documento && <span style={{ fontWeight: 600 }}>{fmtDoc(c.documento)} &nbsp;</span>}{c.cidade && <span>📍 {c.cidade} &nbsp;</span>}{c.telefone && <span>📞 {c.telefone}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                  💰 Vendedor: <strong style={{ color: c.vendedor_nome && c.vendedor_nome !== 'Valois' ? '#0EA5E9' : '#64748B' }}>{c.vendedor_nome || 'Valois'}</strong>
                </div>
              </div>
              {!modoLote && <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={e => { e.stopPropagation(); setEditandoVendedor(editandoEste ? null : c.id) }} style={{ ...btnSmall, fontSize: 11, padding: '3px 8px', color: '#3B82F6' }}>✏️</button>
                <button onClick={async e => { e.stopPropagation(); if (!confirm(`Deletar ${c.nome}?`)) return; await deleteCliente(c.id); load() }} style={{ ...btnSmall, fontSize: 11, padding: '3px 8px', color: '#EF4444' }}>✗</button>
              </div>}
            </div>
            {editandoEste && (
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                <select defaultValue={c.vendedor_nome || 'Valois'} onChange={e => alterarVendedor(c.id, e.target.value, c.nome)} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}>
                  <option value="Valois">Valois (empresa)</option>
                  {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                </select>
                <button onClick={() => setEditandoVendedor(null)} style={{ ...btnSmall, fontSize: 11, padding: '4px 8px' }}>✕</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
