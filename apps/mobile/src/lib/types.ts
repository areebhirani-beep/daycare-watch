// RPC return shapes pinned in CONTRACT.md section 4.1.
// Temporary until platform ships packages/db/types.ts; then these re-export from there.

import type { RiskLevel } from '@/theme/tokens';

export type Category =
  | 'supervision'
  | 'background_checks'
  | 'staff_ratio'
  | 'safety_hazards'
  | 'health_medication'
  | 'discipline'
  | 'parent_communication'
  | 'paperwork_admin'
  | 'other';

export type ChangeKind =
  | 'new_violation'
  | 'status_change'
  | 'corrective_action'
  | 'adverse_action'
  | 'closure'
  | 'capacity_change'
  | 'permit_conditions';

export type DaycareRow = {
  operation_id: number;
  name: string;
  operation_type: string;
  address: string | null;
  city: string | null;
  zip: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  distance_km: number | null;
  capacity: number | null;
  last_inspection_date: string | null;
  findings_24mo: number;
  in_district: boolean | null;
  district_basis: 'point' | 'county' | null;
};

export type DaycareHeader = DaycareRow & {
  ages: string[] | null;
  hours: string | null;
  days: string[] | string | null;
  subsidies: boolean | null;
  status: string | null;
  corrective_action: boolean | null;
  adverse_action: boolean | null;
  temporarily_closed: boolean | null;
  conditions_on_permit: boolean | null;
  issuance_date: string | null;
};

export type Finding = {
  non_compliance_id: number;
  activity_id: number;
  date: string;
  risk_level: RiskLevel;
  category: Category | null;
  plain: string | null;
  narrative: string | null;
  standard: string | null;
  corrected_at_inspection: boolean | null;
  corrected_date: string | null;
  verified_date: string | null;
  via_investigation: boolean | null;
  technical_assistance: boolean | null;
};

export type Inspection = {
  activity_id: number;
  date: string;
  type: 'INSPECTION' | 'REPORT' | 'ASSESSMENT' | string;
  violation_found: 'Yes' | 'No' | 'Pending' | string | null;
};

export type DaycareRecord = {
  daycare: DaycareHeader;
  findings: Finding[];
  inspections: Inspection[];
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
  window_months: number;
  this: Stats;
  median: Stats;
};

export type DistrictPulse = {
  week_start: string;
  week_end: string;
  visits: number;
  visits_with_findings: number;
  findings: number;
  daycares_visited: number;
  by_category: { category: Category; n: number }[];
};

export type AlertDetail = {
  event_id: number;
  kind: ChangeKind;
  is_replay: boolean;
  detected_at: string;
  operation_id: number;
  daycare_name: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  finding: Finding | null;
};

export type LastSync = {
  finished_at: string | null;
  ok: boolean | null;
  newest_source_date: string | null;
};
