import { useState, useEffect, useCallback } from 'react'
import { card, btnPrimary, btnSmall, fmt, fetchPedidosByIds, addHistorico, updatePedido, addRotaPedidos } from './db.js'
import { fetchRoteiros, fetchMotoristas, labelVeiculo, fmtDuracao, updateRoteiro, enriquecerComEnderecos } from './roteiro-db.js'
import { gerarRoteiroPdf } from './roteiro-pdf.js'
import { RoteiroBuilder } from './roteiro-builder.jsx'

const statusCfg = {
  rascunho:      { label: 'Rascunho',     bg: '#E2E8F0', fg: '#475569' },
  ativa:         { label: 'Ativa',        bg: '#FEF3C7', fg: '#B45309' },
  confirmada:    { label: 'Confirmada',   bg: '#DBEAFE', fg: '#1D4ED8' },
  em_andamento:  { label: 'Em andamento', bg: '#EDE9FE', fg: '#5B21B6' },
  finalizada:    { label: 'Finalizada',   bg: '#D1FAE5', fg: '#065F46' }
}

export function RoteirosTab({ pedidos, user, somenteMotorista }) {
  const [roteiros, setRoteiros] = useState([])
  const [motoristas, setMotoristas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [filtroMot, setFiltroMot] = useState(somenteMotorista || '')
  const [filtroData, setFiltroData] = useState('')
  const [reimprimindo, setReimprimindo] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetchRoteiros({ motorista: filtroMot || undefined, data: filtroData || undefined, limit: 100 })
    setRoteiros(r); setLoading(false)
  }, [filtroMot, filtroData])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!somenteMotorista) fetchMotoristas().then(setMotoristas) }, [somenteMotorista])

  const reimprimir = async (r) => {
    setReimprimindo(r.id)
    const ids = r.ordem_pedidos || []
    const peds = ids.length ? await fetchPedidosByIds(ids) : []
    const ordered = ids.map(id => peds.find(p => p.id === id)).filter(Boolean)
    const enriquecidos = await enriquecerComEnderecos(ordered)
    gerarRoteiroPdf({ roteiro: r, pedidos: enriquecidos, criadoPor: r.criado_por })
    setReimprimindo(null)
  }

  const confirmarRascunho = async (r) => {
    if (!confirm('Confirmar este roteiro? Os pedidos serão movidos para EM_ROTA.')) return
    const ids = r.ordem_pedidos || []
    if (ids.length) {
      await addRotaPedidos(r.id, ids)
      for (const id of ids) {
        await updatePedido(id, { status: 'EM_ROTA', entregue_por: r.motorista_nome })
        await addHistorico(id, user.nome, `Confirmou roteiro ${r.numero_roteiro}`)
      }
    }
    await updateRoteiro(r.id, { status: 'ativa' })
    await load()
  }

  if (showBuilder) {
    return <RoteiroBuilder pedidos={pedidos} user={user}
      onClose={() => setShowBuilder(false)}
      onConcluido={() => { load() }} />
  }

  return (
    <div>
      {!somenteMotorista && (
        <button onClick={() => setShowBuilder(true)} style={{ ...btnPrimary, marginBottom: 14, background: '#3B82F6' }}>
          🗺️ Montar Roteiro
        </button>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {!somenteMotorista && (
          <select value={filtroMot} onChange={e => setFiltroMot(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A', cursor: 'pointer' }}>
            <option value="">Todos os motoristas</option>
            {motoristas.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
          </select>
        )}
        <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC', color: '#0F172A' }} />
        {(filtroMot || filtroData) && !somenteMotorista && (
          <button onClick={() => { setFiltroMot(''); setFiltroData('') }} style={{ ...btnSmall, fontSize: 11 }}>✕ Limpar</button>
        )}
      </div>
      {loading ? <div style={{ padding: 20, color: '#94A3B8' }}>Carregando...</div>
        : roteiros.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhum roteiro encontrado</div>
        : roteiros.map(r => {
          const s = statusCfg[r.status] || statusCfg.confirmada
          const cidades = (r.cidades?.length ? r.cidades : [r.cidade]).filter(Boolean).join(', ')
          const totalPedidos = r.ordem_pedidos?.length || 0
          return (
            <div key={r.id} style={{ ...card, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: '#0A1628', color: '#fff', padding: '3px 8px', borderRadius: 6, fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{r.numero_roteiro || '—'}</span>
                    <span style={{ background: s.bg, color: s.fg, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 14, marginTop: 4 }}>{r.motorista_nome}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>📍 {cidades || '—'} · {labelVeiculo(r.veiculo)} {r.placa ? `· ${r.placa}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                    {totalPedidos} entregas · {r.distancia_km ? `${Number(r.distancia_km).toFixed(1)} km` : '—'} · {fmtDuracao(r.duracao_min)} · {fmt(r.criado_em)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <button onClick={() => reimprimir(r)} disabled={reimprimindo === r.id} style={{ ...btnSmall, fontSize: 11, padding: '5px 10px', color: '#7C3AED' }}>
                    {reimprimindo === r.id ? 'Gerando...' : '🖨️ Reimprimir'}
                  </button>
                  {r.status === 'rascunho' && !somenteMotorista && (
                    <button onClick={() => confirmarRascunho(r)} style={{ ...btnSmall, fontSize: 11, padding: '5px 10px', color: '#10B981' }}>✓ Confirmar</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
    </div>
  )
}
