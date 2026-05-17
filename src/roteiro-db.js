import { supabase } from './supabase.js'

export const VEICULOS_ROTEIRO = [
  { key: 'fiorino',  label: 'Fiorino',  icon: '🚐' },
  { key: 'kombi',    label: 'Kombi',    icon: '🚌' },
  { key: 'van',      label: 'Van',      icon: '🚐' },
  { key: 'carro',    label: 'Carro',    icon: '🚗' },
  { key: 'moto',     label: 'Moto',     icon: '🏍️' },
  { key: 'caminhao', label: 'Caminhão', icon: '🚛' }
]

export const labelVeiculo = (k) => VEICULOS_ROTEIRO.find(v => v.key === k)?.label || k

// R-AAAA-MMDD-XXX (3 dígitos sequenciais por dia)
export async function gerarNumeroRoteiro(dataISO) {
  const d = new Date(dataISO + 'T00:00:00')
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const prefix = `R-${y}-${m}${day}-`
  const { data } = await supabase.from('rotas').select('numero_roteiro')
    .like('numero_roteiro', `${prefix}%`).order('numero_roteiro', { ascending: false }).limit(1)
  let n = 1
  if (data?.[0]?.numero_roteiro) {
    const last = parseInt(data[0].numero_roteiro.split('-').pop(), 10)
    if (!isNaN(last)) n = last + 1
  }
  return `${prefix}${String(n).padStart(3, '0')}`
}

export async function fetchMotoristas() {
  const { data } = await supabase.from('usuarios').select('*').order('nome')
  return (data || []).filter(u => (u.setores || [u.setor]).includes('motorista'))
}

export async function fetchUltimoRoteiroDoMotorista(motoristaNome) {
  const { data } = await supabase.from('rotas').select('placa, veiculo')
    .eq('motorista_nome', motoristaNome).not('placa', 'is', null)
    .order('criado_em', { ascending: false }).limit(1).maybeSingle()
  return data || null
}

export async function createRoteiro(payload) {
  const { data, error } = await supabase.from('rotas').insert(payload).select().single()
  if (error) { console.error('createRoteiro', error); return null }
  return data
}

export async function updateRoteiro(id, updates) {
  const { error } = await supabase.from('rotas').update(updates).eq('id', id)
  if (error) console.error('updateRoteiro', error)
}

export async function fetchRoteiros({ motorista, data, limit = 50 } = {}) {
  let q = supabase.from('rotas').select('*').not('numero_roteiro', 'is', null)
    .order('criado_em', { ascending: false }).limit(limit)
  if (motorista) q = q.eq('motorista_nome', motorista)
  if (data) q = q.eq('data_roteiro', data)
  const { data: rows, error } = await q
  if (error) { console.error('fetchRoteiros', error); return [] }
  return rows || []
}

// Estimativa de distância Haversine (km) entre dois pontos lat/lng
export function haversineKm(a, b) {
  const R = 6371
  const toRad = x => x * Math.PI / 180
  const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Otimiza ordem dos pedidos via Google Directions API (waypoints optimize:true).
// Retorna { ordem: [pedidoIds], distanciaKm, duracaoMin } ou null em falha.
export async function otimizarRotaGoogle(pontos, origem) {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key || pontos.length === 0) return null
  const fmt = p => `${p.lat},${p.lng}`
  const origin = fmt(origem)
  const destination = fmt(origem) // volta ao ponto de saída
  const waypoints = 'optimize:true|' + pontos.map(p => fmt(p)).join('|')
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&key=${key}&region=br`
  try {
    const res = await fetch(url); const data = await res.json()
    if (data.status !== 'OK' || !data.routes?.length) return null
    const route = data.routes[0]
    const order = route.waypoint_order || pontos.map((_, i) => i)
    const distM = (route.legs || []).reduce((s, l) => s + (l.distance?.value || 0), 0)
    const durS  = (route.legs || []).reduce((s, l) => s + (l.duration?.value || 0), 0)
    return { ordem: order.map(i => pontos[i].pedidoId), distanciaKm: distM / 1000, duracaoMin: Math.round(durS / 60) }
  } catch (e) { console.warn('Directions API falhou:', e); return null }
}

// Fallback: nearest-neighbor a partir do ponto de origem (sem chamada externa).
export function otimizarLocal(pontos, origem) {
  if (!pontos.length) return { ordem: [], distanciaKm: 0, duracaoMin: 0 }
  const restantes = [...pontos]; const ordem = []; let atual = origem; let total = 0
  while (restantes.length) {
    let melhor = 0; let melhorDist = Infinity
    for (let i = 0; i < restantes.length; i++) {
      const d = haversineKm(atual, restantes[i])
      if (d < melhorDist) { melhorDist = d; melhor = i }
    }
    total += melhorDist; ordem.push(restantes[melhor].pedidoId); atual = restantes[melhor]
    restantes.splice(melhor, 1)
  }
  total += haversineKm(atual, origem) // retorno
  // Heurística: 30 km/h média urbana + parada de 5min cada
  const duracaoMin = Math.round((total / 30) * 60 + ordem.length * 5)
  return { ordem, distanciaKm: total, duracaoMin }
}

// Enriquece pedidos com endereço do cliente (a coluna `endereco` vive em `clientes`)
export async function enriquecerComEnderecos(pedidos) {
  if (!pedidos?.length) return pedidos || []
  const ids = [...new Set(pedidos.map(p => p.cliente_id).filter(Boolean))]
  const nomes = [...new Set(pedidos.filter(p => !p.cliente_id).map(p => p.cliente).filter(Boolean))]
  const map = {}
  if (ids.length) {
    const { data } = await supabase.from('clientes').select('id, nome, endereco').in('id', ids)
    ;(data || []).forEach(c => { map['id:' + c.id] = c.endereco; map['nm:' + c.nome.toLowerCase()] = c.endereco })
  }
  if (nomes.length) {
    const { data } = await supabase.from('clientes').select('nome, endereco').in('nome', nomes)
    ;(data || []).forEach(c => { map['nm:' + c.nome.toLowerCase()] = c.endereco })
  }
  return pedidos.map(p => ({
    ...p,
    endereco_entrega: map['id:' + p.cliente_id] || map['nm:' + (p.cliente || '').toLowerCase()] || ''
  }))
}

// Endereço base de saída da Valois (Av. José Bento Ribeiro Dantas, 2001 — Búzios)
export const ORIGEM_VALOIS = { lat: -22.7468, lng: -41.8814 }

export function fmtDuracao(min) {
  if (!min) return '—'
  const h = Math.floor(min / 60); const m = min % 60
  return h > 0 ? `${h}h ${String(m).padStart(2,'0')}min` : `${m}min`
}
