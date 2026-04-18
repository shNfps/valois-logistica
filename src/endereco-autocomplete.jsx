import { useState, useRef, useCallback } from 'react'
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api'
import { inputStyle } from './db.js'

const LIBRARIES = ['places']

// Viés geográfico: Região dos Lagos, RJ
const LAGOS_BOUNDS = {
  north: -22.4, south: -23.0, east: -41.7, west: -42.5
}

export function EnderecoAutocomplete({ value, onChange, onSelect, placeholder, style }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: LIBRARIES
  })
  const autocompleteRef = useRef(null)

  const onLoad = useCallback((autocomplete) => {
    autocompleteRef.current = autocomplete
  }, [])

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    if (!place?.geometry) return

    const lat = place.geometry.location.lat()
    const lng = place.geometry.location.lng()
    const endereco = place.formatted_address || ''

    let cidade = ''
    const components = place.address_components || []
    for (const comp of components) {
      if (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality')) {
        cidade = comp.long_name
        break
      }
    }

    onChange?.(endereco)
    onSelect?.({ endereco, cidade, latitude: lat, longitude: lng })
  }, [onChange, onSelect])

  if (!isLoaded) {
    return <input value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, ...style }} />
  }

  return (
    <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}
      options={{ componentRestrictions: { country: 'br' }, bounds: LAGOS_BOUNDS, types: ['address'] }}>
      <input value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder || 'Endereço *'} style={{ ...inputStyle, ...style }} />
    </Autocomplete>
  )
}
