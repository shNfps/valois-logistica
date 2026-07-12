import { useRef, useState, useEffect, useCallback } from 'react'

// ─── AttachmentInput — anexo nativo (sem shadcn/Tailwind) ───
// Zona de arrastar-e-soltar OU clicar; preview (miniatura de imagem / ícone de PDF),
// remover, validação de tipo e tamanho. Estilo 100% tokens da reforma.
// Reutilizável: trabalha com File[] e devolve via onFiles — quem consome faz o upload.
//
// Props:
//   files      : File[]        — arquivos selecionados (controlado)
//   onFiles    : (File[])=>void
//   multiple   : boolean       — default false
//   accept     : string        — default 'image/*,.pdf'
//   maxSizeMB  : number        — default 10
//   existingUrl: string|null   — comprovante já salvo (modo edição); mostra link e some ao anexar novo

const DEFAULT_ACCEPT = 'image/*,.pdf'

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function accepts(file, accept) {
  const parts = accept.split(',').map(s => s.trim().toLowerCase())
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return parts.some(p => {
    if (!p) return false
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1))
    if (p.startsWith('.')) return name.endsWith(p)
    return type === p
  })
}

function FileRow({ file, onRemove }) {
  const [thumb, setThumb] = useState(null)
  const isImg = (file.type || '').startsWith('image/')
  useEffect(() => {
    if (!isImg) return
    const url = URL.createObjectURL(file)
    setThumb(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImg])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-control)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', background: isImg ? 'var(--background)' : 'var(--valois-blue-soft)' }}>
        {isImg && thumb
          ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 20 }}>📄</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{fmtSize(file.size)}</div>
      </div>
      <button type="button" onClick={onRemove} title="Remover" aria-label={`Remover ${file.name}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1, padding: 6, flexShrink: 0 }}>✕</button>
    </div>
  )
}

export function AttachmentInput({ files = [], onFiles, multiple = false, accept = DEFAULT_ACCEPT, maxSizeMB = 10, existingUrl = null }) {
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [erro, setErro] = useState('')

  const add = useCallback((list) => {
    const incoming = Array.from(list || [])
    if (!incoming.length) return
    const ok = []
    for (const f of incoming) {
      if (!accepts(f, accept)) { setErro(`"${f.name}" não é um tipo aceito.`); continue }
      if (f.size > maxSizeMB * 1024 * 1024) { setErro(`"${f.name}" passa de ${maxSizeMB} MB.`); continue }
      ok.push(f)
    }
    if (!ok.length) return
    setErro('')
    onFiles(multiple ? [...files, ...ok] : [ok[0]])
  }, [files, onFiles, multiple, accept, maxSizeMB])

  const removeAt = (i) => onFiles(files.filter((_, idx) => idx !== i))

  const onDrop = (e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }
  const showExisting = existingUrl && files.length === 0

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        style={{
          width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '18px 14px', cursor: 'pointer', fontFamily: "'Inter',sans-serif",
          border: `2px dashed ${drag ? 'var(--valois-blue)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-card)', background: drag ? 'var(--valois-blue-soft)' : 'var(--background)',
        }}>
        <span style={{ fontSize: 22 }}>📎</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {multiple ? 'Arraste arquivos ou clique para anexar' : 'Arraste o comprovante ou clique para anexar'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Imagem ou PDF · até {maxSizeMB} MB</span>
      </button>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={e => { add(e.target.files); e.target.value = '' }} style={{ display: 'none' }} />

      {erro && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{erro}</div>}

      {showExisting && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span>Comprovante atual:</span>
          <a href={existingUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--valois-blue)', fontWeight: 600 }}>abrir ↗</a>
          <span>· anexe um novo para substituir</span>
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {files.map((f, i) => <FileRow key={`${f.name}-${i}`} file={f} onRemove={() => removeAt(i)} />)}
        </div>
      )}
    </div>
  )
}
