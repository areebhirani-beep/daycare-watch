import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';

import type { Photo } from './types';

// Mapillary street photos (CC BY-SA). We store only image ids; the image URL is signed and short-lived, so it is
// looked up when the photo is about to show and never saved.
const token = process.env.EXPO_PUBLIC_MAPILLARY_TOKEN;

// On: daycare_record returns only photos a person checked show that daycare's own building (verified = true), so an
// unchecked frame of the street never reaches the carousel.
export const SHOW_STREET_PHOTOS = true;

/** False when street photos are off or there is no token: the carousel is then Look Around and one view from above. */
export const photosEnabled = SHOW_STREET_PHOTOS && Boolean(token);

export async function photoUrl(imageId: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`https://graph.mapillary.com/${encodeURIComponent(imageId)}?fields=thumb_1024_url`, {
    headers: { Authorization: `OAuth ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Mapillary ${res.status}`);
  const body = (await res.json()) as { thumb_1024_url?: string };
  if (!body.thumb_1024_url) throw new Error('Mapillary: no image');
  // Start the download now, so the photo is ready by the time the page shows.
  void Image.prefetch(body.thumb_1024_url, 'memory-disk').catch(() => undefined);
  return body.thumb_1024_url;
}

/** The photo's URL once Mapillary answers; undefined while loading or if it fails (the page then shows its band). */
export function usePhotoUrl(imageId: string | null | undefined, enabled = true): string | undefined {
  const q = useQuery({
    queryKey: ['mapillary', imageId],
    queryFn: ({ signal }) => photoUrl(imageId!, signal),
    enabled: photosEnabled && enabled && Boolean(imageId),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  return q.data;
}

/** "Mar 2024": the month a photo was taken, so an old photo never passes for today's building. */
export function photoMonth(p: Pick<Photo, 'captured_at'>): string {
  const d = new Date(p.captured_at);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'America/Chicago' });
}
