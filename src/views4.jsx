import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card, CIDADES, fetchClientes, createCliente, fmtCnpj, fetchVendedores } from './db.js'
import { ClienteDetalhe } from './views6.jsx'
import { ClienteBadges, calcClienteBadges, ALL_BADGE_KEYS, BADGE_DEFS } from './cliente-badges.jsx'

// ─── CLIENTES TAB (COMERCIAL / VENDEDOR) ───
export function ClientesTab({ pedidos = [], user }) {
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [busca, setBusca] = useState('')
  const [nome, setNome] = useState(''); const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState(''); const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState(''); const [cnpj, setCnpj] = useState('')
  const [vendedorNovo, setVendedorNovo] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeFilters, setActiveFilters] = useState([])
  const isVendedor = user?.setores?.includes('vendedor') || user?.setor === 'vendedor'
  const [somentesMeus, setSomenteMeus] = useState(isVendedor)
  const load = useCallback(async () => { setClientes(await fetchClientes()); setVendedores(await fetchVendedores()) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (user && isVendedor) setVendedorNovo(user.nome); else setVendedorNovo('Valois') }, [user, isVendedor])
  const badgesMap = useMemo(() => {
    const m = {}; clientes.forEach(c => { const cp = pedidos.filter(p => p.cliente?.toLowerCase() === c.nome?.toLowerCase()); m[c.id] = calcClienteBadges(cp) }); return m
  }, [clientes, pedidos])
  const valorMap = useMemo(() => {
    const m = {}; pedidos.filter(p => ['NF_EMITIDA','EM_ROTA','ENTREGUE'].includes(p.status)).forEach(p => { const k = p.cliente?.toLowerCase(); if (k) m[k] = (m[k] || 0) + (Number(p.valor_total) || 0) }); return m
  }, [pedidos])
  const toggleFilter = k => setActiveFilters(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    if (!endereco.trim()) { alert('Informe o endereço'); return }
    if (cnpj.replace(/\D/g, '').length !== 14) { alert('CNPJ deve ter 14 dígitos'); return }
    if (!vendedorNovo) { alert('Selecione o vendedor responsável'); return }
    setSaving(true)
    const { error } = await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, email: email || null, endereco: endereco.trim(), cnpj: cnpj.replace(/\D/g, ''), vendedor_nome: vendedorNovo })
    if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    setNome(''); setCidade(''); setTelefone(''); setEmail(''); setEndereco(''); setCnpj(''); setShowForm(false)
    await load(); setSaving(false)
  }

  if (selecionado) {
    const c = clientes.find(x => x.id === selecionado)
    if (!c) { setSelecionado(null); return null }
    return <ClienteDetalhe cliente={c} onBack={() => setSelecionado(null)} user={user} onSaved={load} />
  }

  const clientesFiltrados = clientes.filter(c => isVendedor && somentesMeus ? c.vendedor_nome === user.nome : true)
  const minhCarteira = isVendedor ? clientes.filter(c => c.vendedor_nome === user?.nome).length : 0

  return (
    <div>
      {isVendedor && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setSomenteMeus(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: somentesMeus ? '#0EA5E9' : '#E2E8F0', color: somentesMeus ? '#fff' : '#64748B', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>💼 Meus clientes</button>
          <button onClick={() => setSomenteMeus(false)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: !somentesMeus ? '#0A1628' : '#E2E8F0', color: !somentesMeus ? '#fff' : '#64748B', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Todos</button>
          {somentesMeus && <span style={{ fontSize: 12, color: '#0EA5E9', fontWeight: 600 }}>Minha carteira: {minhCarteira} clientes</span>}
        </div>
      )}
      {showForm ? (
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Novo Cliente</h3>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome *" style={inputStyle} />
            <select value={cidade} onChange={e => setCidade(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', color: cidade ? '#0A1628' : '#94A3B8' }}>
              <option value="">Cidade...</option>{CIDADES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input value={cnpj} onChange={e => setCnpj(fmtCnpj(e.target.value))} placeholder="CNPJ *" inputMode="numeric" style={{ ...inputStyle, marginBottom: 10 }} />
          <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo *" style={{ ...inputStyle, marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={inputStyle} />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
          </div>
          <select value={vendedorNovo} onChange={e => setVendedorNovo(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer', borderColor: vendedorNovo ? '#E2E8F0' : '#EF4444' }}>
            <option value="">Vendedor responsável *</option>
            <option value="Valois">Valois (empresa)</option>
            {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
          </select>
          <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : '+ Adicionar Cliente'}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ ...btnPrimary, width: '100%', marginBottom: 16 }}>+ Novo Cliente</button>
      )}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#94A3B8' }}>🔍</span>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente..." style={{ ...inputStyle, paddingLeft: 36 }} />
        {busca && <button onClick={() => setBusca('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 15, color: '#94A3B8', cursor: 'pointer' }}>✕</button>}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => setActiveFilters([])} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeFilters.length === 0 ? '#0A1628' : '#E2E8F0', color: activeFilters.length === 0 ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>Todos</button>
        {ALL_BADGE_KEYS.map(k => { const cnt = Object.values(badgesMap).filter(b => b.includes(k)).length; if (!cnt) return null; const active = activeFilters.includes(k); return <button key={k} onClick={() => toggleFilter(k)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: active ? '#0A1628' : '#E2E8F0', color: active ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>{BADGE_DEFS[k].icon} {cnt}</button> })}
      </div>
      {(() => {
        const display = clientesFiltrados.filter(c => (!busca || c.nome.toLowerCase().includes(busca.toLowerCase())) && (activeFilters.length === 0 || activeFilters.every(k => badgesMap[c.id]?.includes(k))))
        return (<>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>Clientes ({display.length})</div>
          {display.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>{clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente com este filtro'}</div>}
          {display.map(c => {
            const cPedidos = pedidos.filter(p => p.cliente?.toLowerCase() === c.nome?.toLowerCase())
            const valorTotal = valorMap[c.nome?.toLowerCase()] || 0
        return (
          <div key={c.id} onClick={() => setSelecionado(c.id)} style={{ ...card, cursor: 'pointer', border: '2px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: '#0A1628', fontSize: 15 }}>{c.nome}</span>
              <ClienteBadges pedidos={cPedidos} />
              <span style={{ background: '#F0FDF4', color: valorTotal > 0 ? '#059669' : '#94A3B8', fontWeight: 700, padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>{fmtMoney(valorTotal)}</span>
            </div>
            {c.cnpj && String(c.cnpj).trim() && <div style={{ fontSize: 12, color: '#64748B', marginBottom: 3 }}>🏢 <span style={{ fontWeight: 600 }}>{fmtCnpj(c.cnpj)}</span></div>}
            <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {c.cidade && <span>📍 {c.cidade}</span>}
              {c.telefone && <span>📞 {c.telefone}</span>}
              {c.email && <span>✉ {c.email}</span>}
            </div>
            {c.vendedor_nome && <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>💰 Vendedor: <strong style={{ color: c.vendedor_nome !== 'Valois' ? '#0EA5E9' : '#64748B' }}>{c.vendedor_nome}</strong></div>}
          </div>
        )
      })}
        </>)
      })()}
    </div>
  )
}

// ─── NOVO CLIENTE RÁPIDO MODAL ───
export function NovoClienteRapidoModal({ nomeInicial, onClose, onCriado, user }) {
  const [nome, setNome] = useState(nomeInicial || '')
  const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [vendedores, setVendedores] = useState([])
  const isVendedor = user?.setores?.includes('vendedor') || user?.setor === 'vendedor'
  const [vendedorNovo, setVendedorNovo] = useState(isVendedor ? (user?.nome || 'Valois') : 'Valois')
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetchVendedores().then(setVendedores) }, [])

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    if (!endereco.trim()) { alert('Informe o endereço'); return }
    if (cnpj.replace(/\D/g, '').length !== 14) { alert('CNPJ deve ter 14 dígitos'); return }
    setSaving(true)
    const { data, error } = await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, endereco: endereco.trim(), cnpj: cnpj.replace(/\D/g, ''), vendedor_nome: vendedorNovo || 'Valois' })
    if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    onCriado?.(data); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: '100%', maxWidth: 360, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Novo Cliente</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome *" style={{ ...inputStyle, marginBottom: 10 }} />
        <select value={cidade} onChange={e => setCidade(e.target.value)} style={{ ...inputStyle, marginBottom: 10, cursor: 'pointer', color: cidade ? '#0A1628' : '#94A3B8' }}>
          <option value="">Cidade...</option>{CIDADES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={cnpj} onChange={e => setCnpj(fmtCnpj(e.target.value))} placeholder="CNPJ *" inputMode="numeric" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo *" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={{ ...inputStyle, marginBottom: 10 }} />
        <select value={vendedorNovo} onChange={e => setVendedorNovo(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer' }}>
          <option value="Valois">Valois (empresa)</option>
          {vendedores.map(v => <option key={v.id} value={v.nome}>{v.nome}</option>)}
        </select>
        <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : '+ Cadastrar Cliente'}
        </button>
      </div>
    </div>
  )
}
