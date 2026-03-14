import { useState, useEffect, useCallback } from 'react'
import { extractItemsFromPdf } from './ai.js'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card, CIDADES, fetchClientes, createCliente, deleteCliente, createProduto, savePedidoItens } from './db.js'

// ─── EXTRACTOR PANEL ───
export function ExtractorPanel({ pedido, onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [itens, setItens] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const extrair = async () => {
    setLoading(true); setError('')
    try { setItens((await extractItemsFromPdf(pedido.orcamento_url)).map(i => ({ ...i, _sel: true }))) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const upd = (i, f, v) => setItens(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x))

  const salvarPedido = async () => {
    setSalvando(true)
    await savePedidoItens(pedido.id, itens.filter(i => i._sel))
    setSalvando(false); onSaved?.(); onClose()
  }

  const salvarCatalogo = async () => {
    setSalvando(true)
    const sel = itens.filter(i => i._sel)
    for (const it of sel) await createProduto({ nome: it.nome_produto, preco: Number(it.preco_unitario) || 0, categoria: 'Outros' })
    setSalvando(false); alert(`${sel.length} produto(s) adicionados ao catálogo`)
  }

  const th = { padding: '6px 4px', fontWeight: 700, fontSize: 11, color: '#334155', background: '#F1F5F9', textAlign: 'left' }
  const ci = { ...inputStyle, padding: '3px 5px', fontSize: 11 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, overflowY: 'auto', padding: '16px 12px' }}>
      <div style={{ ...card, maxWidth: 640, margin: '20px auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🤖 Extrair Itens com IA</h3>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{pedido.cliente} · {pedido.numero_ref}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        {!itens && <button onClick={extrair} disabled={loading} style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.6 : 1 }}>
          {loading ? '⏳ Analisando PDF com IA...' : '🤖 Iniciar extração de itens'}
        </button>}

        {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>⚠ {error}</div>}

        {itens && (<>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>{itens.filter(i => i._sel).length} de {itens.length} itens selecionados</div>
          <div style={{ overflowX: 'auto', marginBottom: 14, border: '1px solid #E2E8F0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead><tr>
                <th style={{ ...th, width: 28 }}></th>
                <th style={th}>Produto</th>
                <th style={{ ...th, width: 52, textAlign: 'center' }}>Qtd</th>
                <th style={{ ...th, width: 44, textAlign: 'center' }}>Un</th>
                <th style={{ ...th, width: 78, textAlign: 'right' }}>Unit. R$</th>
                <th style={{ ...th, width: 78, textAlign: 'right' }}>Total R$</th>
              </tr></thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F1F5F9', opacity: it._sel ? 1 : 0.4 }}>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}><input type="checkbox" checked={it._sel} onChange={e => upd(i, '_sel', e.target.checked)} /></td>
                    <td style={{ padding: 4 }}><input value={it.nome_produto} onChange={e => upd(i, 'nome_produto', e.target.value)} style={ci} /></td>
                    <td style={{ padding: 4 }}><input value={it.quantidade} onChange={e => upd(i, 'quantidade', e.target.value)} style={{ ...ci, textAlign: 'center' }} /></td>
                    <td style={{ padding: 4 }}><input value={it.unidade} onChange={e => upd(i, 'unidade', e.target.value)} style={{ ...ci, textAlign: 'center' }} /></td>
                    <td style={{ padding: 4 }}><input value={it.preco_unitario} onChange={e => upd(i, 'preco_unitario', e.target.value)} style={{ ...ci, textAlign: 'right' }} /></td>
                    <td style={{ padding: 4 }}><input value={it.preco_total} onChange={e => upd(i, 'preco_total', e.target.value)} style={{ ...ci, textAlign: 'right' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={salvarCatalogo} disabled={salvando} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>📦 Salvar no catálogo</button>
            <button onClick={salvarPedido} disabled={salvando} style={{ ...btnPrimary, flex: 1, opacity: salvando ? 0.6 : 1 }}>💾 Salvar no pedido</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

// ─── ADMIN CLIENTES TAB ───
export function AdminClientesTab() {
  const [clientes, setClientes] = useState([])
  const [nome, setNome] = useState(''); const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState(''); const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => setClientes(await fetchClientes()), [])
  useEffect(() => { load() }, [load])

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    setSaving(true)
    await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, email: email || null })
    setNome(''); setCidade(''); setTelefone(''); setEmail('')
    await load(); setSaving(false)
  }

  return (<div>
    <div style={{ ...card, padding: 24, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0A1628' }}>Novo Cliente</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente *" style={inputStyle} />
        <select value={cidade} onChange={e => setCidade(e.target.value)} style={{ ...inputStyle, cursor: 'pointer', color: cidade ? '#0A1628' : '#94A3B8' }}>
          <option value="">Cidade...</option>{CIDADES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={inputStyle} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
      </div>
      <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '+ Adicionar Cliente'}</button>
    </div>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>Clientes ({clientes.length})</div>
    {clientes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhum cliente cadastrado</div>}
    {clientes.map(c => (<div key={c.id} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 15 }}>{c.nome}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
            {c.cidade && <span>📍 {c.cidade} &nbsp;</span>}{c.telefone && <span>📞 {c.telefone} &nbsp;</span>}{c.email && <span>✉ {c.email}</span>}
          </div>
        </div>
        <button onClick={async () => { if (!confirm(`Deletar ${c.nome}?`)) return; await deleteCliente(c.id); load() }} style={{ ...btnSmall, fontSize: 11, padding: '4px 10px', color: '#EF4444' }}>Deletar</button>
      </div>
    </div>))}
  </div>)
}

// ─── ADMIN VENDAS SECTION ───
function getDayStart(ago = 0) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ago); return d }

export function AdminVendasSection({ pedidos }) {
  const pv = pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const soma = ps => ps.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tHoje = soma(pv.filter(p => new Date(p.criado_em) >= getDayStart()))
  const tSemana = soma(pv.filter(p => new Date(p.criado_em) >= getDayStart(7)))
  const tMes = soma(pv.filter(p => new Date(p.criado_em) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const dias = Array.from({ length: 7 }, (_, i) => {
    const s = getDayStart(6 - i); const e = i < 6 ? getDayStart(5 - i) : new Date()
    return { label: s.toLocaleDateString('pt-BR', { weekday: 'short' }), t: soma(pv.filter(p => { const d = new Date(p.criado_em); return d >= s && d < e })) }
  })
  const maxT = Math.max(...dias.map(d => d.t), 1)
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 1.5 }}>Vendas</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[['Hoje', tHoje], ['7 dias', tSemana], ['Mês', tMes]].map(([l, v]) => (
          <div key={l} style={{ background: '#fff', borderRadius: 12, padding: '12px 10px', textAlign: 'center', borderLeft: '4px solid #10B981', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>{fmtMoney(v)}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>Últimos 7 dias</div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 70 }}>
          {dias.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: '100%', background: i === 6 ? '#3B82F6' : '#BFDBFE', borderRadius: '3px 3px 0 0', height: `${Math.max((d.t / maxT) * 52, d.t > 0 ? 3 : 0)}px`, transition: 'height 0.3s' }} />
              <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── CLIENTE COMBOBOX ───
export function ClienteCombobox({ clientes, value, onChange }) {
  const [open, setOpen] = useState(false)
  const filtered = clientes.filter(c => !value || c.nome.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nome do Cliente / Unidade" style={inputStyle} />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '2px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 10px 10px', zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}>
          {filtered.map(c => (
            <div key={c.id} onMouseDown={() => { onChange(c.nome); setOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ fontWeight: 600 }}>{c.nome}</span>
              {c.cidade && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>📍 {c.cidade}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
