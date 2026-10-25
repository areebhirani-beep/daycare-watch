#!/usr/bin/env bash
# Rebuild supabase/tests/fixtures/real_rows.psql: the real records the pgTAP tests name, copied from a
# database the pipeline loaded from data.texas.gov. Tests include the file inside their own transaction, so
# they pass on a fresh clone (seed only) and on a fully loaded database alike, and nothing is kept.
# Home daycares are private residences: their street fields become 'withheld for privacy', the ZIP keeps 5 digits
# and the point is rounded to 2 decimals at capture, so this public file never republishes where a home is (docs/PRIVACY.md).
#
# Usage: supabase/fixtures/capture_test_rows.sh   (reads the local stack's database container)
set -euo pipefail

DB_CONTAINER=${DB_CONTAINER:-supabase_db_daycare-watch}
OUT="$(cd "$(dirname "$0")/.." && pwd)/tests/fixtures/real_rows.psql"

# Viva World School (Rockwall, census exact, 5853 Horizon Rd), one KinderCare, one licensed center with a
# non-exact geocode (Bethel Early Learning Center), and the daycares behind the
# six TX-04 visits district_recent_visits returns when today is 2026-10-25, and one daycare (245451) whose newest
# activity is its own self-report (904024902) after an inspection (903884663).
OPS="1459611,94796,94225,507034,1442993,1515820,1512927,929797,1385267,245451"
ACTS="903901052,903982555,904007385,904006573,903908160,903966727,904024902,903884663"

mkdir -p "$(dirname "$OUT")"
docker exec -i "$DB_CONTAINER" psql -U postgres -X -q -At -v ON_ERROR_STOP=1 > "$OUT" <<SQL
select '-- Real records from data.texas.gov as loaded by the pipeline, captured '
       || to_char(now() at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') || ' CT by supabase/fixtures/capture_test_rows.sh.';
select '-- Included by tests inside their transaction; a row that already exists is left alone.';
select '-- Home daycares: street fields are ''withheld for privacy'' and the point is rounded to 2 decimals, so';
select '-- this public file never shows where a home is. The API hides them anyway; the tests prove that.';

create temp view cols as
select c.relname as tbl, string_agg(quote_ident(a.attname), ', ' order by a.attnum) as list
  from pg_attribute a join pg_class c on c.oid = a.attrelid
 where c.relnamespace = 'core'::regnamespace and c.relname in ('daycares', 'inspections', 'violations')
   and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
 group by c.relname;

select format('insert into core.%I (%s) select %s from json_populate_record(null::core.%I, %L) on conflict do nothing;',
              k.tbl, k.list, k.list, k.tbl, j)
  from (select 'daycares' as tbl,
               (to_jsonb(d) || case when d.operation_type <> 'Licensed Center' then jsonb_build_object(
                  'address', 'withheld for privacy', 'address_line', 'withheld for privacy',
                  'geocode_address', 'withheld for privacy', 'zip', left(d.zip, 5),
                  'geom', extensions.st_setsrid(extensions.st_makepoint(
                            round(extensions.st_x(d.geom::extensions.geometry)::numeric, 2),
                            round(extensions.st_y(d.geom::extensions.geometry)::numeric, 2)), 4326)::extensions.geography)
                else '{}'::jsonb end)::text as j, 1 as o, d.operation_id as id
          from core.daycares d where d.operation_id in ($OPS)
        union all
        select 'inspections', row_to_json(i)::text, 2, i.activity_id
          from core.inspections i where i.activity_id in ($ACTS)
        union all
        select 'violations', row_to_json(v)::text, 3, v.non_compliance_id
          from core.violations v where v.activity_id in ($ACTS)) r
  join cols k on k.tbl = r.tbl
 order by r.o, r.id;
SQL

echo "wrote $OUT ($(grep -c '^insert' "$OUT") rows)"
