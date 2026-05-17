import { useState, useEffect, useCallback, useMemo } from 'react'
import { fmtMoney, btnSmall, card } from './db.js'
import { fetchContasReceber, clientesInadimplentes, statusEfetivo } from './financeiro-db.js'

function fmtData(iso) { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('pt-BR') }
function diasAtraso(iso) { const hoje = new Date(); hoje.setHours(0, 0, 0, 0); return Math.round((hoje - new Date(iso + 'T00:00:00')) / 86400000) }

export function InadimplenciaCard({ inadimplentes, onSelecionar }) {
  if (!inadimplentes.length) return null
  return (
    <div style={{ ...card, padding: 16, marginBottom: 16, border: '2px solid #FECACA', background: '#FEF2F2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 20 }}>🚨</span>
        <h3 style={{ margin: 0, fontSize: 15, color: '#991B1B', fontWeight: 800 }}>Clientes inadimplentes ({inadimplentes.length})</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {inadimplentes.map(i => (
          <button key={i.cliente_id || i.cliente_nome} onClick={() => onSelecionar?.(i)} style={{ background: '#fff', border: '1px solid #FECACA', borderRadius: 10, padding: 12, textAlign: 'left', cursor: onSelecionar ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.cliente_nome}</div>
            <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4 }}>{i.count} contas atrasadas</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#B91C1C', marginTop: 2 }}>{fmtMoney(i.total)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// Lista readonly de inadimplência para vendedor/comercial.
// Mostra apenas clientes do próprio usuário (via vendedor_nome ou criado_por).
export function InadimplenciaReadonly({ user, role = 'comercial' }) {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])

  const load = useCallback(async () => {
    const cr = await fetchContasReceber()
    setContas(cr); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    import('./db.js').then(({ fetchClientes }) => fetchClientes().then(setClientes))
  }, [])

  const minhasContas = useMemo(() => {
    if (!user?.nome) return []
    const minhasIds = new Set(clientes.filter(c => {
      if (role === 'vendedor') return c.vendedor_nome === user.nome
      return true
    }).map(c => c.id))
    const minhasNomes = new Set(clientes.filter(c => role === 'vendedor' ? c.vendedor_nome === user.nome : true).map(c => (c.nome || '').toLowerCase()))
    return contas.filter(c => {
      if (role === 'vendedor') {
        return (c.cliente_id && minhasIds.has(c.cliente_id)) || minhasNomes.has((c.cliente_nome || '').toLowerCase())
      }
      return true
    })
  }, [contas, clientes, user, role])

  const inadimp = useMemo(() => clientesInadimplentes(minhasContas), [minhasContas])
  const atrasadas = useMemo(() => minhasContas.filter(c => statusEfetivo(c) === 'ATRASADO').sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)), [minhasContas])

  if (loading) return <div style={{ color: '#94A3B8', textAlign: 'center', padding: 30 }}>Carregando...</div>

  return (
    <div>
      <div style={{ ...card, padding: 14, marginBottom: 14, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
        <div style={{ fontSize: 12, color: '#9A3412' }}>👁️ Visualização somente leitura — para alterar status acesse o setor Financeiro.</div>
      </div>
      <InadimplenciaCard inadimplentes={inadimp} />
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '14px 0 10px', textTransform: 'uppercase', letterSpacing: 1.5 }}>Contas atrasadas ({atrasadas.length})</h3>
      {atrasadas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#94A3B8', background: '#F0FDF4', borderRadius: 10 }}>Tudo em dia ✓</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 110px 80px', gap: 8, padding: '10px 12px', background: '#F8FAFC', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <div>Cliente</div><div>NF</div><div>Vencim.</div><div style={{ textAlign: 'right' }}>Valor</div><div style={{ textAlign: 'right' }}>Atraso</div>
          </div>
          {atrasadas.map(c => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 110px 80px', gap: 8, padding: '10px 12px', borderTop: '1px solid #F1F5F9', fontSize: 12, alignItems: 'center', background: '#FEF2F2' }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente_nome}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{c.numero_nf || '—'}</div>
              <div>{fmtData(c.data_vencimento)}</div>
              <div style={{ textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>{fmtMoney(c.valor)}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#B91C1C', fontWeight: 700 }}>{diasAtraso(c.data_vencimento)} dias</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
