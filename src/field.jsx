// ─── Field — wrapper de campo de formulário (equivalente nativo ao shadcn Field) ───
// Padroniza rótulo, dica, marca de obrigatório e mensagem de erro, consumindo os
// design tokens (theme.css). Sem shadcn/Tailwind — mesma linha do AttachmentInput.
//
// Uso:
//   <Field label="Vencimento do boleto" required hint="Data exata do boleto">
//     <input type="date" .../>
//   </Field>

export function Field({ label, required, hint, error, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>{error}</span>}
    </div>
  )
}

// Faixa de erro/aviso reutilizável (banner) — usada em formulários e modais.
export function FormAlert({ tipo = 'erro', children }) {
  const cor = tipo === 'erro'
    ? { bg: '#FEE2E2', fg: '#991B1B', bd: '#FECACA' }
    : { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' }
  return (
    <div style={{ background: cor.bg, color: cor.fg, border: `1px solid ${cor.bd}`, borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 600 }}>
      {children}
    </div>
  )
}
