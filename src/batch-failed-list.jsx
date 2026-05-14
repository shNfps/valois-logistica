import { btnPrimary, btnSmall, card, fmt } from './db.js'

const ERR_LABELS = {
  rate_limit: 'rate limit (429)',
  pdf_fetch: 'erro ao baixar PDF',
  parse: 'JSON inválido',
  other: 'outro erro',
}

export function FailedListModal({ items, onClose, onRetry, onRetryOne }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ ...card, maxWidth: 720, width: '100%', padding: 24, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{items.length} pedidos com falha</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>{'✕'}</button>
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
          Geralmente uma nova tentativa resolve (rate limit). Clique em ↻ para reprocessar individualmente ou em "Tentar todos" no rodapé.
        </div>
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, marginBottom: 12 }}>
          {items.map(p => (
            <div key={p.id} style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
              <span style={{ fontWeight: 700, minWidth: 90, color: '#0A1628' }}>NF {p.numero_ref || p.id.slice(0, 8)}</span>
              <span style={{ flex: 1, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</span>
              {p.criado_em && <span style={{ color: '#94A3B8', fontSize: 11, whiteSpace: 'nowrap' }}>{fmt(p.criado_em)}</span>}
              <span style={{ color: '#EF4444', fontSize: 11, whiteSpace: 'nowrap' }}>{ERR_LABELS[p._errorType] || p._error || 'erro'}</span>
              <button onClick={() => onRetryOne?.(p)} title="Tentar extrair de novo" style={{ ...btnSmall, padding: '4px 10px', fontSize: 11, color: '#7C3AED', borderColor: '#DDD6FE' }}>↻ Extrair</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onRetry && items.length > 0 && <button onClick={onRetry} style={{ ...btnPrimary, flex: 1 }}>↻ Tentar todos novamente ({items.length})</button>}
          <button onClick={onClose} style={{ ...btnSmall, flex: 1, justifyContent: 'center' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}
