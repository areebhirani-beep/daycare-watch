export type LatLng = { latitude: number; longitude: number };
export type Region = LatLng & { latitudeDelta: number; longitudeDelta: number };

/** The screen, and the strip of it the map can really be seen in (between the search pill and the sheet). */
export type Viewport = { width: number; height: number; top: number; bottom: number };

const MIN_SPAN = 0.008; // ~900 m: a single point still shows its streets
const MARGIN = 1.4; // room around the outermost pins so none sits on the edge

/**
 * The full-screen region that shows `points` inside the visible strip. Computed here instead of with the map's
 * own padding, because iOS squeezes padded camera moves into a sliver and lands zoomed out to half of Texas.
 */
export function regionFor(points: LatLng[], view: Viewport, maxLatitudeDelta = Infinity): Region | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  const strip = Math.max(view.bottom - view.top, 1);
  const cos = Math.cos((midLat * Math.PI) / 180);
  // Tall enough that the pins' north-south span fills the strip, wide enough that their east-west span fits.
  const fromLat = Math.max(maxLat - minLat, MIN_SPAN) * MARGIN * (view.height / strip);
  const fromLng = Math.max(maxLng - minLng, MIN_SPAN) * MARGIN * cos * (view.height / view.width);
  // A cap lets a cluster tap always zoom in, even when its daycares sit closer together than MIN_SPAN.
  const latitudeDelta = Math.min(Math.max(fromLat, fromLng), maxLatitudeDelta);
  const longitudeDelta = (latitudeDelta * view.width) / view.height / cos;

  // Move the camera south so the pins' middle lands in the middle of the strip, not under the sheet.
  const stripMiddle = (view.top + view.bottom) / 2;
  const latitude = midLat - ((view.height / 2 - stripMiddle) / view.height) * latitudeDelta;
  return { latitude, longitude: midLng, latitudeDelta, longitudeDelta };
}
