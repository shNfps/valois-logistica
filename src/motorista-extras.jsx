import { useState } from 'react'
import { fmt, btnPrimary, btnSmall, card, addHistorico, VEICULOS } from './db.js'
import { aceitarRota, recusarRota, enriquecerComEnderecos, labelVeiculo } from './roteiro-db.js'
import { gerarRoteiroPdf } from './roteiro-pdf.js'
import { criarNotificacao } from './notificacoes.js'
import { RefBadge } from './components.jsx'
import { ObsComercialInline, isUrgente } from './obs-comercial.jsx'

const vIcon = v => VEICULOS.find(x => x.key === v)?.icon || '🚐'

// ─── ROTA CARD (rota ativa do motorista, com pedidos, próxima parada e navegação) ───
export function RotaCard({ rota, pedidosRota, onAssinar, onVerPedido, onFechar }) {
  const [expanded, setExpanded] = useState(true)
  const fin = rota.status === 'finalizada'
  const ordemIdx = (id) => { const i = (rota.ordem_pedidos || []).indexOf(id); return i < 0 ? 9999 : i }
  const ordenados = [...pedidosRota].sort((a, b) => ordemIdx(a.id) - ordemIdx(b.id))
  // Mostra qualquer pedido vinculado e não-entregue como "em rota" — tolera status divergente
  // (ex.: NF_EMITIDA sem promoção pra EM_ROTA) pra não esconder pedidos do motorista.
  const entregues = ordenados.filter(p => p.status === 'ENTREGUE')
  const emRota = ordenados.filter(p => p.status !== 'ENTREGUE')
  const total = pedidosRota.length; const ec = entregues.length
  const proxima = emRota[0]
  return (
    <div style={{ borderRadius: 14, marginBottom: 16, overflow: 'hidden', border: `1px solid ${fin ? '#A7F3D0' : '#1E293B'}` }}>
      <style>{`@keyframes truck-move{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}@keyframes blink-red{0%,100%{opacity:1}50%{opacity:0.15}}`}</style>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '14px 18px', background: fin ? '#D1FAE5' : '#0A1628', color: fin ? '#065F46' : '#fff', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, display: 'inline-block', animation: fin ? 'none' : 'truck-move 1.2s ease-in-out infinite' }}>{fin ? '✅' : vIcon(rota.veiculo)}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>{fin ? 'ROTA FINALIZADA' : 'ROTA ATIVA'}</div>
              <div style={{ fontSize: 12, color: fin ? '#059669' : '#94A3B8' }}>{rota.cidades?.length > 0 ? rota.cidades.join(', ') : rota.cidade} · {vIcon(rota.veiculo)} · {rota.motorista_nome}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!fin && <><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', display: 'inline-block', animation: 'blink-red 1s infinite' }} /><span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', letterSpacing: 1 }}>AO VIVO</span></>}
            {fin && onFechar && <button onClick={e => { e.stopPropagation(); onFechar() }} style={{ ...btnSmall, background: '#10B981', color: '#fff', border: 'none', fontSize: 11 }}>Fechar</button>}
            <span style={{ fontSize: 13, opacity: 0.6, color: fin ? '#065F46' : '#fff' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>
        <div style={{ background: fin ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: fin ? '#059669' : '#CBD5E1' }}>Entregas realizadas</span>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{ec} <span style={{ fontWeight: 400, fontSize: 12, color: fin ? '#059669' : '#94A3B8' }}>de {total}</span></span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!fin && proxima && (
            <div style={{ background: 'linear-gradient(90deg,#FEF3C7,#FFFBEB)', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#92400E', letterSpacing: 1, textTransform: 'uppercase' }}>Próxima parada</div>
                <div style={{ fontWeight: 800, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proxima.cliente}{proxima.cidade ? ` · ${proxima.cidade}` : ''}</div>
              </div>
            </div>
          )}
          {emRota.length === 0 && entregues.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8', fontSize: 13 }}>Nenhum pedido nesta rota</div>}
          {emRota.length === 0 && entregues.length > 0 && <div style={{ textAlign: 'center', padding: 10, color: '#059669', fontWeight: 600, fontSize: 13 }}>Todos os pedidos foram entregues ✅</div>}
          {emRota.map((p, i) => {
            const isNext = i === 0
            const urg = isUrgente(p.obs_comercial)
            const border = urg ? '4px solid #DC2626' : isNext ? '4px solid #F59E0B' : '3px solid #3B82F6'
            const bg = urg ? '#FEF2F2' : isNext ? '#FFFBEB' : '#F8FAFC'
            return (
              <div key={p.id} style={{ borderLeft: border, borderRadius: 8, padding: '10px 12px', background: bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }} onClick={() => onVerPedido(p.id)}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: isNext ? '#F59E0B' : '#475569', color: '#fff', fontWeight: 800, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <RefBadge pedido={p}/><span style={{ fontWeight: 700, color: '#0A1628', flex: 1 }}>{p.cliente}</span>
                  {p.cidade && <span style={{ fontSize: 11, color: '#94A3B8' }}>📍{p.cidade}</span>}
                </div>
                {p.obs_comercial && <div style={{ marginBottom: 8 }}><ObsComercialInline texto={p.obs_comercial}/></div>}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <a href={wazeUrl(p)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ ...btnSmall, flex: 1, justifyContent: 'center', textDecoration: 'none', color: '#1D4ED8', borderColor: '#BFDBFE', fontWeight: 700 }}>🧭 Waze</a>
                  <a href={gmapsUrl(p)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ ...btnSmall, flex: 1, justifyContent: 'center', textDecoration: 'none', color: '#059669', borderColor: '#A7F3D0', fontWeight: 700 }}>📍 Maps</a>
                </div>
                <button onClick={() => onAssinar(p.id)} style={{ ...btnPrimary, background: '#059669', padding: '8px 14px', fontSize: 13, width: '100%' }}>✍ Coletar Assinatura</button>
              </div>
            )
          })}
          {entregues.map(p => (
            <div key={p.id} style={{ borderLeft: '3px solid #10B981', borderRadius: 8, padding: '10px 12px', background: '#F0FDF4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefBadge pedido={p}/><span style={{ fontWeight: 700, color: '#0A1628', flex: 1 }}>{p.cliente}</span>
                {p.cidade && <span style={{ fontSize: 11, color: '#94A3B8' }}>📍{p.cidade}</span>}
                <span>✅</span>
              </div>
              {p.entrega_cpf && <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>CPF: {p.entrega_cpf} · {fmt(p.entrega_data)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const pendenteKeyframes = `@keyframes pend-pulse{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.45)}50%{box-shadow:0 0 0 10px rgba(59,130,246,0)}}`

// URL pra navegação via Waze / Google Maps. Usa coords se disponíveis, senão texto.
export function gmapsUrl(pedido) {
  const q = encodeURIComponent(`${pedido.cliente || ''} ${pedido.cidade || ''}`.trim())
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}
export function wazeUrl(pedido) {
  const q = encodeURIComponent(`${pedido.cliente || ''} ${pedido.cidade || ''}`.trim())
  return `https://waze.com/ul?q=${q}&navigate=yes`
}

// Resumo do dia do motorista: entregas hoje + rota ativa.
export function ResumoRapidoMotorista({ pedidos, user, rotaAtiva, pedidosRotaAtiva = [] }) {
  const hoje = new Date(); const today0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const entreguesHoje = pedidos.filter(p => p.status === 'ENTREGUE' && p.entregue_por === user.nome && p.entrega_data && new Date(p.entrega_data) >= today0).length
  const totalRota = pedidosRotaAtiva.length
  const restamRota = pedidosRotaAtiva.filter(p => p.status === 'EM_ROTA').length
  return (
    <div style={{ ...card, padding: '12px 16px', marginBottom: 14, background: 'linear-gradient(135deg,#0A1628,#1E293B)', color: '#fff', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', border: 'none' }}>
      <Stat icon="📦" label="Entregas hoje" valor={entreguesHoje} />
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
      <Stat icon="🚛" label="Rota ativa" valor={rotaAtiva ? `${totalRota - restamRota}/${totalRota}` : '—'} />
      <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
      <Stat icon="📍" label="Restam" valor={rotaAtiva ? restamRota : '—'} />
    </div>
  )
}

function Stat({ icon, label, valor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 0.5 }}>{icon} {label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{valor}</div>
    </div>
  )
}

// Card de rota pendente — comercial criou, motorista precisa aceitar.
export function PendenteCard({ rota, pedidosRota, user, onAceito, onRecusado }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const cidades = rota.cidades?.length ? rota.cidades : [rota.cidade].filter(Boolean)
  const aceitar = async () => {
    setSaving(true)
    await aceitarRota(rota.id)
    await addHistorico(pedidosRota[0]?.id || rota.id, user.nome, `Aceitou roteiro ${rota.numero_roteiro || ''}`)
    if (rota.criado_por) await criarNotificacao('comercial', `✅ ${user.nome} aceitou o roteiro ${rota.numero_roteiro || ''}`, `${pedidosRota.length} entregas · ${cidades.join(', ')}`, null)
    setSaving(false); onAceito?.()
  }
  const baixarPdf = async () => {
    const enriquecidos = await enriquecerComEnderecos(pedidosRota)
    gerarRoteiroPdf({ roteiro: rota, pedidos: enriquecidos, criadoPor: rota.criado_por || user.nome })
  }
  return (
    <div style={{ borderRadius: 14, marginBottom: 14, overflow: 'hidden', border: '2px solid #3B82F6', background: '#EFF6FF', animation: 'pend-pulse 1.8s ease-in-out infinite' }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', letterSpacing: 1, textTransform: 'uppercase' }}>📋 Rota Pendente</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0A1628', marginTop: 2 }}>{rota.numero_roteiro || `Rota ${rota.id.slice(0, 8)}`}</div>
          </div>
          <div style={{ fontSize: 12, color: '#1E40AF', textAlign: 'right' }}>
            <div>{rota.data_roteiro ? fmtData(rota.data_roteiro) : fmt(rota.criado_em)}</div>
            <div style={{ fontWeight: 700 }}>{labelVeiculo(rota.veiculo)}{rota.placa ? ` · ${rota.placa}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {cidades.map(c => <span key={c} style={{ background: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: 11, padding: '3px 9px', borderRadius: 999 }}>📍 {c}</span>)}
          <span style={{ background: '#fff', color: '#1D4ED8', fontWeight: 800, fontSize: 11, padding: '3px 9px', borderRadius: 999, border: '1px solid #BFDBFE' }}>📦 {pedidosRota.length} parada(s)</span>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ ...btnSmall, fontSize: 12, padding: '6px 12px', color: '#1D4ED8', borderColor: '#BFDBFE', marginBottom: 10 }}>{open ? 'Ocultar' : 'Ver detalhes'}</button>
        {open && (
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #DBEAFE', padding: '4px 0', marginBottom: 10, maxHeight: 240, overflowY: 'auto' }}>
            {pedidosRota.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontWeight: 700, color: '#0A1628', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente}</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>📍 {p.cidade}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          <button onClick={aceitar} disabled={saving} style={{ ...btnPrimary, background: '#10B981', fontSize: 13, padding: '12px 8px', opacity: saving ? 0.6 : 1 }}>✅ Aceitar</button>
          <button onClick={baixarPdf} style={{ ...btnPrimary, background: '#7C3AED', fontSize: 13, padding: '12px 8px' }}>📄 PDF</button>
          <button onClick={() => setRecusando(true)} disabled={saving} style={{ ...btnPrimary, background: '#EF4444', fontSize: 13, padding: '12px 8px', opacity: saving ? 0.6 : 1 }}>❌ Recusar</button>
        </div>
      </div>
      {recusando && <RecusarModal rota={rota} user={user} onClose={() => setRecusando(false)} onRecusado={onRecusado} />}
    </div>
  )
}

function fmtData(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

function RecusarModal({ rota, user, onClose, onRecusado }) {
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)
  const confirmar = async () => {
    if (!motivo.trim()) { alert('Informe o motivo da recusa'); return }
    setSaving(true)
    await recusarRota(rota.id, motivo.trim())
    await criarNotificacao('comercial', `❌ ${user.nome} recusou o roteiro ${rota.numero_roteiro || ''}`, `Motivo: ${motivo.trim()}`, null)
    await criarNotificacao('admin', `❌ Roteiro ${rota.numero_roteiro || ''} recusado por ${user.nome}`, `Motivo: ${motivo.trim()}`, null)
    setSaving(false); onClose(); onRecusado?.()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9999 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 380 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#991B1B' }}>❌ Recusar roteiro</h3>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>Informe o motivo da recusa — os pedidos voltarão para a fila de roteirização e o comercial será notificado.</p>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex.: veículo em manutenção, dia indisponível..." rows={4} style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} disabled={saving} style={{ ...btnSmall, flex: 1, justifyContent: 'center', padding: 10 }}>Cancelar</button>
          <button onClick={confirmar} disabled={saving} style={{ ...btnPrimary, flex: 2, background: '#EF4444', opacity: saving ? 0.6 : 1 }}>{saving ? 'Recusando...' : 'Confirmar recusa'}</button>
        </div>
      </div>
    </div>
  )
}
