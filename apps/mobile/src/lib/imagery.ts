/**
 * Home daycares are private residences (docs/PRIVACY.md): no satellite or aerial imagery of
 * them anywhere, and their place map stays at neighborhood zoom with no pin on a house. Centers are unchanged.
 */
export const RESIDENCE_TYPES = ['Licensed Child-Care Home', 'Registered Child-Care Home', 'Listed Family Home'] as const;

export function isResidence(operationType: string | null | undefined): boolean {
  return (RESIDENCE_TYPES as readonly string[]).includes(operationType ?? '');
}

/** Whether a daycare may show aerial imagery (map snapshots, satellite hero, flyover). Unknown types get none. */
export function imageryAllowed(operationType: string | null | undefined): boolean {
  return operationType === 'Licensed Center';
}

/** The closest a place map may zoom for this daycare. */
export function maxPlaceZoom(operationType: string | null | undefined): number {
  return imageryAllowed(operationType) ? 18 : 14;
}
