import { useState } from 'react'
import { updateProduto, uploadImage, inputStyle, btnPrimary, btnSmall, card } from './db.js'

export function FotosProdutosModal({ produtos, onClose, onSaved }) {
  const semFoto = produtos.filter(p => !p.img_url)
  const [urls, setUrls] = useState({})
  const [uploads, setUploads] = useState({})
  const [salvando, setSalvando] = useState(false)

  const setUrl = (id, val) => setUrls(prev => ({ ...prev, [id]: val }))

  const handleUpload = async (id, file) => {
    if (!file) return
    setUploads(prev => ({ ...prev, [id]: { loading: true } }))
    const url = await uploadImage(file)
    if (url) {
      setUrls(prev => ({ ...prev, [id]: url }))
      setUploads(prev => ({ ...prev, [id]: { loading: false, nome: file.name } }))
    } else {
      setUploads(prev => ({ ...prev, [id]: { loading: false } }))
    }
  }

  const totalPreenchidos = Object.values(urls).filter(u => u?.trim()).length

  const salvar = async () => {
    setSalvando(true)
    let count = 0
    for (const [id, url] of Object.entries(urls)) {
      if (url?.trim()) { await updateProduto(id, { img_url: url.trim() }); count++ }
    }
    setSalvando(false)
    if (count > 0) onSaved?.()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, overflowY: 'auto', padding: 16 }}>
      <div style={{ ...card, maxWidth: 620, margin: '20px auto', padding: 24, marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0A1628' }}>📷 Adicionar fotos aos produtos</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        {semFoto.length === 0
          ? <p style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>Todos os produtos já têm foto! 🎉</p>
          : (<>
            <p style={{ fontSize: 12, color: '#64748B', marginBottom: 14, lineHeight: 1.5 }}>
              {semFoto.length} produto(s) sem foto. Clique em <b>🔍</b> para abrir Google Imagens, encontre a foto, clique com botão direito → <i>"Copiar endereço da imagem"</i> e cole no campo ao lado.
            </p>

            {semFoto.map(p => {
              const urlVal = urls[p.id] || ''
              const up = uploads[p.id]
              const googleQ = encodeURIComponent(p.nome + (p.fabricante ? ' ' + p.fabricante : ''))
              return (
                <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {urlVal.trim()
                      ? <img src={urlVal} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                      : <span style={{ fontSize: 16 }}>📦</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{p.nome}</div>
                    {p.codigo && <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{p.codigo}</div>}
                  </div>
                  <a href={`https://www.google.com/search?tbm=isch&q=${googleQ}`} target="_blank" rel="noreferrer"
                    style={{ ...btnSmall, fontSize: 11, padding: '4px 8px', color: '#1D4ED8', textDecoration: 'none', flexShrink: 0 }}>🔍</a>
                  <input
                    value={urlVal} onChange={e => setUrl(p.id, e.target.value)}
                    placeholder={up?.loading ? 'Fazendo upload...' : up?.nome ? `✓ ${up.nome}` : 'Colar URL...'}
                    style={{ ...inputStyle, fontSize: 11, padding: '5px 8px', width: 180, flexShrink: 0 }}
                  />
                  <label style={{ ...btnSmall, fontSize: 11, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>
                    📷
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpload(p.id, e.target.files[0])} />
                  </label>
                </div>
              )
            })}

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={salvar} disabled={salvando || totalPreenchidos === 0}
                style={{ ...btnPrimary, flex: 2, opacity: salvando || totalPreenchidos === 0 ? 0.5 : 1 }}>
                {salvando ? 'Salvando...' : `💾 Salvar ${totalPreenchidos} foto(s)`}
              </button>
            </div>
          </>)}
      </div>
    </div>
  )
}
