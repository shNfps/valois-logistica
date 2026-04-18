import { supabase } from './supabase.js'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export async function geocodeEndereco(endereco, cidade) {
  const addr = [endereco, cidade, 'Brasil'].filter(Boolean).join(', ')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${GOOGLE_MAPS_KEY}&region=br`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry.location
      return { latitude: lat, longitude: lng }
    }
  } catch (e) { console.error('Geocoding error:', e) }
  return null
}

export async function fetchClientesSemCoordenadas() {
  const { data, error } = await supabase.from('clientes').select('id, nome, endereco, cidade')
    .is('latitude', null).not('endereco', 'is', null)
  if (error) { console.error(error); return [] }
  return data || []
}

export async function atualizarCoordenadasCliente(id, lat, lng) {
  const { error } = await supabase.from('clientes').update({ latitude: lat, longitude: lng }).eq('id', id)
  if (error) console.error(error)
}

export async function atualizarCoordenadasLote(onProgress) {
  const clientes = await fetchClientesSemCoordenadas()
  let ok = 0, fail = 0
  for (let i = 0; i < clientes.length; i++) {
    const c = clientes[i]
    const coords = await geocodeEndereco(c.endereco, c.cidade)
    if (coords) {
      await atualizarCoordenadasCliente(c.id, coords.latitude, coords.longitude)
      ok++
    } else { fail++ }
    onProgress?.({ total: clientes.length, done: i + 1, ok, fail, nome: c.nome })
    // Respeitar limite de 50 req/s
    if (i < clientes.length - 1) await new Promise(r => setTimeout(r, 25))
  }
  return { ok, fail, total: clientes.length }
}
