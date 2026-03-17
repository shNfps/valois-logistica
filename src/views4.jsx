import { useState, useEffect, useCallback } from 'react'
import { inputStyle, btnPrimary, btnSmall, card, CIDADES, fetchClientes, createCliente, fmtCnpj } from './db.js'
import { ClienteDetalhe } from './views6.jsx'

// ─── CLIENTES TAB (COMERCIAL / VENDEDOR) ───
export function ClientesTab() {
  const [clientes, setClientes] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState(''); const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState(''); const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState(''); const [cnpj, setCnpj] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => setClientes(await fetchClientes()), [])
  useEffect(() => { load() }, [load])

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    if (!endereco.trim()) { alert('Informe o endereço'); return }
    if (cnpj.replace(/\D/g, '').length !== 14) { alert('CNPJ deve ter 14 dígitos'); return }
    setSaving(true)
    const { error } = await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, email: email || null, endereco: endereco.trim(), cnpj: cnpj.replace(/\D/g, '') })
    if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    setNome(''); setCidade(''); setTelefone(''); setEmail(''); setEndereco(''); setCnpj(''); setShowForm(false)
    await load(); setSaving(false)
  }

  if (selecionado) {
    const c = clientes.find(x => x.id === selecionado)
    if (!c) { setSelecionado(null); return null }
    return <ClienteDetalhe cliente={c} onBack={() => setSelecionado(null)} />
  }

  return (
    <div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={inputStyle} />
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
          </div>
          <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : '+ Adicionar Cliente'}
          </button>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ ...btnPrimary, width: '100%', marginBottom: 16 }}>+ Novo Cliente</button>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>
        Clientes ({clientes.length})
      </div>
      {clientes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhum cliente cadastrado</div>}
      {clientes.map(c => (
        <div key={c.id} onClick={() => setSelecionado(c.id)} style={{ ...card, cursor: 'pointer', border: '2px solid transparent' }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
          <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 15, marginBottom: 4 }}>{c.nome}</div>
          <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {c.cidade && <span>📍 {c.cidade}</span>}
            {c.telefone && <span>📞 {c.telefone}</span>}
            {c.email && <span>✉ {c.email}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── NOVO CLIENTE RÁPIDO MODAL ───
export function NovoClienteRapidoModal({ nomeInicial, onClose, onCriado }) {
  const [nome, setNome] = useState(nomeInicial || '')
  const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [saving, setSaving] = useState(false)

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    if (!endereco.trim()) { alert('Informe o endereço'); return }
    if (cnpj.replace(/\D/g, '').length !== 14) { alert('CNPJ deve ter 14 dígitos'); return }
    setSaving(true)
    const { data, error } = await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, endereco: endereco.trim(), cnpj: cnpj.replace(/\D/g, '') })
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
        <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={{ ...inputStyle, marginBottom: 14 }} />
        <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : '+ Cadastrar Cliente'}
        </button>
      </div>
    </div>
  )
}
