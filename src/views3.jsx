import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fmtMoney, fmtCnpj, inputStyle, btnPrimary, btnSmall, card, CIDADES, FABRICANTES, CATEGORIAS_PRODUTO, fetchClientes, createCliente, deleteCliente, uploadImage, updateProduto } from './db.js'
import { ClienteDetalhe } from './views6.jsx'
import { ClienteBadges, calcClienteBadges, ALL_BADGE_KEYS, BADGE_DEFS } from './cliente-badges.jsx'

export { ExtractorPanel } from './extractor-panel.jsx'

// ─── ADMIN CLIENTES TAB ───
const fmtDoc = v => { const n=v.replace(/\D/g,'').slice(0,14); if(n.length<=3)return n; if(n.length<=6)return n.slice(0,3)+'.'+n.slice(3); if(n.length<=9)return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6); if(n.length<=11)return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6,9)+'-'+n.slice(9); if(n.length<=12)return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5,8)+'/'+n.slice(8); return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5,8)+'/'+n.slice(8,12)+'-'+n.slice(12) }

export function AdminClientesTab({ pedidos = [] }) {
  const [clientes, setClientes] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [nome, setNome] = useState(''); const [cidade, setCidade] = useState('')
  const [telefone, setTelefone] = useState(''); const [email, setEmail] = useState(''); const [documento, setDocumento] = useState('')
  const [endereco, setEndereco] = useState(''); const [cnpj, setCnpj] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => setClientes(await fetchClientes()), [])
  useEffect(() => { load() }, [load])
  const { badgesMap, valorMap } = useMemo(() => {
    const bm = {}, vm = {}; clientes.forEach(c => { const cp = pedidos.filter(p => p.cliente?.toLowerCase() === c.nome?.toLowerCase()); bm[c.id] = calcClienteBadges(cp) }); pedidos.filter(p => ['NF_EMITIDA','EM_ROTA','ENTREGUE'].includes(p.status)).forEach(p => { const k = p.cliente?.toLowerCase(); if (k) vm[k] = (vm[k] || 0) + (Number(p.valor_total) || 0) }); return { badgesMap: bm, valorMap: vm }
  }, [clientes, pedidos])
  const [activeFilters, setActiveFilters] = useState([])
  const toggleFilter = k => setActiveFilters(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const displayClientes = activeFilters.length === 0 ? clientes : clientes.filter(c => activeFilters.every(k => badgesMap[c.id]?.includes(k)))

  if (selecionado) {
    const c = clientes.find(x => x.id === selecionado)
    if (!c) { setSelecionado(null); return null }
    return <ClienteDetalhe cliente={c} onBack={() => setSelecionado(null)} />
  }

  const criar = async () => {
    if (!nome.trim()) { alert('Informe o nome'); return }
    if (!endereco.trim()) { alert('Informe o endereço'); return }
    if (cnpj.replace(/\D/g, '').length !== 14) { alert('CNPJ deve ter 14 dígitos (somente números)'); return }
    setSaving(true)
    const docLimpo = documento.replace(/\D/g, '') || null
    const { error } = await createCliente({ nome: nome.trim(), cidade: cidade || null, telefone: telefone || null, email: email || null, documento: docLimpo, endereco: endereco.trim(), cnpj: cnpj.replace(/\D/g, '') })
    if (error) {
      alert(error.code === '23505' || error.message?.includes('unique') ? 'Já existe um cliente com este CPF/CNPJ cadastrado' : 'Erro: ' + error.message)
      setSaving(false); return
    }
    setNome(''); setCidade(''); setTelefone(''); setEmail(''); setDocumento(''); setEndereco(''); setCnpj('')
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
      <input value={cnpj} onChange={e => setCnpj(fmtCnpj(e.target.value))} placeholder="CNPJ *" inputMode="numeric" style={{ ...inputStyle, marginBottom: 10 }} />
      <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo *" style={{ ...inputStyle, marginBottom: 10 }} />
      <input value={documento} onChange={e => setDocumento(fmtDoc(e.target.value))} placeholder="CPF (opcional)" inputMode="numeric" style={{ ...inputStyle, marginBottom: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone" style={inputStyle} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" style={inputStyle} />
      </div>
      <button onClick={criar} disabled={saving} style={{ ...btnPrimary, width: '100%', opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : '+ Adicionar Cliente'}</button>
    </div>
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
      <button onClick={() => setActiveFilters([])} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeFilters.length === 0 ? '#0A1628' : '#E2E8F0', color: activeFilters.length === 0 ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>Todos</button>
      {ALL_BADGE_KEYS.map(k => { const cnt = Object.values(badgesMap).filter(b => b.includes(k)).length; if (!cnt) return null; const active = activeFilters.includes(k); return <button key={k} onClick={() => toggleFilter(k)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: active ? '#0A1628' : '#E2E8F0', color: active ? '#fff' : '#64748B', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>{BADGE_DEFS[k].icon} {cnt}</button> })}
    </div>
    <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>Clientes ({displayClientes.length})</div>
    {displayClientes.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>{activeFilters.length > 0 ? 'Nenhum cliente com este filtro' : 'Nenhum cliente cadastrado'}</div>}
    {displayClientes.map(c => {
      const nPedidos = pedidos.filter(p => p.cliente_id === c.id).length
      const cPedidos = pedidos.filter(p => p.cliente?.toLowerCase() === c.nome?.toLowerCase())
      const valorTotal = valorMap[c.nome?.toLowerCase()] || 0
      return (<div key={c.id} onClick={() => setSelecionado(c.id)} style={{ ...card, cursor: 'pointer', border: '2px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#0A1628', fontSize: 15 }}>{c.nome}</span>
              {nPedidos > 0 && <span style={{ background: '#DBEAFE', color: '#1D4ED8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>{nPedidos} pedido{nPedidos > 1 ? 's' : ''}</span>}
              <ClienteBadges pedidos={cPedidos} />
              <span style={{ background: '#F0FDF4', color: valorTotal > 0 ? '#059669' : '#94A3B8', fontWeight: 700, padding: '4px 10px', borderRadius: 8, fontSize: 12, flexShrink: 0 }}>{fmtMoney(valorTotal)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
              {c.documento && <span style={{ fontWeight: 600 }}>{fmtDoc(c.documento)} &nbsp;</span>}{c.cidade && <span>📍 {c.cidade} &nbsp;</span>}{c.telefone && <span>📞 {c.telefone} &nbsp;</span>}{c.email && <span>✉ {c.email}</span>}
            </div>
          </div>
          <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`Deletar ${c.nome}?`)) return; await deleteCliente(c.id); load() }} style={{ ...btnSmall, fontSize: 11, padding: '4px 10px', color: '#EF4444' }}>Deletar</button>
        </div>
      </div>)
    })}
  </div>)
}

// ─── ADMIN VENDAS SECTION ───
function getDayStart(ago = 0) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ago); return d }

export function AdminVendasSection({ pedidos }) {
  const [tooltip, setTooltip] = useState(null)
  const [hovered, setHovered] = useState(null)
  const pv = pedidos.filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))
  const soma = ps => ps.reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tHoje = soma(pv.filter(p => new Date(p.criado_em) >= getDayStart()))
  const tSemana = soma(pv.filter(p => new Date(p.criado_em) >= getDayStart(7)))
  const tMes = soma(pv.filter(p => new Date(p.criado_em) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const dias = Array.from({ length: 7 }, (_, i) => {
    const start = getDayStart(6 - i); const end = i < 6 ? getDayStart(5 - i) : new Date()
    const dp = pv.filter(p => { const d = new Date(p.criado_em); return d >= start && d < end })
    return { label: start.toLocaleDateString('pt-BR', { weekday: 'short' }), date: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), t: soma(dp), count: dp.length }
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
          {dias.map((d, i) => {
            const isToday = i === 6
            const bg = hovered === i ? (isToday ? '#60A5FA' : '#93C5FD') : (isToday ? '#3B82F6' : '#BFDBFE')
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'default' }}
                onMouseEnter={e => { setHovered(i); setTooltip({ x: e.clientX, y: e.clientY, ...d }) }}
                onMouseMove={e => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                onMouseLeave={() => { setHovered(null); setTooltip(null) }}>
                <div style={{ width: '100%', background: bg, borderRadius: '3px 3px 0 0', height: `${Math.max((d.t / maxT) * 52, d.t > 0 ? 3 : 0)}px`, transition: 'background 0.15s' }} />
                <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' }}>{d.label}</div>
              </div>
            )
          })}
        </div>
      </div>
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10, background: '#0A1628', color: '#fff', borderRadius: 8, padding: 8, fontSize: 12, zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{tooltip.label} · {tooltip.date}</div>
          <div>{tooltip.t > 0 ? fmtMoney(tooltip.t) : 'Sem vendas'}</div>
          {tooltip.count > 0 && <div style={{ opacity: 0.65, marginTop: 2 }}>{tooltip.count} pedido{tooltip.count !== 1 ? 's' : ''}</div>}
        </div>
      )}
    </div>
  )
}

// ─── EDIT PRODUTO MODAL ───
export function EditProdutoModal({ prod, onClose, onSaved }) {
  const [eNome, setENome] = useState(prod.nome)
  const [eCodigo, setECodigo] = useState(prod.codigo || '')
  const [ePreco, setEPreco] = useState(String(prod.preco))
  const [eCat, setECat] = useState(prod.categoria)
  const [eDiluicao, setEDiluicao] = useState(prod.diluicao || '')
  const [eFab, setEFab] = useState(prod.fabricante || '')
  const [eImg, setEImg] = useState(null)
  const [eImgUrl, setEImgUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const imgRef = useRef(null)

  const salvar = async () => {
    if (!eNome.trim()) { alert('Informe o nome'); return }
    if (!ePreco) { alert('Informe o preço'); return }
    setUploading(true)
    let img_url = prod.img_url
    if (eImg) img_url = await uploadImage(eImg)
    else if (eImgUrl.trim()) img_url = eImgUrl.trim()
    await updateProduto(prod.id, { nome: eNome.trim(), codigo: eCodigo.trim().replace(/\./g, '') || null, preco: parseFloat(ePreco), categoria: eCat, fabricante: eFab || null, img_url, diluicao: eCat === 'Químicos' ? eDiluicao.trim() || null : null })
    setUploading(false); onSaved(); onClose()
  }

  const preview = eImg ? URL.createObjectURL(eImg) : (eImgUrl.trim() || prod.img_url)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, width: '100%', maxWidth: 400, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✏️ Editar Produto</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        {preview && <img src={preview} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />}
        <input type="file" accept="image/*" ref={imgRef} onChange={e => setEImg(e.target.files[0])} style={{ display: 'none' }} />
        <button onClick={() => imgRef.current.click()} style={{ ...btnSmall, width: '100%', justifyContent: 'center', marginBottom: 6 }}>
          {eImg ? `📷 ${eImg.name}` : '📷 Upload de foto'}
        </button>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(eNome + (eFab ? ' ' + eFab : ''))}`} target="_blank" rel="noreferrer" style={{ ...btnSmall, fontSize: 11, padding: '6px 10px', color: '#1D4ED8', textDecoration: 'none', flexShrink: 0 }}>🔍 Google</a>
          <input value={eImgUrl} onChange={e => setEImgUrl(e.target.value)} placeholder="Ou colar URL da imagem..." style={{ ...inputStyle, fontSize: 12 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={eCodigo} onChange={e => setECodigo(e.target.value)} placeholder="Código" style={inputStyle} />
          <input value={eNome} onChange={e => setENome(e.target.value)} placeholder="Nome *" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input value={ePreco} onChange={e => setEPreco(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Preço" inputMode="decimal" style={inputStyle} />
          <select value={eCat} onChange={e => setECat(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {CATEGORIAS_PRODUTO.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {eCat === 'Químicos' && <input value={eDiluicao} onChange={e => setEDiluicao(e.target.value)} placeholder="Diluição (ex: 1:10, Puro)" style={{ ...inputStyle, marginBottom: 10 }} />}
        <select value={eFab} onChange={e => setEFab(e.target.value)} style={{ ...inputStyle, marginBottom: 14, cursor: 'pointer', color: eFab ? '#0A1628' : '#94A3B8' }}>
          <option value="">Fabricante...</option>{FABRICANTES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={salvar} disabled={uploading} style={{ ...btnPrimary, width: '100%', opacity: uploading ? 0.6 : 1 }}>{uploading ? 'Salvando...' : '✓ Salvar alterações'}</button>
      </div>
    </div>
  )
}

// ─── CLIENTE COMBOBOX ───
export function ClienteCombobox({ clientes, value, onChange, onSelect, onCreateNew }) {
  const [open, setOpen] = useState(false)
  const filtered = clientes.filter(c => !value || c.nome.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
  const showCreate = onCreateNew && value.trim() && filtered.length === 0
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={e => { onChange(e.target.value); onSelect?.(null); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Nome do Cliente / Unidade" style={inputStyle} />
      {open && (filtered.length > 0 || showCreate) && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '2px solid #E2E8F0', borderTop: 'none', borderRadius: '0 0 10px 10px', zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}>
          {filtered.map(c => (
            <div key={c.id} onMouseDown={() => { onChange(c.nome); onSelect?.(c); setOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #F1F5F9' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ fontWeight: 600 }}>{c.nome}</span>
              {c.cidade && <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>📍 {c.cidade}</span>}
              {c.documento && <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 6 }}>{fmtDoc(c.documento)}</span>}
            </div>
          ))}
          {showCreate && (
            <div onMouseDown={() => { onCreateNew(value.trim()); setOpen(false) }}
              style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#3B82F6', fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              ➕ Cadastrar "{value.trim()}" como novo cliente
            </div>
          )}
        </div>
      )}
    </div>
  )
}
