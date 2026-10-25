-- When the pipeline last sent this address to the Census geocoder, matched or not,
-- so unmatched addresses are not re-sent every night.
alter table core.daycares add column if not exists geocode_attempted_at timestamptz;
