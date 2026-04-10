import { useState } from 'react'
import { CIDADES, VEICULOS, ROTA_ORDEM, card, btnPrimary, btnSmall, updatePedido, addHistorico, createRota, addRotaPedidos } from './db.js'
import { RefBadge } from './components.jsx'

const vIcon = v => VEICULOS.find(x => x.key === v)?.icon || '🚐'

// ─── MONTAR ROTA SCREEN ───
export function MontarRotaScreen({ pedidos, user, onRotaCriada, onCancel }) {
  const [cidades, setCidades] = useState(new Set())
  const [veiculo, setVeiculo] = useState('')
  const [selecionados, setSelecionados] = useState(new Set())
  const [saving, setSaving] = useState(false)

  const toggleCidade = (c) => {
    const next = new Set(cidades)
    if (next.has(c)) {
      next.delete(c)
      setSelecionados(prev => { const s = new Set(prev); pedidos.filter(p => p.cidade === c).forEach(p => s.delete(p.id)); return s })
    } else { next.add(c) }
    setCidades(next)
  }
  const toggle = id => setSelecionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const iniciar = async () => {
    if (cidades.size === 0) { alert('Selecione ao menos 1 cidade'); return }
    if (!veiculo) { alert('Selecione o veículo'); return }
    if (selecionados.size === 0) { alert('Selecione ao menos 1 pedido'); return }
    setSaving(true)
    const cidadesArr = [...cidades].sort((a, b) => (ROTA_ORDEM[a] ?? 99) - (ROTA_ORDEM[b] ?? 99))
    const rota = await createRota(user.nome, cidadesArr[0], veiculo, cidadesArr)
    if (!rota) { setSaving(false); return }
    await addRotaPedidos(rota.id, [...selecionados])
    for (const id of selecionados) {
      const p = pedidos.find(x => x.id === id)
      await updatePedido(id, { status: 'EM_ROTA', entregue_por: user.nome })
      await addHistorico(id, user.nome, 'Iniciou rota — ' + (p?.cidade || cidadesArr.join(', ')))
    }
    setSaving(false); onRotaCriada(rota, [...selecionados])
  }

  const cidadesOrdenadas = [...cidades].sort((a, b) => (ROTA_ORDEM[a] ?? 99) - (ROTA_ORDEM[b] ?? 99))

  return (
    <div>
      <button onClick={onCancel} style={{ ...btnSmall, marginBottom: 16 }}>← Voltar</button>
      <div style={{ ...card, padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#0A1628' }}>🗺️ Montar Rota</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>Cidades</label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {CIDADES.map(c => {
            const active = cidades.has(c)
            const count = pedidos.filter(p => p.cidade === c && p.status === 'NF_EMITIDA').length
            return (
              <button key={c} onClick={() => toggleCidade(c)} style={{ padding: '7px 12px', borderRadius: 10, border: `2px solid ${active ? '#3B82F6' : '#E2E8F0'}`, background: active ? '#EFF6FF' : '#fff', color: active ? '#1D4ED8' : count > 0 ? '#334155' : '#94A3B8', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {c}{count > 0 && <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>({count})</span>}
              </button>
            )
          })}
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 8 }}>Veículo</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {VEICULOS.map(v => (
            <button key={v.key} onClick={() => setVeiculo(v.key)} style={{ padding: '10px 16px', borderRadius: 10, border: `2px solid ${veiculo === v.key ? '#3B82F6' : '#E2E8F0'}`, background: veiculo === v.key ? '#EFF6FF' : '#fff', color: veiculo === v.key ? '#1D4ED8' : '#64748B', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        {cidadesOrdenadas.map(cidade => {
          const disponiveis = pedidos.filter(p => p.cidade === cidade && p.status === 'NF_EMITIDA')
          return (
            <div key={cidade} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#334155', background: '#F1F5F9', padding: '7px 12px', borderRadius: 8, marginBottom: 6 }}>
                📍 {cidade} · {disponiveis.length} pedido{disponiveis.length !== 1 ? 's' : ''} disponível{disponiveis.length !== 1 ? 'is' : ''}
              </div>
              {disponiveis.length === 0
                ? <div style={{ fontSize: 12, color: '#94A3B8', padding: '6px 12px' }}>Nenhum pedido com NF emitida nessa cidade</div>
                : disponiveis.map(p => (
                  <div key={p.id} onClick={() => toggle(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selecionados.has(p.id)} onChange={() => toggle(p.id)} onClick={e => e.stopPropagation()} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <RefBadge pedido={p}/>
                    <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', fontSize: 14 }}>{p.cliente}</span>
                  </div>
                ))}
            </div>
          )
        })}
        <button onClick={iniciar} disabled={saving || selecionados.size === 0} style={{ ...btnPrimary, width: '100%', marginTop: 10, opacity: saving || selecionados.size === 0 ? 0.5 : 1 }}>
          {saving ? 'Iniciando...' : `🚀 Iniciar Rota (${selecionados.size} pedido${selecionados.size !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}
