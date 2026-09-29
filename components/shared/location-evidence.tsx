import { mapsUrl } from "@/lib/geolocation/maps-url";
import { GeocodingAttribution } from "@/components/shared/geocoding-attribution";

export function LocationEvidence({ latitude, longitude, accuracy, address, maps = false }: {
  latitude: number; longitude: number; accuracy: number; address: string | null; maps?: boolean;
}) {
  return <div className="space-y-3 break-words"><dl className="space-y-3">
    <div><dt className="text-sm text-muted-foreground">Location</dt><dd>{address ?? "Address unavailable"}{address && <GeocodingAttribution />}</dd></div>
    <div><dt className="text-sm text-muted-foreground">GPS</dt><dd>{latitude}, {longitude}</dd></div>
    <div><dt className="text-sm text-muted-foreground">Accuracy</dt><dd>±{accuracy} m</dd></div>
  </dl>{maps && <a href={mapsUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Open in Maps</a>}</div>;
}
