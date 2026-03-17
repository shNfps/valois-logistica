import { useState, useEffect, useCallback } from 'react'
import { getRef, btnSmall, btnPrimary, card, VEICULOS, fetchRotasAtivas, fetchRotaPedidoIds, fetchPedidosByIds, removeRotaPedido, addRotaPedidos, updatePedido } from './db.js'
import { Badge } from './components.jsx'

const vIcon = v => VEICULOS.find(x => x.key === v)?.icon || '🚐'

// ─── VENDEDOR ROTAS TAB ───
export function VendedorRotasTab() {
  const [rotas, setRotas] = useState([])
  const [expandido, setExpandido] = useState(null)
  const [rotaPedidos, setRotaPedidos] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchRotasAtivas().then(r => { setRotas(r); setLoading(false) }) }, [])

  const toggle = async (rota) => {
    if (expandido === rota.id) { setExpandido(null); return }
    setExpandido(rota.id)
    if (!rotaPedidos[rota.id]) {
      const ids = await fetchRotaPedidoIds(rota.id)
      const peds = await fetchPedidosByIds(ids)
      setRotaPedidos(prev => ({ ...prev, [rota.id]: peds }))
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>Carregando rotas...</div>
  if (!rotas.length) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhuma rota ativa no momento 🟢</div>

  return (
    <div>
      <style>{`@keyframes blink-red{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1.2 }}>
        Rotas Ao Vivo ({rotas.length})
      </div>
      {rotas.map(r => {
        const peds = rotaPedidos[r.id]
        const entregues = peds ? peds.filter(p => p.status === 'ENTREGUE').length : 0
        const exp = expandido === r.id
        return (
          <div key={r.id} style={{ ...card, borderLeft: '3px solid #EF4444', padding: '12px 16px', cursor: 'pointer' }} onClick={() => toggle(r)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#0A1628', fontSize: 14 }}>{vIcon(r.veiculo)} {r.motorista_nome}</span>
                <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>📍 {r.cidades?.length > 0 ? r.cidades.join(', ') : r.cidade}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'inline-block', animation: 'blink-red 1s infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>AO VIVO</span>
                <span style={{ fontSize: 12, color: '#CBD5E1', marginLeft: 2 }}>{exp ? '▲' : '▼'}</span>
              </div>
            </div>
            {peds && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{entregues} de {peds.length} entregues</div>}
            {exp && (
              <div style={{ marginTop: 10, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
                {!peds
                  ? <div style={{ fontSize: 12, color: '#94A3B8' }}>Carregando pedidos...</div>
                  : peds.length === 0
                    ? <div style={{ fontSize: 12, color: '#94A3B8' }}>Nenhum pedido nesta rota</div>
                    : peds.map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F8FAFC' }}>
                        <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>{p.numero_ref || p.id.slice(0, 4).toUpperCase()}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0A1628' }}>{p.cliente}</span>
                        <Badge status={p.status} />
                      </div>
                    ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ADMIN EDITAR ROTA (MODAL) ───
export function AdminEditRotaScreen({ rota, pedidos, onClose, onSaved }) {
  const [rotaPedidoIds, setRotaPedidoIds] = useState([])
  const [selecionados, setSelecionados] = useState(new Set())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setRotaPedidoIds(await fetchRotaPedidoIds(rota.id))
  }, [rota.id])
  useEffect(() => { load() }, [load])

  const rotaCidades = rota.cidades?.length > 0 ? rota.cidades : [rota.cidade]
  const pedidosNaRota = pedidos.filter(p => rotaPedidoIds.includes(p.id))
  const pedidosDisponiveis = pedidos.filter(p => rotaCidades.includes(p.cidade) && p.status === 'NF_EMITIDA')

  const remover = async (pedidoId) => {
    if (!confirm('Remover este pedido da rota?')) return
    setSaving(true)
    await removeRotaPedido(rota.id, pedidoId)
    await updatePedido(pedidoId, { status: 'NF_EMITIDA' })
    await load(); onSaved(); setSaving(false)
  }

  const toggle = id => setSelecionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const adicionar = async () => {
    if (!selecionados.size) return
    setSaving(true)
    await addRotaPedidos(rota.id, [...selecionados])
    for (const id of selecionados) await updatePedido(id, { status: 'EM_ROTA' })
    setSelecionados(new Set()); await load(); onSaved(); setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, overflowY: 'auto', padding: '16px 12px' }}>
      <div style={{ ...card, maxWidth: 640, margin: '20px auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✏️ Editar Rota</h3>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{vIcon(rota.veiculo)} {rota.cidades?.length > 0 ? rota.cidades.join(', ') : rota.cidade} · {rota.motorista_nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
          Pedidos na Rota ({pedidosNaRota.length})
        </div>
        {pedidosNaRota.length === 0 && <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>Nenhum pedido nessa rota</div>}
        {pedidosNaRota.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ background: '#F1F5F9', color: '#64748B', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>{getRef(p)}</span>
            <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', fontSize: 13 }}>{p.cliente}</span>
            <Badge status={p.status} />
            <button onClick={() => remover(p.id)} disabled={saving} style={{ ...btnSmall, fontSize: 11, padding: '3px 8px', color: '#EF4444' }}>✗ Remover</button>
          </div>
        ))}

        {pedidosDisponiveis.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>
              Adicionar à Rota · NF Emitidas em {rotaCidades.join(', ')}
            </div>
            {pedidosDisponiveis.map(p => (
              <div key={p.id} onClick={() => toggle(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
                <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => toggle(p.id)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{getRef(p)}</span>
                <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', fontSize: 13 }}>{p.cliente}</span>
              </div>
            ))}
            <button onClick={adicionar} disabled={saving || !selecionados.size} style={{ ...btnPrimary, width: '100%', marginTop: 14, opacity: saving || !selecionados.size ? 0.5 : 1 }}>
              {saving ? 'Salvando...' : `+ Adicionar (${selecionados.size})`}
            </button>
          </div>
        )}
        {pedidosDisponiveis.length === 0 && <div style={{ marginTop: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>Nenhum pedido com NF emitida disponível em {rotaCidades.join(', ')}</div>}
      </div>
    </div>
  )
}
