import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { btnSmall, card } from './db.js'
import { fetchOrdensServico } from './manutencao-db.js'
import { useOSManager } from './manutencao-acoes.jsx'
import { OS_TIPO_ICON, TIPO_BORDER, PERIODO_SHORT, statusColor, statusLabel, dateKey } from './manutencao-shared.js'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function useIsMobile() { const [m, setM] = useState(window.innerWidth < 768); useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, []); return m }

// Matriz de semanas (Dom-Sáb) que cobre o mês inteiro; descarta semana toda fora do mês.
function getMonthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const weeks = []
  const cur = new Date(start)
  for (let w = 0; w < 6; w++) {
    const week = []
    for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1) }
    weeks.push(week)
  }
  if (weeks[5].every(d => d.getMonth() !== month)) weeks.pop()
  return weeks
}

export function ManutencaoAgendaTab({ user }) {
  const [ordens, setOrdens] = useState([])
  const [monthOffset, setMonthOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  const load = useCallback(async () => { setOrdens(await fetchOrdensServico()); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('os-agenda-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const { setSelected, overlays } = useOSManager(user, load)

  // Só as OS do técnico logado que já têm data agendada.
  const minhas = ordens.filter(o => o.tecnico_nome === user.nome && o.data_agendada && o.status !== 'CANCELADA')
  const porDia = {}
  for (const o of minhas) { (porDia[o.data_agendada] = porDia[o.data_agendada] || []).push(o) }

  const hoje = new Date()
  const base = new Date(hoje.getFullYear(), hoje.getMonth() + monthOffset, 1)
  const year = base.getFullYear(), month = base.getMonth()
  const weeks = getMonthMatrix(year, month)

  const MiniCard = ({ os }) => {
    const sc = statusColor(os)
    return <div onClick={() => setSelected(os)} style={{ padding: '5px 6px', marginBottom: 3, borderRadius: 6, borderLeft: `3px solid ${TIPO_BORDER[os.tipo] || '#94A3B8'}`, background: '#FAFAFA', cursor: 'pointer' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 12 }}>{OS_TIPO_ICON[os.tipo]}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0A1628', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{os.cliente_nome}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: '#94A3B8' }}>{PERIODO_SHORT[os.periodo]}</span>
        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 4, background: sc.bg, color: sc.color }}>{statusLabel(os)}</span>
      </div>
    </div>
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando agenda...</div>

  return (
    <div>
      {/* Header navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, background: '#fff', borderRadius: 12, padding: '10px 16px', border: '1px solid #E2E8F0' }}>
        <button onClick={() => setMonthOffset(m => m - 1)} style={{ ...btnSmall, fontSize: 12 }}>← Mês Anterior</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0A1628' }}>{MESES[month]} {year}</div>
          {monthOffset !== 0 && <button onClick={() => setMonthOffset(0)} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginTop: 2 }}>Hoje</button>}
        </div>
        <button onClick={() => setMonthOffset(m => m + 1)} style={{ ...btnSmall, fontSize: 12 }}>Próximo Mês →</button>
      </div>

      {!isMobile ? (
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          {/* Weekday headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {DIAS_CURTO.map((d, i) => <div key={d} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderRight: i < 6 ? '1px solid #F1F5F9' : 'none' }}>{d}</div>)}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((day, di) => {
                const inMonth = day.getMonth() === month
                const isH = isSameDay(day, hoje)
                const osDay = porDia[dateKey(day)] || []
                return <div key={di} style={{ minHeight: 100, padding: 4, borderRight: di < 6 ? '1px solid #F1F5F9' : 'none', borderTop: wi > 0 ? '1px solid #F1F5F9' : 'none', background: isH ? '#EFF6FF' : (inMonth ? '#fff' : '#FAFBFC'), ...(isH ? { boxShadow: 'inset 0 0 0 2px #3B82F6' } : {}) }}>
                  <div style={{ fontSize: 11, fontWeight: isH ? 800 : 600, color: isH ? '#2563EB' : (inMonth ? '#334155' : '#CBD5E1'), marginBottom: 2 }}>{day.getDate()}</div>
                  {osDay.map(os => <MiniCard key={os.id} os={os} />)}
                </div>
              })}
            </div>
          ))}
        </div>
      ) : (
        /* Mobile: lista por dia do mês com OS */
        <div>
          {Object.keys(porDia).filter(k => { const d = new Date(`${k}T00:00:00`); return d.getMonth() === month && d.getFullYear() === year }).sort().map(k => {
            const d = new Date(`${k}T00:00:00`); const isH = isSameDay(d, hoje); const osDay = porDia[k]
            return <div key={k} style={{ ...card, padding: 0, marginBottom: 8, border: isH ? '2px solid #2563EB' : '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: isH ? '#EFF6FF' : '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isH ? '#2563EB' : '#334155' }}>{isH && '📌 '}{DIAS_CURTO[d.getDay()]} {d.getDate()}/{String(month + 1).padStart(2, '0')}</span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>{osDay.length} OS</span>
              </div>
              <div style={{ padding: 8 }}>{osDay.map(os => <MiniCard key={os.id} os={os} />)}</div>
            </div>
          })}
          {minhas.filter(o => { const d = new Date(`${o.data_agendada}T00:00:00`); return d.getMonth() === month && d.getFullYear() === year }).length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Nenhuma OS agendada neste mês</div>}
        </div>
      )}

      {overlays}
    </div>
  )
}
