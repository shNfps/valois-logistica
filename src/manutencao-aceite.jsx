import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase.js'
import { btnPrimary, card } from './db.js'
import { fetchOrdensServico, processarAtrasadas } from './manutencao-db.js'
import { useOSManager } from './manutencao-acoes.jsx'
import { OS_TIPO_ICON, OS_TIPO_LABEL, TIPO_BORDER, statusColor, statusLabel, statusEfetivo, formatCountdown, formatData } from './manutencao-shared.js'

function Countdown({ prazo }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(t => t + 1), 60000); return () => clearInterval(id) }, [])
  const c = formatCountdown(prazo)
  if (!c) return null
  const color = c.vencido ? '#DC2626' : (c.alerta ? '#EA580C' : '#64748B')
  return <span style={{ fontSize: 11, fontWeight: 700, color }}>⏱ {c.vencido ? c.texto : `Aceitar em: ${c.texto}`}</span>
}

function OSCard({ os, mode, onAceitar, onAbrir }) {
  const sc = statusColor(os)
  const st = statusEfetivo(os)
  const podeAceitar = st === 'ABERTA' || st === 'ATRASADA'
  return (
    <div onClick={mode === 'minhas' ? () => onAbrir(os) : undefined} style={{ ...card, padding: 14, marginBottom: 8, cursor: mode === 'minhas' ? 'pointer' : 'default', borderLeft: `4px solid ${TIPO_BORDER[os.tipo] || '#94A3B8'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{OS_TIPO_ICON[os.tipo]}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{os.numero_os}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', flex: 1 }}>{os.cliente_nome}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sc.bg, color: sc.color }}>{statusLabel(os)}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 2 }}>{OS_TIPO_LABEL[os.tipo]}{[os.endereco, os.cidade].filter(Boolean).length ? ` · 📍 ${[os.endereco, os.cidade].filter(Boolean).join(' - ')}` : ''}</div>
      <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>{os.descricao}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {os.foto_antes && <img src={os.foto_antes} onClick={e => { e.stopPropagation(); window.open(os.foto_antes, '_blank') }} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0', cursor: 'pointer' }} />}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>Solicitado por: <b style={{ color: '#64748B' }}>{os.solicitante_nome || '—'}</b></div>
          {os.tecnico_nome && <div style={{ fontSize: 11, color: '#94A3B8' }}>Técnico: {os.tecnico_nome}</div>}
          {os.data_agendada && <div style={{ fontSize: 11, color: '#94A3B8' }}>📅 {formatData(os.data_agendada)}</div>}
          {podeAceitar && <Countdown prazo={os.prazo_aceite} />}
        </div>
        {mode === 'todas' && podeAceitar && <button onClick={e => { e.stopPropagation(); onAceitar(os) }} style={{ ...btnPrimary, background: '#10B981', height: 36, fontSize: 12, padding: '0 14px' }}>✅ Aceitar OS</button>}
      </div>
    </div>
  )
}

export function ManutencaoAceiteTab({ user }) {
  const [ordens, setOrdens] = useState([])
  const [mode, setMode] = useState('todas')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const os = await fetchOrdensServico()
    await processarAtrasadas(os)
    setOrdens(await fetchOrdensServico())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const ch = supabase.channel('os-aceite-rt').on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const { setSelected, openAceitar, overlays } = useOSManager(user, load)

  const lista = mode === 'todas'
    ? ordens.filter(o => !o.tecnico_nome && ['ABERTA', 'ATRASADA'].includes(statusEfetivo(o)))
    : ordens.filter(o => o.tecnico_nome === user.nome && o.status !== 'CANCELADA')

  // Agrupar por cidade, cidades em ordem alfabética.
  const grupos = {}
  for (const o of lista) { const c = o.cidade || 'Sem cidade'; (grupos[c] = grupos[c] || []).push(o) }
  const cidades = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const toggleBtn = (active) => ({ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: active ? '#0A1628' : 'transparent', color: active ? '#fff' : '#64748B' })

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F1F5F9', padding: 4, borderRadius: 10 }}>
        <button onClick={() => setMode('todas')} style={toggleBtn(mode === 'todas')}>Todas as Manutenções</button>
        <button onClick={() => setMode('minhas')} style={toggleBtn(mode === 'minhas')}>Minhas Manutenções</button>
      </div>

      {cidades.map(cidade => (
        <div key={cidade} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            📍 {cidade} <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>({grupos[cidade].length})</span>
          </div>
          {grupos[cidade].map(os => <OSCard key={os.id} os={os} mode={mode} onAceitar={openAceitar} onAbrir={setSelected} />)}
        </div>
      ))}

      {lista.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>{mode === 'todas' ? 'Nenhuma OS aberta para aceite' : 'Você ainda não aceitou nenhuma OS'}</div>}

      {overlays}
    </div>
  )
}
