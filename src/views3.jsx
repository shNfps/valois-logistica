import { useState, useRef } from 'react'
import { fmtMoney, inputStyle, btnPrimary, btnSmall, card, FABRICANTES, CATEGORIAS_PRODUTO, uploadImage, updateProduto } from './db.js'

export { ExtractorPanel } from './extractor-panel.jsx'
export { AdminClientesTab } from './admin-clientes.jsx'

const fmtDoc = v => { const n=v.replace(/\D/g,'').slice(0,14); if(n.length<=3)return n; if(n.length<=6)return n.slice(0,3)+'.'+n.slice(3); if(n.length<=9)return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6); if(n.length<=11)return n.slice(0,3)+'.'+n.slice(3,6)+'.'+n.slice(6,9)+'-'+n.slice(9); if(n.length<=12)return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5,8)+'/'+n.slice(8); return n.slice(0,2)+'.'+n.slice(2,5)+'.'+n.slice(5,8)+'/'+n.slice(8,12)+'-'+n.slice(12) }

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
