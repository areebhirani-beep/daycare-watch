// Client-facing shapes for the RPCs in supabase/migrations/20261024210500_rpc.sql.
// types.ts is generated (`supabase gen types typescript --local`); never edit it by hand.
// Enums and table-returning RPCs derive from it. The jsonb RPCs (daycare_record,
// area_compare, district_pulse, alert_detail, last_sync) come back as Json there, so their
// shapes are pinned here; supabase/tests/003_rpc.test.sql asserts the same keys in SQL.

import type { Database } from './types';

export type { Database, Json } from './types';

type PublicSchema = Database['public'];
type Rpc = PublicSchema['Functions'];

export type RiskLevel = PublicSchema['Enums']['risk_level'];
export type Category = PublicSchema['Enums']['violation_category'];
export type ChangeKind = PublicSchema['Enums']['change_kind'];
export type DevicePlatform = PublicSchema['Enums']['device_platform'];

type NullableKeys =
  | 'address' | 'city' | 'zip' | 'county' | 'lat' | 'lng' | 'distance_km'
  | 'capacity' | 'last_inspection_date' | 'district_basis' | 'geocode_source' | 'geocode_quality';

type Enumerated = 'district_basis' | 'geocode_source' | 'geocode_quality' | 'visits_24mo';

// One state visit in the last 24 months (core.daycare_visits). r = risk rank per finding
// (High 5 .. Low 1), o = 1 when that finding was neither corrected at the inspection nor
// verified by the state; r and o are parallel, sorted by r desc then o desc.
export type RowVisit = { d: string; n: number; r: number[]; o: (0 | 1)[] };

// Generated table-returning types mark every column non-null; these columns can be null.
export type DaycareRow = Omit<Rpc['daycares_near']['Returns'][number], NullableKeys | Enumerated> & {
  [K in Exclude<NullableKeys, Enumerated>]: Rpc['daycares_near']['Returns'][number][K] | null;
} & {
  district_basis: 'point' | 'county' | null;
  geocode_source: 'state' | 'census' | null; // null = no map point
  geocode_quality: 'exact' | 'non_exact' | null; // set only when geocode_source is 'census'
  visits_24mo: RowVisit[]; // oldest first; [] when no visits in the window
};

// daycare_record's header has no visits_24mo; the record carries the full inspections list.
export type DaycareHeader = Omit<DaycareRow, 'visits_24mo'> & {
  ages: string[];
  hours: string | null;
  days: string[];
  subsidies: boolean | null;
  status: 'active' | 'inactive' | null;
  corrective_action: boolean | null;
  adverse_action: boolean | null;
  temporarily_closed: boolean | null;
  conditions_on_permit: boolean | null;
  issuance_date: string | null;
};

export type Finding = {
  non_compliance_id: number;
  activity_id: number;
  date: string | null; // null only when the state's violation row did not join to a visit
  risk_level: RiskLevel;
  category: Category;
  plain: string | null;
  narrative: string | null;
  standard: string;
  corrected_at_inspection: boolean;
  corrected_date: string | null;
  verified_date: string | null;
  via_investigation: boolean;
  technical_assistance: boolean | null;
};

export type Inspection = {
  activity_id: number;
  date: string;
  type: 'INSPECTION' | 'REPORT' | 'ASSESSMENT';
  violation_found: 'Yes' | 'No' | 'Pending';
  findings_count: number; // findings cited at this visit
  high_count: number; // of those, risk level High
  open_count: number; // of those, neither corrected at the inspection nor verified by the state
};

// A Mapillary street-level image near the daycare (CC BY-SA; show the credit and captured date).
export type Photo = {
  image_id: string;
  captured_at: string;
  distance_m: number;
};

export type DaycareRecord = {
  daycare: DaycareHeader;
  findings: Finding[];
  inspections: Inspection[];
  photos: Photo[]; // [] unless a licensed center with an exact geocode; at most 3, newest first
  official_url: string;
  last_checked_at: string | null;
};

export type Stats = {
  inspections: number;
  inspections_with_findings: number;
  findings: number;
  findings_high: number;
};

export type AreaCompare = {
  county: string;
  operation_type: string;
  peer_count: number;
  window_months: 24;
  this: Stats;
  median: Stats; // medians can be fractional, e.g. 1.5
};

export type DistrictPulse = {
  week_start: string;
  week_end: string;
  visits: number;
  visits_with_findings: number;
  findings: number;
  findings_high: number;
  daycares_visited: number;
  by_category: { category: Category; n: number }[];
};

// district_recent_visits: newest TX-04 visits (by point), up to the end of the last complete week.
// Home daycares: name is null and display_name is 'A <type> in <City>'; show display_name, never an address.
export type DistrictRecentVisit = Omit<Rpc['district_recent_visits']['Returns'][number], 'name' | 'city'> & {
  name: string | null;
  city: string | null;
};

export type AlertDetail = {
  event_id: number;
  kind: ChangeKind;
  is_replay: boolean;
  detected_at: string;
  source_date: string | null;
  operation_id: number;
  daycare_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  finding: Finding | null;
};

export type LastSync = {
  finished_at: string | null;
  ok: boolean | null;
  newest_source_date: string | null;
};
