/** Server-only address verification against OpenStreetMap Nominatim. */

type NominatimHit = { lat: string; lon: string; display_name: string };

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export async function verifyAddressAgainstPin(input: {
  address: string;
  city?: string | null;
  lat: number;
  lng: number;
}): Promise<{ verified: boolean; label: string | null; distanceKm: number | null; reason: string }> {
  const query = [input.address, input.city].filter(Boolean).join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;

  let hits: NominatimHit[] = [];
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FoodSave/1.0 (pickup address verification)", Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`geocoder returned ${response.status}`);
    hits = (await response.json()) as NominatimHit[];
  } catch {
    return {
      verified: false,
      label: null,
      distanceKm: null,
      reason: "The address lookup service is unavailable right now. Please try again shortly.",
    };
  }

  if (hits.length === 0) {
    return {
      verified: false,
      label: null,
      distanceKm: null,
      reason: "We could not find that address on the map. Add a street name, number and city.",
    };
  }

  let best: { hit: NominatimHit; km: number } | null = null;
  for (const hit of hits) {
    const km = haversineKm(input.lat, input.lng, Number(hit.lat), Number(hit.lon));
    if (!best || km < best.km) best = { hit, km };
  }
  if (!best) return { verified: false, label: null, distanceKm: null, reason: "No match found." };

  const verified = best.km <= 1.5;
  return {
    verified,
    label: best.hit.display_name,
    distanceKm: Math.round(best.km * 100) / 100,
    reason: verified
      ? "Address matches the map pin."
      : `The address resolves about ${best.km.toFixed(1)} km from your pin. Move the pin or correct the address.`,
  };
}
