import { useState } from 'react'
import { fmtMoney } from './db.js'

const FRASES = [
  'Hoje é dia de fazer acontecer! 💪',
  'Cada pedido te aproxima da meta! 🚀',
  'Você está no caminho certo! ⭐',
  'Foco e determinação! O resultado vem! 🎯',
  'Vamos com tudo hoje! 🔥',
  'Sua dedicação faz a diferença! 💎',
  'Mais um dia para brilhar! ✨',
  'A meta está ao seu alcance! 🏆',
  'Bora vender! O sucesso espera por você! 🌟',
  'Você é capaz de grandes conquistas! 👑',
]

const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }

export const semanaKey = () => {
  const d = new Date(); const jan = new Date(d.getFullYear(), 0, 1)
  const w = Math.ceil(((d - jan) / 86400000 + jan.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${w}`
}

export const mesKey = () => {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function BarraMeta({ atual, meta, label }) {
  const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0
  const cor = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444'
  const falta = Math.max(0, meta - atual)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{label}: {fmtMoney(atual)} / {fmtMoney(meta)}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: cor }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 14, borderRadius: 8, background: '#F1F5F9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: cor, borderRadius: 8, transition: 'width 0.9s ease' }} />
      </div>
      {falta > 0 && <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>Faltam {fmtMoney(falta)} para a meta</div>}
      {pct >= 100 && <div style={{ fontSize: 11, color: '#059669', marginTop: 3, fontWeight: 700 }}>🎉 Meta atingida!</div>}
    </div>
  )
}

// ─── POPUP META DIA ───
export function PopupMetaDia({ user, pedidos, metas, clientes, onClose }) {
  const frase = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)])[0]

  const mv = pedidos.filter(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    return c?.vendedor_nome === user.nome
  }).filter(p => ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE'].includes(p.status))

  const now = new Date()
  const semIni = new Date(now); semIni.setDate(now.getDate() - now.getDay()); semIni.setHours(0, 0, 0, 0)
  const semFim = new Date(semIni); semFim.setDate(semIni.getDate() + 6); semFim.setHours(23, 59, 59)
  const mesIni = new Date(now.getFullYear(), now.getMonth(), 1)

  const tS = mv.filter(p => { const d = new Date(p.criado_em); return d >= semIni && d <= semFim }).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const tM = mv.filter(p => new Date(p.criado_em) >= mesIni).reduce((s, p) => s + (Number(p.valor_total) || 0), 0)
  const mS = metas.find(m => m.tipo === 'semanal' && (!m.vendedor_nome || m.vendedor_nome === user.nome))
  const mM = metas.find(m => m.tipo === 'mensal' && (!m.vendedor_nome || m.vendedor_nome === user.nome))
  const primeiro = user.nome.split(' ')[0]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.82)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 380, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>{new Date().getHours() < 12 ? '☀️' : new Date().getHours() < 18 ? '🌤️' : '🌙'}</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0A1628' }}>{saudacao()}, {primeiro}!</h2>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748B', fontStyle: 'italic' }}>{frase}</p>
        </div>

        {(mS || mM) ? (
          <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 }}>🎯 Suas Metas</div>
            {mS && <BarraMeta atual={tS} meta={Number(mS.valor_meta)} label="Semanal" />}
            {mM && <BarraMeta atual={tM} meta={Number(mM.valor_meta)} label="Mensal" />}
          </div>
        ) : (
          <div style={{ background: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13, color: '#92400E', textAlign: 'center' }}>
            ⏳ Nenhuma meta definida ainda — fale com o admin!
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#0A1628,#1E40AF)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.5 }}>
          Bora! 🚀
        </button>
      </div>
    </div>
  )
}

// ─── CONFETES META BATIDA ───
const CORES = ['#FFD700', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4']

export function ConfetesMetaBatida({ tipo, valor, nomeVendedor, onClose }) {
  const [confetes] = useState(() => Array.from({ length: 65 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.8,
    dur: 2.8 + Math.random() * 2,
    size: 8 + Math.random() * 8,
    cor: CORES[Math.floor(Math.random() * CORES.length)],
    rot: Math.random() * 360,
    circle: Math.random() > 0.5,
  })))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600 }}>
      <style>{`
        @keyframes cair{0%{transform:translateY(-30px) rotate(0deg);opacity:1}80%{opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes pulsar-card{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
      `}</style>
      {confetes.map(c => (
        <div key={c.id} style={{
          position: 'fixed', left: `${c.x}%`, top: -30, width: c.size, height: c.size,
          background: c.cor, borderRadius: c.circle ? '50%' : 3,
          animation: `cair ${c.dur}s ${c.delay}s ease-in forwards`,
          transform: `rotate(${c.rot}deg)`, pointerEvents: 'none',
        }} />
      ))}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,40,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        onClick={onClose}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.45)', animation: 'pulsar-card 1.6s ease infinite' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 52, marginBottom: 6 }}>🎉</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#0A1628', textTransform: 'uppercase', letterSpacing: 1 }}>Meta Batida!</h2>
          <div style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}>Parabéns, {nomeVendedor}! Você atingiu a meta {tipo}!</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#059669', marginBottom: 24 }}>{fmtMoney(valor)}</div>
          <button onClick={onClose} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#059669,#10B981)', color: '#fff', fontSize: 16, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            Obrigado! 🏆
          </button>
        </div>
      </div>
    </div>
  )
}
