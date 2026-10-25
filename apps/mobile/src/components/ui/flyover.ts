import { imageryAllowed } from '@/lib/imagery';
import type { DaycareHeader } from '@/lib/types';

/** A 3D view only for a licensed center whose address geocoded exactly. No native imports, so web can share it. */
export function flyoverAllowed(d: Pick<DaycareHeader, 'operation_type' | 'geocode_quality'> | null | undefined): boolean {
  return Boolean(d && imageryAllowed(d.operation_type) && d.geocode_quality === 'exact');
}
