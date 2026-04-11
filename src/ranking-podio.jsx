import { useState, useEffect } from 'react'
import { fmtMoney } from './db.js'
import { AvatarByNome } from './avatar.jsx'

const PA = `
@keyframes coroa{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes confete-f{0%{transform:translateY(-8px) rotate(0deg);opacity:1}100%{transform:translateY(72px) rotate(720deg);opacity:0}}
@keyframes pgold{0%,100%{box-shadow:0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 22px rgba(245,158,11,0.5)}}
`
const ORDER = [1, 0, 2]
const H = { 0: 118, 1: 88, 2: 68 }
const DELAY = { 0: 600, 1: 300, 2: 0 }
const BG = {
  0: 'linear-gradient(160deg,#F59E0B,#FBBF24)',
  1: 'linear-gradient(160deg,#94A3B8,#CBD5E1)',
  2: 'linear-gradient(160deg,#B45309,#D97706)',
}
const MEDALS = ['🥇', '🥈', '🥉']
const CONF_COLORS = ['#F59E0B', '#FBBF24', '#FDE68A', '#FCD34D', '#fff']

function Confete() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 10 }}>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: `${5 + i * 8}%`, top: 0, width: 5, height: 5, borderRadius: '50%', background: CONF_COLORS[i % 5], animation: `confete-f ${0.8 + (i % 3) * 0.3}s ease-out ${i * 70}ms forwards` }} />
      ))}
    </div>
  )
}

function PodioCol({ item, rank, avatarMap, delay }) {
  const [h, setH] = useState(0)
  const [showC, setShowC] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => { setH(H[rank]); if (rank === 0) setTimeout(() => setShowC(true), 500) }, delay)
    return () => clearTimeout(t)
  }, [rank, delay])
  if (!item) return <div style={{ flex: 1 }} />
  const size = rank === 0 ? 64 : 52
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
      <style>{PA}</style>
      {rank === 0 && <div style={{ fontSize: 20, animation: 'coroa 2.2s ease-in-out infinite', marginBottom: 3, zIndex: 3, position: 'relative' }}>👑</div>}
      {rank === 0 && showC && <Confete />}
      <div style={{ position: 'relative', marginBottom: 6, zIndex: 2 }}>
        <AvatarByNome nome={item.nome} avatar={avatarMap[item.nome]} size={size} rank={rank} />
        {rank === 0 && <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', animation: 'pgold 2.5s ease-in-out infinite', pointerEvents: 'none' }} />}
      </div>
      <div style={{ fontSize: rank === 0 ? 13 : 11, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 2, maxWidth: 78, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.6)', zIndex: 2, position: 'relative' }}>
        {item.nome.split(' ')[0]}
      </div>
      <div style={{ fontSize: rank === 0 ? 12 : 10, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginBottom: 6, textShadow: '0 1px 2px rgba(0,0,0,0.5)', zIndex: 2, position: 'relative' }}>
        {fmtMoney(item.valor)}
      </div>
      <div style={{ width: '100%', height: `${h}px`, background: BG[rank], borderRadius: '10px 10px 0 0', transition: 'height 0.9s cubic-bezier(0.34,1.4,0.64,1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10, overflow: 'hidden' }}>
        <span style={{ fontSize: rank === 0 ? 30 : 22, lineHeight: 1 }}>{MEDALS[rank]}</span>
      </div>
    </div>
  )
}

export function PodioPodium({ top3, avatarMap }) {
  const [vis, setVis] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVis(true), 150); return () => clearTimeout(t) }, [])
  if (!top3 || top3.length === 0) return null
  return (
    <div style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)', borderRadius: 20, padding: '14px 12px 0', marginBottom: 20, position: 'relative', overflow: 'hidden', opacity: vis ? 1 : 0, transition: 'opacity 0.5s ease' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 3, textAlign: 'center', marginBottom: 10 }}>Pódio</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 230 }}>
        {ORDER.map(rank => (
          <PodioCol key={rank} item={top3[rank]} rank={rank} avatarMap={avatarMap} delay={vis ? DELAY[rank] : 9999} />
        ))}
      </div>
    </div>
  )
}
