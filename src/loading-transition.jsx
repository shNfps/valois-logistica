import { useState, useEffect, useRef, useCallback } from 'react'

// ─── LOADING TRANSITION (pós-login) ───
// Splash exibido logo após o login, ANTES de renderizar o sistema.
// Conceito: balde de limpeza soltando bolhas de sabão que sobem e desvanecem.
// - Fundo azul-navy no MESMO tom da tela de login (bolhas brancas saltam no escuro).
// - Animação 100% CSS (keyframes) — nenhuma lib.
// - Duração: mínimo ~1.8s; segue quando os dados iniciais carregarem (prop `ready`)
//   OU no máximo 10s (timeout de segurança).
// - prefers-reduced-motion: mostra só logo + spinner simples.

const MIN_MS = 1800
const MAX_MS = 10000

// Bolhas: tamanho(px), posição horizontal no palco(px, palco=240), delay(s), duração(s).
const BUBBLES = [
  { s: 16, l: 104, d: 0.0, t: 3.6 },
  { s: 11, l: 129, d: 0.5, t: 3.0 },
  { s: 22, l: 115, d: 0.9, t: 4.3 },
  { s: 9,  l: 95,  d: 1.4, t: 2.8 },
  { s: 14, l: 141, d: 1.1, t: 3.4 },
  { s: 19, l: 133, d: 2.0, t: 3.9 },
  { s: 12, l: 90,  d: 2.4, t: 3.1 },
  { s: 17, l: 121, d: 1.6, t: 3.7 },
]

const CSS = `
.val-splash{position:fixed;inset:0;z-index:3000;background:linear-gradient(135deg,#0A1628 0%,#1E3A5F 52%,#0A1628 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-family:'Inter',sans-serif;padding:20px}
.val-splash-logo{width:100%;max-width:230px;height:auto;margin-bottom:6px;filter:drop-shadow(0 0 10px rgba(255,255,255,.45))}
.val-stage{position:relative;width:240px;height:250px}
.val-bucket{position:absolute;bottom:0;left:50%;transform:translateX(-50%)}
.val-bucket-body{fill:var(--valois-blue)}
.val-bucket-rim{fill:var(--valois-green)}
.val-foam{fill:var(--surface)}
.val-bubble{position:absolute;bottom:86px;border-radius:50%;
  background:radial-gradient(circle at 30% 26%,rgba(255,255,255,.95),rgba(224,242,255,.45) 42%,rgba(126,204,40,.16) 72%,rgba(255,255,255,.06));
  border:1px solid rgba(255,255,255,.8);
  box-shadow:inset -2px -3px 6px rgba(10,22,40,.25),0 2px 6px rgba(0,0,0,.18);
  animation:val-bubble-rise linear infinite;will-change:transform,opacity}
@keyframes val-bubble-rise{
  0%{transform:translate(0,0) scale(.4);opacity:0}
  12%{opacity:.95}
  30%{transform:translate(7px,-52px) scale(1)}
  52%{transform:translate(-7px,-100px) scale(1.03);opacity:.9}
  74%{transform:translate(6px,-150px) scale(1);opacity:.5}
  100%{transform:translate(-2px,-194px) scale(1.14);opacity:0}
}
.val-splash-text{color:rgba(255,255,255,.92);font-size:15px;font-weight:600;letter-spacing:.2px;margin-top:2px}
.val-pulse{animation:val-text-pulse 1.8s ease-in-out infinite}
@keyframes val-text-pulse{0%,100%{opacity:1}50%{opacity:.55}}
.val-spinner{width:42px;height:42px;border:4px solid rgba(255,255,255,.22);border-top-color:var(--valois-green);border-radius:50%;animation:val-spin .8s linear infinite;margin:14px 0}
@keyframes val-spin{to{transform:rotate(360deg)}}
`

function Bucket() {
  return (
    <svg className="val-bucket" width="150" height="150" viewBox="0 0 140 150" fill="none" aria-hidden="true">
      {/* alça */}
      <path d="M32 48 Q70 10 108 48" style={{ stroke: 'var(--valois-blue-dark)', strokeWidth: 4, fill: 'none', strokeLinecap: 'round' }} />
      {/* corpo (trapézio) */}
      <path className="val-bucket-body" d="M30 48 L110 48 L99 124 Q98 130 91 130 L49 130 Q42 130 41 124 Z" />
      {/* sombra lateral p/ volume */}
      <path d="M110 48 L99 124 Q98 130 91 130 L87 130 L99 48 Z" style={{ fill: 'var(--valois-blue-dark)' }} opacity="0.45" />
      {/* rim verde */}
      <ellipse className="val-bucket-rim" cx="70" cy="48" rx="41" ry="9" />
      {/* espuma/água */}
      <ellipse className="val-foam" cx="70" cy="46" rx="34" ry="7" opacity="0.92" />
      <circle className="val-foam" cx="56" cy="44" r="7" />
      <circle className="val-foam" cx="70" cy="42" r="9" />
      <circle className="val-foam" cx="85" cy="44" r="7" />
      <circle cx="63" cy="45" r="4.5" style={{ fill: 'var(--valois-green-soft)' }} />
      <circle cx="78" cy="45" r="4.5" style={{ fill: 'var(--valois-blue-soft)' }} />
    </svg>
  )
}

export function LoadingTransition({ ready, onDone }) {
  const [reduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  const [minElapsed, setMinElapsed] = useState(false)
  const doneRef = useRef(false)
  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDone && onDone()
  }, [onDone])

  useEffect(() => {
    const min = setTimeout(() => setMinElapsed(true), MIN_MS)
    const max = setTimeout(finish, MAX_MS) // segurança: nunca vira tela infinita
    return () => { clearTimeout(min); clearTimeout(max) }
  }, [finish])

  // Segue quando o mínimo passou E os dados iniciais chegaram.
  useEffect(() => {
    if (minElapsed && ready) finish()
  }, [minElapsed, ready, finish])

  return (
    <div className="val-splash">
      <style>{CSS}</style>
      <img className="val-splash-logo" src="/logo-valois.png" alt="Valois Logística" />
      {reduced ? (
        <div className="val-spinner" />
      ) : (
        <div className="val-stage">
          {BUBBLES.map((b, i) => (
            <span key={i} className="val-bubble" style={{
              width: b.s, height: b.s, left: b.l,
              animationDelay: `${b.d}s`, animationDuration: `${b.t}s`,
            }} />
          ))}
          <Bucket />
        </div>
      )}
      <div className={reduced ? 'val-splash-text' : 'val-splash-text val-pulse'}>Preparando tudo para você…</div>
    </div>
  )
}
