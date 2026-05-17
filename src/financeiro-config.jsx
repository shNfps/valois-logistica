import { useState, useEffect, useCallback } from 'react'
import { fmtCnpj, inputStyle, btnPrimary, btnSmall, card } from './db.js'
import { fetchCategoriasDespesa, createCategoriaDespesa, deleteCategoriaDespesa, fetchFornecedores, createFornecedor, updateFornecedor, deleteFornecedor, fetchConfigFinanceiro, updateConfigFinanceiro } from './financeiro-db.js'

const TIPOS = ['fornecedor', 'salario', 'infra', 'veiculo', 'imposto', 'operacional', 'obra', 'reembolso', 'outros']

function CategoriasSection() {
  const [items, setItems] = useState([])
  const [nome, setNome] = useState(''); const [tipo, setTipo] = useState('outros')
  const [icone, setIcone] = useState('💵'); const [cor, setCor] = useState('#64748B')

  const load = useCallback(async () => setItems(await fetchCategoriasDespesa()), [])
  useEffect(() => { load() }, [load])
  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    await createCategoriaDespesa({ nome: nome.trim(), tipo, icone, cor })
    setNome(''); setIcone('💵'); setCor('#64748B'); setTipo('outros'); load()
  }
  const excluir = async (c) => { if (confirm(`Desativar "${c.nome}"?`)) { await deleteCategoriaDespesa(c.id); load() } }

  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0A1628' }}>📂 Categorias de despesa</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 70px 80px 100px', gap: 8, marginBottom: 12 }}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>{TIPOS.map(t => <option key={t} value={t}>{t}</option>)}</select>
        <input value={icone} onChange={e => setIcone(e.target.value)} placeholder="🏷️" style={{ ...inputStyle, textAlign: 'center' }} maxLength={3} />
        <input type="color" value={cor} onChange={e => setCor(e.target.value)} style={{ ...inputStyle, padding: 4, cursor: 'pointer' }} />
        <button onClick={criar} style={{ ...btnPrimary, height: 42 }}>+ Criar</button>
      </div>
      <div style={{ background: '#F8FAFC', borderRadius: 8, overflow: 'hidden' }}>
        {items.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: c.cor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{c.icone}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#0A1628', fontSize: 13 }}>{c.nome}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{c.tipo}</div>
            </div>
            <button onClick={() => excluir(c)} style={{ ...btnSmall, color: '#B91C1C', fontSize: 11 }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function FornecedoresSection() {
  const [items, setItems] = useState([])
  const [nome, setNome] = useState(''); const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState(''); const [tel, setTel] = useState('')
  const [editId, setEditId] = useState(null)

  const load = useCallback(async () => setItems(await fetchFornecedores()), [])
  useEffect(() => { load() }, [load])
  const reset = () => { setNome(''); setCnpj(''); setEmail(''); setTel(''); setEditId(null) }
  const salvar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    const payload = { nome: nome.trim(), cnpj: cnpj.replace(/\D/g, '') || null, email: email.trim() || null, telefone: tel.trim() || null }
    if (editId) await updateFornecedor(editId, payload)
    else await createFornecedor(payload)
    reset(); load()
  }
  const editar = (f) => { setEditId(f.id); setNome(f.nome); setCnpj(f.cnpj || ''); setEmail(f.email || ''); setTel(f.telefone || '') }
  const excluir = async (f) => { if (confirm(`Desativar "${f.nome}"?`)) { await deleteFornecedor(f.id); load() } }

  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0A1628' }}>🏢 Fornecedores recorrentes</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr 130px 110px', gap: 8, marginBottom: 12 }}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" style={inputStyle} />
        <input value={fmtCnpj(cnpj)} onChange={e => setCnpj(e.target.value.replace(/\D/g, '').slice(0, 14))} placeholder="CNPJ" style={inputStyle} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
        <input value={tel} onChange={e => setTel(e.target.value)} placeholder="Telefone" style={inputStyle} />
        <button onClick={salvar} style={{ ...btnPrimary, height: 42 }}>{editId ? 'Salvar' : '+ Criar'}</button>
      </div>
      {editId && <button onClick={reset} style={{ ...btnSmall, fontSize: 11, marginBottom: 12 }}>Cancelar edição</button>}
      <div style={{ background: '#F8FAFC', borderRadius: 8, overflow: 'hidden' }}>
        {items.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Nenhum fornecedor</div>}
        {items.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderBottom: '1px solid #E2E8F0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#0A1628', fontSize: 13 }}>{f.nome}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{f.cnpj ? fmtCnpj(f.cnpj) : ''} {f.email && `· ${f.email}`} {f.telefone && `· ${f.telefone}`}</div>
            </div>
            <button onClick={() => editar(f)} style={{ ...btnSmall, fontSize: 11 }}>✏️</button>
            <button onClick={() => excluir(f)} style={{ ...btnSmall, color: '#B91C1C', fontSize: 11 }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertasSection() {
  const [cfg, setCfg] = useState(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => { fetchConfigFinanceiro().then(setCfg) }, [])
  if (!cfg) return null
  const salvar = async () => { setSaving(true); await updateConfigFinanceiro(cfg); setSaving(false); alert('Configurações salvas') }
  return (
    <div style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#0A1628' }}>🔔 Alertas automáticos</h4>
      <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 4 }}>Avisar X dias antes do vencimento</label>
      <input type="number" min="1" max="30" value={cfg.dias_alerta_vencimento} onChange={e => setCfg(c => ({ ...c, dias_alerta_vencimento: Number(e.target.value) }))} style={{ ...inputStyle, width: 120, marginBottom: 10 }} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={cfg.alertar_inadimplencia} onChange={e => setCfg(c => ({ ...c, alertar_inadimplencia: e.target.checked }))} />
        <span style={{ fontSize: 13 }}>Notificar comercial sobre clientes inadimplentes</span>
      </label>
      <button onClick={salvar} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar'}</button>
    </div>
  )
}

export function ConfiguracoesTab() {
  return (
    <div>
      <AlertasSection />
      <CategoriasSection />
      <FornecedoresSection />
    </div>
  )
}
