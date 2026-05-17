import { useState, useEffect, useMemo } from 'react'
import { card, btnPrimary, btnSmall, ROTA_ORDEM, fetchClientes } from './db.js'
import { RefBadge } from './components.jsx'
import { ObsComercialInline, isUrgente } from './obs-comercial.jsx'
import { ORIGEM_VALOIS, otimizarRotaGoogle, otimizarLocal, fmtDuracao, labelVeiculo } from './roteiro-db.js'

// ─── PASSO 2: Selecionar pedidos ───
export function PassoSelecionarPedidos({ pedidos, selecionados, setSelecionados, onOtimizado, onVoltar, onProximo }) {
  const [cidadeFiltro, setCidadeFiltro] = useState(new Set())
  const [clientes, setClientes] = useState([])
  const [otimizando, setOtimizando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => { fetchClientes().then(setClientes) }, [])

  const cidades = useMemo(() => [...new Set(pedidos.map(p => p.cidade).filter(Boolean))]
    .sort((a, b) => (ROTA_ORDEM[a] ?? 99) - (ROTA_ORDEM[b] ?? 99)), [pedidos])

  const filtrados = pedidos.filter(p => cidadeFiltro.size === 0 || cidadeFiltro.has(p.cidade))

  const toggleCidade = (c) => setCidadeFiltro(prev => { const s = new Set(prev); s.has(c) ? s.delete(c) : s.add(c); return s })
  const toggle = (id) => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const coordsDoPedido = (p) => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    if (c?.latitude && c?.longitude) return { lat: Number(c.latitude), lng: Number(c.longitude), pedidoId: p.id }
    return null
  }

  const otimizar = async () => {
    if (selecionados.length === 0) return alert('Selecione pedidos primeiro')
    setOtimizando(true); setAviso('')
    const pedidosSel = selecionados.map(id => pedidos.find(p => p.id === id)).filter(Boolean)
    const pontos = pedidosSel.map(coordsDoPedido).filter(Boolean)
    if (pontos.length === 0) {
      setAviso('⚠️ Nenhum cliente com coordenadas — mantida ordem atual.')
      setOtimizando(false); return
    }
    let r = await otimizarRotaGoogle(pontos, ORIGEM_VALOIS)
    if (!r) {
      r = otimizarLocal(pontos, ORIGEM_VALOIS)
      setAviso('⚠️ Google Directions indisponível — usado cálculo local (nearest-neighbor).')
    } else {
      setAviso('✅ Ordem otimizada via Google Maps.')
    }
    // Reordena seleção: primeiro os com coords (ordem otimizada) depois os sem coords mantendo ordem original
    const semCoords = pedidosSel.filter(p => !coordsDoPedido(p)).map(p => p.id)
    setSelecionados([...r.ordem, ...semCoords])
    onOtimizado({ distanciaKm: r.distanciaKm, duracaoMin: r.duracaoMin })
    setOtimizando(false)
  }

  return (
    <div style={{ ...card, padding: 22 }}>
      <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0A1628' }}>2. Selecionar pedidos</h4>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Filtrar por cidade</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {cidades.map(c => {
          const active = cidadeFiltro.has(c)
          const count = pedidos.filter(p => p.cidade === c).length
          return <button key={c} type="button" onClick={() => toggleCidade(c)}
            style={{ padding: '5px 12px', borderRadius: 999, border: `2px solid ${active ? '#3B82F6' : '#E2E8F0'}`, background: active ? '#EFF6FF' : '#fff', color: active ? '#1D4ED8' : '#64748B', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            📍 {c} <span style={{ opacity: 0.7, fontSize: 11 }}>({count})</span>
          </button>
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>{selecionados.length} pedido(s) selecionado(s)</div>
        <button type="button" onClick={otimizar} disabled={otimizando} style={{ ...btnSmall, color: '#7C3AED', borderColor: '#DDD6FE', opacity: otimizando ? 0.5 : 1 }}>
          {otimizando ? 'Otimizando...' : '🧭 Otimizar ordem'}
        </button>
      </div>
      {aviso && <div style={{ fontSize: 12, padding: '6px 10px', background: '#F0F9FF', color: '#0369A1', borderRadius: 8, marginBottom: 8 }}>{aviso}</div>}
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        {filtrados.length === 0 && <div style={{ padding: 20, color: '#94A3B8', textAlign: 'center', fontSize: 13 }}>Nenhum pedido disponível com NF emitida</div>}
        {filtrados.map(p => {
          const checked = selecionados.includes(p.id)
          return (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: checked ? '#F0F9FF' : '#fff' }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <RefBadge pedido={p} />
              <span style={{ flex: 1, fontWeight: 600, color: '#0A1628', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</span>
              <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>📍 {p.cidade}</span>
              {p.obs_comercial && <span style={{ fontSize: 11, color: isUrgente(p.obs_comercial) ? '#B91C1C' : '#92400E', fontWeight: 600 }}>📢</span>}
            </label>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onVoltar} style={{ ...btnSmall, flex: 1, justifyContent: 'center', padding: '12px' }}>← Voltar</button>
        <button onClick={onProximo} disabled={selecionados.length === 0} style={{ ...btnPrimary, flex: 2, opacity: selecionados.length === 0 ? 0.5 : 1 }}>Próximo →</button>
      </div>
    </div>
  )
}

// ─── PASSO 3: Confirmação ───
export function PassoConfirmacao({ form, selecionados, pedidos, otimizado, saving, onVoltar, onSalvarRascunho, onGerarPdf, onConfirmarRota }) {
  const pedidosOrdenados = selecionados.map(id => pedidos.find(p => p.id === id)).filter(Boolean)
  const cidades = [...new Set(pedidosOrdenados.map(p => p.cidade).filter(Boolean))]
  const fmtData = (iso) => { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
  return (
    <div style={{ ...card, padding: 22 }}>
      <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0A1628' }}>3. Confirmação</h4>
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
        <div><b style={{ color: '#64748B', fontSize: 11 }}>DATA</b><div style={{ color: '#0A1628', fontWeight: 700 }}>{fmtData(form.data)}</div></div>
        <div><b style={{ color: '#64748B', fontSize: 11 }}>MOTORISTA</b><div style={{ color: '#0A1628', fontWeight: 700 }}>{form.motorista}</div></div>
        <div><b style={{ color: '#64748B', fontSize: 11 }}>VEÍCULO</b><div style={{ color: '#0A1628' }}>{labelVeiculo(form.veiculo)}</div></div>
        <div><b style={{ color: '#64748B', fontSize: 11 }}>PLACA</b><div style={{ color: '#0A1628' }}>{form.placa || '—'}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '3px solid #3B82F6', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>📦 Paradas</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>{pedidosOrdenados.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '3px solid #10B981', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>📏 Distância</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>{otimizado.distanciaKm ? otimizado.distanciaKm.toFixed(1) + ' km' : '—'}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: '3px solid #F59E0B', padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>⏱️ Tempo</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0A1628' }}>{fmtDuracao(otimizado.duracaoMin)}</div>
        </div>
      </div>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        {pedidosOrdenados.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#0A1628', color: '#fff', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <RefBadge pedido={p} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: '#0A1628', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>📍 {p.cidade}</div>
              {p.obs_comercial && <div style={{ marginTop: 4 }}><ObsComercialInline texto={p.obs_comercial} /></div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>Cidades: {cidades.join(' · ')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <button onClick={onSalvarRascunho} disabled={saving} style={{ ...btnSmall, justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>💾 Rascunho</button>
        <button onClick={onGerarPdf} disabled={saving} style={{ ...btnPrimary, background: '#7C3AED', opacity: saving ? 0.5 : 1 }}>🖨️ Gerar PDF</button>
        <button onClick={onConfirmarRota} disabled={saving} style={{ ...btnPrimary, background: '#10B981', opacity: saving ? 0.5 : 1 }}>🚛 Confirmar</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={onVoltar} style={{ ...btnSmall, width: '100%', justifyContent: 'center', padding: '10px' }}>← Voltar</button>
      </div>
    </div>
  )
}
