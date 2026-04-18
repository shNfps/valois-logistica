import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ELOS, getElo } from './performance-rank.jsx'

const DICAS = {
  bronze: 'Crie pedidos consistentemente para subir para Prata! 💪',
  prata: 'Melhore sua taxa de aprovação para ganhar pontos bônus! ⭐',
  ouro: 'Você está indo muito bem! Continue assim para Platina! 🏆',
  platina: 'Incrível! Poucos chegam aqui. Rubi aguarda! 💎',
  rubi: 'Lendário! Você está entre os melhores. Diamante aguarda! 🔥',
  diamante: 'Você é uma LENDA do time! 👑',
}

const JORNADA_CSS = `
@keyframes jornada-in{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
@keyframes elo-glow{0%,100%{box-shadow:0 0 20px var(--gc,rgba(0,0,0,0.2))}50%{box-shadow:0 0 35px var(--gc,rgba(0,0,0,0.4))}}
@keyframes shimmer-dia{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes pulse-arrow{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
@keyframes float-p{0%,100%{transform:translateY(0);opacity:0.6}50%{transform:translateY(-10px);opacity:1}}
@keyframes prog-fill{from{width:0}}
`

function DiamondParticles() {
  return <>
    {[0,1,2,3,4].map(i => (
      <span key={i} style={{ position:'absolute', fontSize:8, animation:`float-p ${1.5+i*0.3}s ease-in-out infinite`, top:`${10+i*15}%`, left:`${15+i*16}%`, pointerEvents:'none' }}>✦</span>
    ))}
  </>
}

function EloTrailCard({ elo, status, pontos, idx }) {
  const isDiamond = elo.id === 'diamante'
  const isCurrent = status === 'current'
  const isPast = status === 'past'
  const isFuture = status === 'future'
  const next = ELOS[idx + 1]
  const size = isCurrent ? 64 : isDiamond && isFuture ? 56 : 42
  const pct = isCurrent && next ? Math.min(((pontos - elo.min) / (next.min - elo.min)) * 100, 100) : isCurrent ? 100 : 0
  const faltam = isCurrent && next ? next.min - pontos : 0

  const diamondBg = isDiamond ? 'linear-gradient(135deg,#7C3AED,#06B6D4,#8B5CF6,#06B6D4)' : undefined
  const cardBg = isCurrent
    ? `linear-gradient(135deg,${elo.gradFrom}20,${elo.gradTo}35)`
    : isPast ? '#F8FAFC' : '#FAFAFA'

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14, padding:isCurrent?'16px 14px':'10px 14px',
      borderRadius:16, background:cardBg, position:'relative', overflow:'hidden',
      border:isCurrent?`3px solid ${elo.color}`:'1px solid #E2E8F0',
      borderLeft:isPast?`4px solid ${elo.color}`:'',
      transform:isCurrent?'scale(1.03)':'scale(1)',
      opacity:isFuture?0.5:isPast?0.75:1,
      transition:'all 0.3s ease',
      ...(isCurrent?{animation:'elo-glow 2s ease-in-out infinite','--gc':`${elo.color}55`}:{}),
    }}>
      {/* Emblema */}
      <div style={{
        width:size, height:size, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:isCurrent?36:isDiamond&&isFuture?30:22, flexShrink:0, position:'relative',
        background:isFuture&&!isDiamond?'#E2E8F0':isDiamond?diamondBg:`linear-gradient(135deg,${elo.gradFrom},${elo.gradTo})`,
        backgroundSize:isDiamond?'300% 300%':'auto',
        animation:isDiamond?'shimmer-dia 4s ease infinite':'none',
        filter:isFuture&&!isDiamond?'grayscale(0.7)':'none',
        boxShadow:isCurrent?`0 4px 16px ${elo.color}44`:'0 2px 6px rgba(0,0,0,0.08)',
      }}>
        {elo.emoji}
        {isFuture && !isDiamond && <span style={{ position:'absolute', fontSize:14 }}>🔒</span>}
        {isPast && <span style={{ position:'absolute', top:-2, right:-2, background:'#10B981', color:'#fff', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>✓</span>}
      </div>
      {isDiamond && <DiamondParticles />}

      {/* Info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:isCurrent?16:14, fontWeight:700, color:isFuture?'#94A3B8':elo.color }}>{elo.label}</span>
          {isCurrent && <span style={{ fontSize:9, fontWeight:800, padding:'2px 8px', borderRadius:6, color:'#fff', background:'linear-gradient(90deg,#F59E0B,#FBBF24)', letterSpacing:0.5, whiteSpace:'nowrap' }}>VOCÊ ESTÁ AQUI</span>}
          {isPast && <span style={{ fontSize:10, fontWeight:600, color:'#10B981' }}>Conquistado</span>}
          {isDiamond && !isFuture && <span style={{ fontSize:10, fontWeight:700, color:'#7C3AED' }}>LENDÁRIO</span>}
          {isDiamond && isPast && <span style={{ fontSize:10 }}>👑</span>}
        </div>
        <div style={{ fontSize:11, color:'#94A3B8', marginTop:2 }}>
          {isCurrent && next ? `${pontos.toLocaleString('pt-BR')} / ${next.min.toLocaleString('pt-BR')} pts` : isCurrent ? `${pontos.toLocaleString('pt-BR')} pts · Rank máximo!` : `${elo.min.toLocaleString('pt-BR')} pts`}
        </div>
        {isCurrent && next && (
          <div style={{ marginTop:6 }}>
            <div style={{ height:14, borderRadius:7, background:'#E2E8F0', overflow:'hidden', position:'relative' }}>
              <div style={{ height:'100%', width:`${pct}%`, borderRadius:7, background:`linear-gradient(90deg,${elo.gradFrom},${next.gradFrom})`, animation:'prog-fill 1.5s ease', transition:'width 1s ease' }} />
            </div>
            <div style={{ fontSize:10, color:'#64748B', marginTop:3 }}>Faltam <strong>{faltam.toLocaleString('pt-BR')}</strong> pts para {next.label}</div>
          </div>
        )}
      </div>
      {isCurrent && <span style={{ fontSize:18, animation:'pulse-arrow 1.2s ease-in-out infinite', color:elo.color, flexShrink:0 }}>➤</span>}
    </div>
  )
}

export function EloJornadaPanel({ pontos, onClose }) {
  const elo = getElo(pontos)
  const eloIdx = ELOS.indexOf(elo)
  const [show, setShow] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])

  const trail = [...ELOS].map((e, i) => ({
    elo: e, idx: i,
    status: i < eloIdx ? 'past' : i === eloIdx ? 'current' : 'future',
  })).reverse()

  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <style>{JORNADA_CSS}</style>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:380, maxHeight:'90vh', overflowY:'auto', padding:28, borderRadius:24,
        background:'#fff', boxShadow:'0 24px 80px rgba(0,0,0,0.2)',
        animation:show?'jornada-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards':'none',
        opacity:show?1:0,
      }}>
        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#0A1628', marginBottom:2 }}>Sua Jornada</div>
          <div style={{ fontSize:12, color:'#94A3B8', marginBottom:12 }}>Conquiste todos os ranks!</div>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'center', gap:4, marginBottom:6 }}>
            <span style={{ fontSize:40, fontWeight:800, color:elo.color, lineHeight:1 }}>{pontos.toLocaleString('pt-BR')}</span>
            <span style={{ fontSize:14, fontWeight:600, color:'#94A3B8' }}>pts</span>
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:elo.bg, padding:'4px 14px', borderRadius:20 }}>
            <span style={{ fontSize:16 }}>{elo.emoji}</span>
            <span style={{ fontSize:13, fontWeight:700, color:elo.color }}>{elo.label}</span>
          </div>
        </div>

        {/* Trail */}
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {trail.map((t, i) => {
            const isLast = i === trail.length - 1
            const nextInTrail = trail[i + 1]
            const lineColor = t.status === 'future' ? '#E2E8F0' : t.elo.color
            return (
              <div key={t.elo.id}>
                <EloTrailCard elo={t.elo} status={t.status} pontos={pontos} idx={t.idx} />
                {!isLast && (
                  <div style={{ display:'flex', justifyContent:'center', padding:'0' }}>
                    <div style={{ width:4, height:20, borderRadius:2, background:nextInTrail?.status==='future'?'#E2E8F0':lineColor }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dica */}
        <div style={{ marginTop:16, background:elo.bg, border:`1px solid ${elo.color}30`, borderRadius:12, padding:'12px 14px', textAlign:'center' }}>
          <div style={{ fontSize:13, fontWeight:600, color:elo.color }}>{DICAS[elo.id]}</div>
        </div>

        <button onClick={onClose} style={{ marginTop:14, width:'100%', padding:'10px', borderRadius:10, border:'1px solid #E2E8F0', background:'#F8FAFC', color:'#64748B', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>Fechar</button>
      </div>
    </div>,
    document.body
  )
}
