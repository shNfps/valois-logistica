import { useState, useEffect } from 'react'
import { fmtMoney } from './db.js'
import { fetchResumoInadimplenciaCliente } from './financeiro-db.js'

// ─── Alerta de inadimplência na seleção de cliente (comercial/vendedor) ───
// Não bloqueia a venda — apenas avisa. Recebe o cliente selecionado (id e/ou nome)
// e busca o resumo de pendências. Estruturado para permitir bloqueio futuro via
// prop `bloquear` (hoje só muda o texto). Some quando o cliente está em dia.
export function AlertaInadimplencia({ cliente, compact = false, bloquear = false }) {
  const [resumo, setResumo] = useState(null)
  const id = cliente?.id ?? cliente?.cliente_id ?? null
  const nome = cliente?.nome ?? cliente?.cliente_nome ?? null

  useEffect(() => {
    let vivo = true
    if (!id && !nome) { setResumo(null); return }
    fetchResumoInadimplenciaCliente({ id, nome }).then(r => { if (vivo) setResumo(r) })
    return () => { vivo = false }
  }, [id, nome])

  if (!resumo) return null
  const fs = compact ? { t: 12, d: 11, s: 10 } : { t: 13, d: 12, s: 11 }
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: compact ? '8px 10px' : '10px 12px', margin: compact ? '8px 0' : '8px 0' }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 15, lineHeight: 1.1 }}>🚨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#991B1B', fontSize: fs.t }}>Cliente com pendência financeira</div>
          <div style={{ color: '#B91C1C', fontSize: fs.d, marginTop: 2 }}>
            {fmtMoney(resumo.total)} em aberto · {resumo.count} boleto{resumo.count !== 1 ? 's' : ''} vencido{resumo.count !== 1 ? 's' : ''} · maior atraso {resumo.maiorAtraso} dias
          </div>
          <div style={{ color: '#9A3412', fontSize: fs.s, marginTop: 2 }}>
            {bloquear ? 'Venda bloqueada até regularização — fale com o Financeiro.' : 'Consulte o Financeiro antes de liberar novos pedidos. (Ver aba Inadimplência)'}
          </div>
        </div>
      </div>
    </div>
  )
}
