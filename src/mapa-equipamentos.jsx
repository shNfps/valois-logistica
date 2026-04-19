import { useState, useMemo, useCallback } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, MarkerClustererF } from '@react-google-maps/api'
import { card, btnSmall } from './db.js'

const GALPAO_LAT = -22.8843
const GALPAO_LNG = -42.0194
const GALPAO_POS = { lat: GALPAO_LAT, lng: GALPAO_LNG }
const MAP_CENTER = GALPAO_POS
const MAP_ZOOM = 12
const LIBRARIES = ['places']

const TIPO_CORES = {
  'Dispenser de Sabonete': '#10B981', 'Dispenser de Papel Toalha': '#10B981', 'Dispenser de Papel Higiênico': '#10B981',
  'Diluidor': '#3B82F6', 'Foamer': '#8B5CF6', 'Saboneteira': '#EC4899', 'Lixeira': '#64748B'
}
const DEFAULT_COLOR = '#F97316'

function getTipoCor(tipo) {
  if (!tipo) return DEFAULT_COLOR
  for (const [key, color] of Object.entries(TIPO_CORES)) {
    if (tipo.toLowerCase().includes(key.toLowerCase())) return color
  }
  return DEFAULT_COLOR
}

function getTipoCategoria(tipo) {
  if (!tipo) return 'Outros'
  const t = tipo.toLowerCase()
  if (t.includes('dispenser')) return 'Dispenser'
  if (t.includes('diluidor')) return 'Diluidor'
  if (t.includes('foamer')) return 'Foamer'
  if (t.includes('saboneteira')) return 'Saboneteira'
  if (t.includes('lixeira')) return 'Lixeira'
  return 'Outros'
}

const LEGENDA = [{ label:'Dispenser',color:'#10B981' },{ label:'Diluidor',color:'#3B82F6' },{ label:'Foamer',color:'#8B5CF6' },{ label:'Saboneteira',color:'#EC4899' },{ label:'Lixeira',color:'#64748B' },{ label:'Outros',color:'#F97316' }]

function createMarkerIcon(color, count) {
  const size = count > 1 ? 36 : 28
  const svg = count > 1
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="#fff" stroke-width="2"/><text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Inter,sans-serif">${count}</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="6" fill="#fff"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function createHQIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56"><defs><filter id="gs" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#F59E0B" flood-opacity="0.5"/></filter></defs><path d="M24 2C12.95 2 4 10.95 4 22c0 16 20 32 20 32s20-16 20-32C44 10.95 35.05 2 24 2z" fill="#0A1628" stroke="#F59E0B" stroke-width="3" filter="url(#gs)"/><text x="24" y="28" text-anchor="middle" font-size="20">🏢</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const mapContainerStyle = { width: '100%', height: 600, borderRadius: 16 }
const mapOptions = {
  disableDefaultUI: false, zoomControl: true, mapTypeControl: false,
  streetViewControl: false, fullscreenControl: false,
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] }
  ]
}

export function useGoogleMaps() {
  return useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES
  })
}

export function MapaEquipamentos({ equipamentos, clientes, filtroTipo, filtroStatus, filtroCidade, search, onVerDetalhes, onSolicitarManutencao }) {
  const { isLoaded } = useGoogleMaps()
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [showHQInfo, setShowHQInfo] = useState(false)
  const [map, setMap] = useState(null)
  const [legendFilter, setLegendFilter] = useState(null)

  const clientesMap = useMemo(() => {
    const m = {}
    clientes.forEach(c => { if (c.id) m[c.id] = c })
    return m
  }, [clientes])

  const markers = useMemo(() => {
    const groups = {}
    equipamentos.forEach(eq => {
      const c = clientesMap[eq.cliente_id]
      if (!c || !c.latitude || !c.longitude) return
      if (filtroTipo && eq.tipo !== filtroTipo) return
      if (filtroStatus && eq.status !== filtroStatus) return
      if (filtroCidade && c.cidade !== filtroCidade) return
      if (legendFilter && getTipoCategoria(eq.tipo) !== legendFilter) return
      if (search) {
        const s = search.toLowerCase()
        const match = (c.nome || '').toLowerCase().includes(s) || (c.endereco || '').toLowerCase().includes(s) || (eq.tipo || '').toLowerCase().includes(s)
        if (!match) return
      }
      const key = c.id
      if (!groups[key]) groups[key] = { cliente: c, equipamentos: [] }
      groups[key].equipamentos.push(eq)
    })
    return Object.values(groups)
  }, [equipamentos, clientesMap, filtroTipo, filtroStatus, filtroCidade, search, legendFilter])

  const legendCounts = useMemo(() => {
    const counts = {}
    LEGENDA.forEach(l => { counts[l.label] = 0 })
    equipamentos.forEach(eq => {
      const c = clientesMap[eq.cliente_id]
      if (!c || !c.latitude || !c.longitude) return
      counts[getTipoCategoria(eq.tipo)] = (counts[getTipoCategoria(eq.tipo)] || 0) + 1
    })
    return counts
  }, [equipamentos, clientesMap])

  const totalLocalizados = markers.reduce((s, m) => s + m.equipamentos.length, 0)
  const totalSemCoord = equipamentos.filter(eq => {
    const c = clientesMap[eq.cliente_id]
    return !c || !c.latitude || !c.longitude
  }).length

  const handleMyLocation = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      map?.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      map?.setZoom(14)
    })
  }, [map])

  const handleCenter = useCallback(() => {
    map?.panTo(GALPAO_POS)
    map?.setZoom(12)
  }, [map])

  if (!isLoaded) return <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>Carregando mapa...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>
          {totalLocalizados} equipamento{totalLocalizados !== 1 ? 's' : ''} localizado{totalLocalizados !== 1 ? 's' : ''}
          {totalSemCoord > 0 && <span style={{ color: '#B45309' }}> | {totalSemCoord} sem coordenadas</span>}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleMyLocation} style={{ ...btnSmall, fontSize: 11, padding: '4px 10px' }}>📍 Minha localização</button>
          <button onClick={handleCenter} style={{ ...btnSmall, fontSize: 11, padding: '4px 10px' }}>🏢 Centralizar na Sede</button>
        </div>
      </div>

      <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 12 }}>
        <GoogleMap mapContainerStyle={mapContainerStyle} center={MAP_CENTER} zoom={MAP_ZOOM} options={mapOptions} onLoad={setMap}>
          <MarkerClustererF options={{ maxZoom: 14, styles: [{ textColor: '#fff', textSize: 13, width: 40, height: 40, url: createMarkerIcon('#3B82F6', 0) }] }}>
            {(clusterer) => markers.map(m => {
              const eqs = m.equipamentos
              const mainColor = eqs.length === 1 ? getTipoCor(eqs[0].tipo) : '#3B82F6'
              return (
                <MarkerF key={m.cliente.id} position={{ lat: Number(m.cliente.latitude), lng: Number(m.cliente.longitude) }}
                  icon={{ url: createMarkerIcon(mainColor, eqs.length > 1 ? eqs.length : 0), scaledSize: new window.google.maps.Size(eqs.length > 1 ? 36 : 28, eqs.length > 1 ? 36 : 36) }}
                  clusterer={clusterer} onClick={() => { setSelectedMarker(m); setShowHQInfo(false) }} />
              )
            })}
          </MarkerClustererF>
          <MarkerF position={GALPAO_POS} onClick={() => { setShowHQInfo(true); setSelectedMarker(null) }}
            icon={{ url: createHQIcon(), scaledSize: new window.google.maps.Size(48, 56), anchor: new window.google.maps.Point(24, 56) }}
            zIndex={9999} />
          {showHQInfo && (
            <InfoWindowF position={GALPAO_POS} onCloseClick={() => setShowHQInfo(false)}>
              <HQInfoContent />
            </InfoWindowF>
          )}
          {selectedMarker && (
            <InfoWindowF position={{ lat: Number(selectedMarker.cliente.latitude), lng: Number(selectedMarker.cliente.longitude) }} onCloseClick={() => setSelectedMarker(null)}>
              <InfoWindowContent marker={selectedMarker} onVerDetalhes={onVerDetalhes} onSolicitarManutencao={onSolicitarManutencao} />
            </InfoWindowF>
          )}
        </GoogleMap>
      </div>

      <MapLegend legendCounts={legendCounts} legendFilter={legendFilter} setLegendFilter={setLegendFilter} />
    </div>
  )
}

function HQInfoContent() {
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${GALPAO_LAT},${GALPAO_LNG}`
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 290, fontSize: 12 }}>
      <div style={{ background: '#0A1628', borderRadius: '8px 8px 0 0', padding: '10px 12px', margin: '-8px -8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>🏢</span>
        <div><div style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>VALOIS DESCARTÁVEIS E LIMPEZA</div>
        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: '#F59E0B', color: '#0A1628' }}>SEDE</span></div>
      </div>
      <div style={{ fontSize: 11, color: '#334155', marginBottom: 3 }}>📍 Rod. Amaral Peixoto, KM 127 - Lote Canaã</div>
      <div style={{ fontSize: 11, color: '#334155', marginBottom: 3 }}>Campos Novos, Cabo Frio - RJ</div>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>CEP: 28928-720</div>
      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}>📞 (21) 97013-4833</div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 8 }}>🚛 Ponto de partida das rotas</div>
      <a href={routeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', padding: '6px 10px', borderRadius: 6, background: '#0A1628', color: '#fff', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>🗺️ Traçar rota até aqui</a>
    </div>
  )
}

function InfoWindowContent({ marker, onVerDetalhes, onSolicitarManutencao }) {
  const { cliente, equipamentos } = marker
  const hoje = new Date()
  const dias90 = 90 * 24 * 60 * 60 * 1000
  return (
    <div style={{ fontFamily: "'Inter',sans-serif", maxWidth: 280, fontSize: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0A1628', marginBottom: 2 }}>{cliente.nome}</div>
      {cliente.cnpj && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>CNPJ: {cliente.cnpj}</div>}
      {cliente.endereco && <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>📍 {cliente.endereco}</div>}
      {cliente.cidade && <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>{cliente.cidade}</div>}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Equipamentos ({equipamentos.length})</div>
      {equipamentos.map(eq => {
        const needsMaint = eq.status === 'instalado' && ((eq.ultima_manutencao && (hoje - new Date(eq.ultima_manutencao)) > dias90) || (!eq.ultima_manutencao && eq.data_instalacao && (hoje - new Date(eq.data_instalacao)) > dias90))
        return (
          <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid #F1F5F9' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: getTipoCor(eq.tipo), flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11 }}>{eq.tipo}{eq.modelo ? ` - ${eq.modelo}` : ''}</span>
            {needsMaint && <span style={{ fontSize: 9, color: '#B45309', fontWeight: 700 }}>⚠️ 90d+</span>}
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {onVerDetalhes && <button onClick={() => onVerDetalhes(cliente.id)} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#3B82F6', fontFamily: 'inherit' }}>Ver detalhes</button>}
        {onSolicitarManutencao && <button onClick={() => onSolicitarManutencao(cliente)} style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none', background: '#F97316', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#fff', fontFamily: 'inherit' }}>Solicitar manutenção</button>}
      </div>
    </div>
  )
}

function MapLegend({ legendCounts, legendFilter, setLegendFilter }) {
  return (
    <div style={{ ...card, padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '2px solid #F59E0B', background: '#FFFBEB', fontSize: 11, fontWeight: 700, color: '#0A1628' }}>🏢 Sede Valois</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginRight: 4 }}>Legenda:</span>
      {LEGENDA.map(l => {
        const active = legendFilter === l.label
        return (
          <button key={l.label} onClick={() => setLegendFilter(active ? null : l.label)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: active ? `2px solid ${l.color}` : '1px solid #E2E8F0', background: active ? l.color + '15' : '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, color: l.color }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
            {l.label} ({legendCounts[l.label] || 0})
          </button>
        )
      })}
      {legendFilter && <button onClick={() => setLegendFilter(null)} style={{ ...btnSmall, fontSize: 10, padding: '2px 8px', color: '#64748B' }}>✕ Limpar</button>}
    </div>
  )
}
