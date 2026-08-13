interface MapPreviewProps {
  lat: number;
  lng: number;
  span?: number;
  label?: string;
  className?: string;
}

/** Lightweight OpenStreetMap embed — no API key required. */
export function MapPreview({ lat, lng, span = 0.008, label, className }: MapPreviewProps) {
  const bbox = [lng - span, lat - span / 2, lng + span, lat + span / 2].join("%2C");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <div className={className}>
      <iframe
        title={label ?? "Pickup location map"}
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full min-h-48 w-full rounded-xl border border-border"
      />
    </div>
  );
}
