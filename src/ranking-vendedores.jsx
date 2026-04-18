import { useState, useEffect } from 'react'
import { fmtMoney, card, fetchClientes, fetchVendedores, fetchConfigRanking } from './db.js'
import { AvatarByNome } from './avatar.jsx'
import { getInicioComercial } from './performance-rank.jsx'

function getPeriodoRange(periodo) {
  const now = new Date()
  if (periodo === 'semana') {
    const ini = new Date(now); ini.setDate(now.getDate() - now.getDay()); ini.setHours(0, 0, 0, 0)
    const fim = new Date(ini); fim.setDate(ini.getDate() + 6); fim.setHours(23, 59, 59)
    return [ini, fim]
  }
  if (periodo === 'mes-anterior') {
    return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)]
  }
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)]
}

const medalha = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`
const barColor = i => i === 0 ? 'linear-gradient(to right,#F59E0B,#FBBF24)' : i === 1 ? 'linear-gradient(to right,#94A3B8,#CBD5E1)' : i === 2 ? 'linear-gradient(to right,#B45309,#D97706)' : 'linear-gradient(to right,#2563EB,#60A5FA)'

const PERIODO_LABELS = { semana: 'Esta semana', mes: 'Este mês', 'mes-anterior': 'Mês anterior' }

function PeriodoSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Object.entries(PERIODO_LABELS).map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer', background: value === k ? '#0A1628' : '#E2E8F0', color: value === k ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap' }}>{l}</button>
      ))}
    </div>
  )
}

// ─── TOP VENDEDORES ───
export function TopVendedores({ pedidos }) {
  const [periodo, setPeriodo] = useState('mes')
  const [clientes, setClientes] = useState([])
  const [vendedores, setVendedores] = useState([])

  useEffect(() => { fetchClientes().then(setClientes); fetchVendedores().then(setVendedores) }, [])

  const [ini, fim] = getPeriodoRange(periodo)
  const avatarMap = {}; vendedores.forEach(v => { avatarMap[v.nome] = v.avatar })

  const FATURADOS = ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE']
  const pedFiltrados = pedidos.filter(p => {
    const d = new Date(p.criado_em)
    return d >= ini && d <= fim && FATURADOS.includes(p.status)
  })

  const vMap = {}
  pedFiltrados.forEach(p => {
    const c = clientes.find(x => x.id === p.cliente_id || x.nome?.toLowerCase() === p.cliente?.toLowerCase())
    const v = c?.vendedor_nome || 'Valois'
    if (!vMap[v]) vMap[v] = { nome: v, pedidos: 0, valor: 0 }
    vMap[v].pedidos++; vMap[v].valor += Number(p.valor_total) || 0
  })

  const ranking = Object.values(vMap).sort((a, b) => b.valor - a.valor)
  const maxValor = ranking[0]?.valor || 1
  if (ranking.length === 0) return null

  return (
    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>🏆 Top Vendedores</div>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>
      {ranking.map((v, i) => (
        <div key={v.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 26, textAlign: 'center', fontSize: i < 3 ? 18 : 12, flexShrink: 0, color: '#64748B', fontWeight: 700 }}>{medalha(i)}</div>
          <AvatarByNome nome={v.nome} avatar={avatarMap[v.nome]} size={34} rank={i} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#059669', flexShrink: 0, marginLeft: 8 }}>{fmtMoney(v.valor)}</span>
            </div>
            <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
              <div style={{ height: '100%', width: `${(v.valor / maxValor) * 100}%`, background: barColor(i), borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{v.pedidos} entregue{v.pedidos !== 1 ? 's' : ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── TIME COMERCIAL ───
export function TimeComercial({ pedidos, usuarios = [] }) {
  const [periodo, setPeriodo] = useState('mes')
  const [dataCorte, setDataCorte] = useState(null)
  useEffect(() => { fetchConfigRanking().then(c => setDataCorte(c?.data_corte_comercial || null)) }, [])
  const [ini, fim] = getPeriodoRange(periodo)
  const corteIni = getInicioComercial(dataCorte)
  const iniEfetivo = (periodo === 'mes' || periodo === 'semana') && corteIni > ini ? corteIni : ini

  const avatarMap = {}; usuarios.forEach(u => { avatarMap[u.nome] = u.avatar })

  const pedFiltrados = pedidos.filter(p => {
    const d = new Date(p.criado_em); return d >= iniEfetivo && d <= fim && p.criado_por
  })

  const FATURADOS_C = ['NF_EMITIDA', 'EM_ROTA', 'ENTREGUE']
  const cMap = {}
  pedFiltrados.forEach(p => {
    const n = p.criado_por
    if (!cMap[n]) cMap[n] = { nome: n, total: 0, valor: 0, entregues: 0 }
    cMap[n].total++
    if (FATURADOS_C.includes(p.status)) { cMap[n].valor += Number(p.valor_total) || 0; cMap[n].entregues++ }
  })

  const ranking = Object.values(cMap).sort((a, b) => b.total - a.total || b.valor - a.valor)
  if (ranking.length === 0) return null

  return (
    <div style={{ ...card, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0A1628' }}>📋 Time Comercial</div>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>
      {ranking.map((v, i) => {
        const taxa = v.total > 0 ? Math.round((v.entregues / v.total) * 100) : 0
        const isFirst = i === 0
        return (
          <div key={v.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, padding: '8px 10px', borderRadius: 10, background: isFirst ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${isFirst ? '#FDE68A' : '#F1F5F9'}` }}>
            <div style={{ width: 26, textAlign: 'center', fontSize: i < 3 ? 18 : 12, flexShrink: 0, color: '#64748B', fontWeight: 700 }}>{medalha(i)}</div>
            <AvatarByNome nome={v.nome} avatar={avatarMap[v.nome]} size={30} rank={i} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1628', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.nome}</div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{v.total} pedido{v.total !== 1 ? 's' : ''} · {fmtMoney(v.valor)}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: taxa >= 70 ? '#059669' : taxa >= 40 ? '#F59E0B' : '#EF4444' }}>{taxa}%</div>
              <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500 }}>aprovação</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
