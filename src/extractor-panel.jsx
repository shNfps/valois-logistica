import { useState } from 'react'
import { extractItemsFromPdf } from './ai.js'
import { fetchProdutos, updateProduto, createProduto, savePedidoItens, inputStyle, btnPrimary, btnSmall, card } from './db.js'

const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function matchItem(item, produtos) {
  const cod = item.codigo ? String(item.codigo).replace(/\./g, '') : null
  if (cod) {
    const byCode = produtos.find(p => p.codigo && p.codigo === cod)
    if (byCode) return byCode
  }
  const needle = norm(item.nome_produto)
  return produtos.find(p => {
    const pn = norm(p.nome)
    return pn.includes(needle) || needle.includes(pn)
  }) || null
}

export function ExtractorPanel({ pedido, onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [itens, setItens] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const extrair = async () => {
    setLoading(true); setError('')
    try {
      const [raw, prods] = await Promise.all([extractItemsFromPdf(pedido.orcamento_url), fetchProdutos()])
      setItens(raw.map(i => {
        const cod = i.codigo ? String(i.codigo).replace(/\./g, '') : null
        const match = matchItem({ ...i, codigo: cod }, prods)
        return { ...i, codigo: match?.codigo || cod || '', _sel: true, _catalogProd: match || null, _status: match ? 'catalogo' : 'novo' }
      }))
    } catch (e) { setError(e.message) }
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
    let criados = 0, atualizados = 0, ignorados = 0
    for (const it of itens.filter(i => i._sel)) {
      const preco = Number(it.preco_unitario) || 0
      const cod = it.codigo ? String(it.codigo).replace(/\./g, '') : null
      if (it._status === 'catalogo' && it._catalogProd) {
        if (preco > Number(it._catalogProd.preco)) { await updateProduto(it._catalogProd.id, { preco }); atualizados++ }
        else ignorados++
      } else if (cod) {
        await createProduto({ nome: it.nome_produto, preco, categoria: 'Outros', codigo: cod, img_url: it._img_url?.trim() || null }); criados++
      }
    }
    setSalvando(false)
    alert(`Catálogo: ${criados} criado(s), ${atualizados} preço(s) atualizado(s), ${ignorados} sem alteração`)
  }

  const sel = itens?.filter(i => i._sel) || []
  const catalogoCount = sel.filter(i => i._status === 'catalogo').length
  const novosCount = sel.filter(i => i._status === 'novo').length
  const hasNovosemCodigo = sel.some(i => i._status === 'novo' && !i.codigo?.trim())

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

        {!itens && (
          <button onClick={extrair} disabled={loading} style={{ ...btnPrimary, width: '100%', opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Analisando PDF com IA...' : '🤖 Iniciar extração de itens'}
          </button>
        )}

        {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 12 }}>⚠ {error}</div>}

        {itens && (<>
          <div style={{ background: '#F1F5F9', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#065F46', fontWeight: 700 }}>✅ {catalogoCount} no catálogo</span>
            <span style={{ color: '#92400E', fontWeight: 700 }}>⚠️ {novosCount} novo(s)</span>
            {hasNovosemCodigo && <span style={{ color: '#EF4444', fontWeight: 600 }}>← preencha o código dos itens novos</span>}
          </div>

          <div style={{ overflowX: 'auto', marginBottom: 14, border: '1px solid #E2E8F0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead><tr>
                <th style={{ ...th, width: 28 }}></th>
                <th style={{ ...th, width: 76 }}>Status</th>
                <th style={{ ...th, width: 68 }}>Cód.</th>
                <th style={th}>Produto</th>
                <th style={{ ...th, width: 46, textAlign: 'center' }}>Qtd</th>
                <th style={{ ...th, width: 38, textAlign: 'center' }}>Un</th>
                <th style={{ ...th, width: 72, textAlign: 'right' }}>Unit. R$</th>
              </tr></thead>
              <tbody>
                {itens.map((it, i) => {
                  const isCat = it._status === 'catalogo'
                  const codEmpty = !isCat && !it.codigo?.trim()
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #F1F5F9', opacity: it._sel ? 1 : 0.4 }}>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <input type="checkbox" checked={it._sel} onChange={e => upd(i, '_sel', e.target.checked)} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <span style={{ background: isCat ? '#D1FAE5' : '#FEF3C7', color: isCat ? '#065F46' : '#92400E', fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                          {isCat ? '✅ Catálogo' : '⚠️ Novo'}
                        </span>
                      </td>
                      <td style={{ padding: 4 }}>
                        <input value={it.codigo || ''} onChange={e => upd(i, 'codigo', e.target.value)}
                          style={{ ...ci, fontFamily: 'monospace', width: 60, borderColor: codEmpty ? '#EF4444' : undefined, background: codEmpty ? '#FEF2F2' : undefined }}
                          placeholder={isCat ? '—' : '* obrig.'} />
                      </td>
                      <td style={{ padding: 4 }}><input value={it.nome_produto} onChange={e => upd(i, 'nome_produto', e.target.value)} style={ci} /></td>
                      <td style={{ padding: 4 }}><input value={it.quantidade} onChange={e => upd(i, 'quantidade', e.target.value)} style={{ ...ci, textAlign: 'center' }} /></td>
                      <td style={{ padding: 4 }}><input value={it.unidade} onChange={e => upd(i, 'unidade', e.target.value)} style={{ ...ci, textAlign: 'center' }} /></td>
                      <td style={{ padding: 4 }}><input value={it.preco_unitario} onChange={e => upd(i, 'preco_unitario', e.target.value)} style={{ ...ci, textAlign: 'right' }} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {itens.some(it => it._sel && it._status === 'novo' && it.tem_imagem) && (
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', marginBottom: 8 }}>📷 Fotos dos novos produtos (opcional)</div>
              {itens.map((it, i) => it._sel && it._status === 'novo' && it.tem_imagem ? (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 12, color: '#0A1628', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nome_produto}</span>
                  <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(it.nome_produto)}`} target="_blank" rel="noreferrer" style={{ ...btnSmall, fontSize: 11, padding: '3px 8px', color: '#1D4ED8', textDecoration: 'none', flexShrink: 0 }}>🔍 Google</a>
                  <input value={it._img_url || ''} onChange={e => upd(i, '_img_url', e.target.value)} placeholder="Colar URL da imagem..." style={{ ...ci, width: 160, flexShrink: 0 }} />
                  {it._img_url?.trim() && <img src={it._img_url} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />}
                </div>
              ) : null)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={salvarCatalogo} disabled={salvando || hasNovosemCodigo}
              title={hasNovosemCodigo ? 'Preencha o código dos itens novos antes de salvar' : ''}
              style={{ ...btnSmall, flex: 1, justifyContent: 'center', opacity: hasNovosemCodigo ? 0.45 : 1 }}>
              📦 Salvar no catálogo
            </button>
            <button onClick={salvarPedido} disabled={salvando} style={{ ...btnPrimary, flex: 1, opacity: salvando ? 0.6 : 1 }}>
              💾 Salvar no pedido
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}
