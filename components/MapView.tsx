'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { formatMoney } from '@/lib/money'
import type { Purchase } from '@/lib/types'

const markerIcon = L.icon({
  iconUrl: '/leaflet/marker-icon.png',
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type Spot = {
  key: string
  lat: number
  lng: number
  name: string
  items: Purchase[]
}

function groupBySpot(purchases: Purchase[]): Spot[] {
  const map = new Map<string, Spot>()
  for (const p of purchases) {
    if (p.location_lat == null || p.location_lng == null) continue
    // Round to ~5 decimals (~1m) so near-identical points cluster into one spot.
    const key = `${p.location_lat.toFixed(5)},${p.location_lng.toFixed(5)}`
    const existing = map.get(key)
    if (existing) {
      existing.items.push(p)
    } else {
      map.set(key, {
        key,
        lat: p.location_lat,
        lng: p.location_lng,
        name: p.location_name || 'Unnamed spot',
        items: [p],
      })
    }
  }
  return Array.from(map.values())
}

function ClusterLayer({ spots }: { spots: Spot[] }) {
  const map = useMap()
  const groupRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    // Leaflet.markercluster augments the L namespace at runtime via the side-effect
    // import above, so this cast is the practical way to reach markerClusterGroup().
    const group = (L as unknown as { markerClusterGroup: () => L.MarkerClusterGroup }).markerClusterGroup()
    groupRef.current = group

    for (const spot of spots) {
      const marker = L.marker([spot.lat, spot.lng], { icon: markerIcon })
      const itemsList = spot.items
        .map(
          item =>
            `<li>${item.item_name}${item.brand ? ` &middot; ${item.brand}` : ''} &middot; ${formatMoney(item.price_amount, item.price_currency)}</li>`
        )
        .join('')
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.5"><strong>${spot.name}</strong><ul style="margin:4px 0 0;padding-left:16px">${itemsList}</ul></div>`
      )
      group.addLayer(marker)
    }

    map.addLayer(group)

    if (spots.length > 0) {
      const bounds = L.latLngBounds(spots.map(s => [s.lat, s.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
    }

    return () => {
      map.removeLayer(group)
    }
  }, [map, spots])

  return null
}

export function MapView({ purchases }: { purchases: Purchase[] }) {
  const spots = groupBySpot(purchases)

  return (
    <MapContainer
      center={[1.3521, 103.8198]}
      zoom={11}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClusterLayer spots={spots} />
    </MapContainer>
  )
}
