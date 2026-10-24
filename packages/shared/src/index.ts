// Firestore data model shared by the web app, the sync job, and the security rules tests.
// Field names must match the Firestore documents exactly.

export const RISK_LEVELS = ["High", "Medium High", "Medium", "Medium Low", "Low"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const CATEGORIES = [
  "supervision",
  "background_checks",
  "staff_ratio",
  "safety_hazards",
  "health_medication",
  "discipline",
  "parent_communication",
  "paperwork_admin",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type ActivityType = "INSPECTION" | "ASSESSMENT" | "REPORT";

/** ISO 8601 date-time string, e.g. "2026-10-23T17:05:00.000" */
export type IsoDate = string;

export interface RiskCounts {
  high: number;
  mediumHigh: number;
  medium: number;
  mediumLow: number;
  low: number;
  total: number;
}

/** daycares/{operationId} */
export interface Daycare {
  operationId: string;
  name: string;
  type: string;
  address: string;
  city: string;
  county: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  capacity: number;
  ages: string[];
  hours: string;
  days: string;
  acceptsSubsidies: boolean;
  inDistrict: boolean;
  districtMethod: "polygon" | "county";
  counts: RiskCounts;
  inspections: number;
  lastInspectionAt: IsoDate | null;
  lastViolationAt: IsoDate | null;
  last12mo: { high: number; total: number };
  stateUrl: string;
  updatedAt: IsoDate;
}

/** daycares/{operationId}/violations/{nonComplianceId} */
export interface Violation {
  nonComplianceId: string;
  activityId: string;
  date: IsoDate;
  activityType: ActivityType;
  standard: string;
  riskLevel: RiskLevel;
  category: Category;
  /** One-line plain-English summary derived from the narrative; never adds facts. */
  plain: string;
  /** Inspector's narrative, verbatim. */
  narrative: string;
  correctedAtInspection: boolean;
  correctedDate: IsoDate | null;
  verifiedDate: IsoDate | null;
  viaInvestigation: boolean;
}

/** daycares/{operationId}/inspections/{activityId} */
export interface Inspection {
  activityId: string;
  date: IsoDate;
  type: ActivityType;
  violationFound: boolean;
}

/** users/{uid} — owner read/write only */
export interface UserDoc {
  watching: string[];
  fcmTokens: string[];
  createdAt: IsoDate;
}

/** alerts/{alertId} — written by sync only */
export interface Alert {
  uid: string;
  operationId: string;
  nonComplianceId: string;
  title: string;
  body: string;
  /** true when produced by demo replay of a real past record */
  replay: boolean;
  createdAt: IsoDate;
  sentAt: IsoDate | null;
}

/** meta/sync */
export interface SyncMeta {
  lastRunAt: IsoDate;
  sourceMaxActivityDate: IsoDate;
  counts: { daycares: number; violations: number; inDistrict: number };
  ok: boolean;
  error: string | null;
}

/** meta/district — every number computed by the sync job */
export interface DistrictMeta {
  centers: number;
  capacity: number;
  violations12mo: RiskCounts;
  byCategory12mo: Record<Category, number>;
  unfixed12mo: number;
  computedAt: IsoDate;
}

export const COLLECTIONS = {
  daycares: "daycares",
  violations: "violations",
  inspections: "inspections",
  users: "users",
  alerts: "alerts",
  meta: "meta",
} as const;

export const SOURCE_DATASETS = {
  operations: "bc5r-88dy",
  activities: "m5q4-3y3d",
  violations: "tqgd-mf4x",
  investigations: "txmx-ceda",
} as const;
