function toRad(deg: number): number { return (deg * Math.PI) / 180 }

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estimateEtaMinutes(distanceKm: number, avgSpeedKmh = 30): number {
  if (distanceKm <= 0) return 0
  return Math.ceil((distanceKm / avgSpeedKmh) * 60)
}

export function isWithinRadius(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radiusM: number
): boolean {
  return haversineKm(lat, lng, centerLat, centerLng) * 1000 <= radiusM
}
