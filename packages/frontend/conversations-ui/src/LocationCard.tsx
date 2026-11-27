import type { LocationPayload } from './types'

const MAP_URL = 'https://www.google.com/maps?q='

/** Cartão de localização como o WhatsApp mostra: nome, endereço e a ação de abrir no mapa. */
export function LocationCard({ location }: { location: LocationPayload }) {
  const href = `${MAP_URL}${location.latitude},${location.longitude}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-[200px] flex-col gap-0.5 rounded-lg bg-black/5 p-2 text-sm text-gray-900 no-underline dark:bg-white/10 dark:text-gray-100"
    >
      <span aria-hidden>📍</span>
      {location.name ? <span className="font-semibold">{location.name}</span> : null}
      {location.address ? <span className="text-xs text-gray-600 dark:text-gray-300">{location.address}</span> : null}
      <span className="text-xs text-teal-700 underline dark:text-teal-300">{`${location.latitude}, ${location.longitude}`}</span>
    </a>
  )
}
