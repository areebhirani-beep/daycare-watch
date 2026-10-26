-- Home daycares are private residences: the API never returns a home's street or a point finer
-- than 2 decimals or a ZIP+4, daycares_near can't be probed to find a home's real point, search never matches a home on its street or ZIP+4, and district_recent_visits stays
-- name-free. Also the photo age rule (no photo before the permit or older than 6 years).
begin;
create extension if not exists pgtap with schema extensions;
-- Real records the asserts below name, so they hold on a fresh clone too (rolled back with the test).
\ir fixtures/real_rows.psql
select plan(16);

create temp table h on commit drop as
select d.operation_id, d.name, d.address, d.city, d.zip,
       extensions.st_y(d.geom::extensions.geometry) as lat, extensions.st_x(d.geom::extensions.geometry) as lng
  from core.daycares d
 where d.operation_type <> 'Licensed Center' and d.address is not null and d.geom is not null
   and d.operation_status is distinct from 'N'
 order by d.operation_id
 limit 1;
grant select on h to anon;

set local role anon;

select ok(
  (select bool_and(s.address is null) from h, public.daycare_search(h.name) s where s.operation_id = h.operation_id),
  'daycare_search returns no street for a home');

select ok(
  (select bool_and(s.lat = round(s.lat::numeric, 2)::float8 and s.lng = round(s.lng::numeric, 2)::float8)
     from h, public.daycare_search(h.name) s where s.operation_id = h.operation_id),
  'daycare_search returns a home point rounded to 2 decimals');

select ok(
  (select bool_and(n.lat = round(n.lat::numeric, 2)::float8
                   and n.distance_km = round(n.distance_km::numeric, 1)::float8)
     from h, public.daycares_near(h.lat, h.lng, 2, '{}') n
    where n.operation_type <> 'Licensed Center'),
  'daycares_near: every home has a 2-decimal point and a 0.1 km distance');

select ok(
  (select (public.daycare_record(h.operation_id) -> 'daycare' ->> 'address') is null from h),
  'daycare_record header returns no street for a home');

select ok(
  (select (public.daycare_record(h.operation_id) -> 'daycare' ->> 'lat')::numeric
          = round((public.daycare_record(h.operation_id) -> 'daycare' ->> 'lat')::numeric, 2) from h),
  'daycare_record header returns a 2-decimal point for a home');

select is(
  (select count(*) from h, public.daycare_search(split_part(h.address, ' ', 1) || ' ' || split_part(h.address, ' ', 2)) s
    where s.operation_id = h.operation_id),
  0::bigint, 'searching a home''s street number and street does not find it');

select ok(
  (select count(*) > 0 from public.daycare_search('5853 Horizon') where address ilike '5853 HORIZON%'),
  'a licensed center is still found by its street');

select is(
  (select count(*) from public.district_recent_visits(50) where is_home and (name is not null or display_name !~ '^A ')),
  0::bigint, 'district_recent_visits stays name-free for homes');

select is(
  (select count(*) from public.daycares_near(33.2, -96.7, 50, '{}') n
    where to_jsonb(n) ?| array['address', 'zip', 'county']),
  0::bigint, 'daycares_near returns no street, ZIP or county for any row (the record has them)');

select ok(
  (select (public.daycare_record(h.operation_id) -> 'daycare' ->> 'zip') ~ '^[0-9]{5}$' from h),
  'daycare_record header returns a 5-digit ZIP for a home');

select is(
  (select count(*) from h, public.daycare_search(h.zip) s where length(h.zip) > 5 and s.operation_id = h.operation_id),
  0::bigint, 'searching a home''s ZIP+4 does not find it');

reset role;

-- Probing daycares_near for a home's real point. For the test (rolled back) a home's point is moved 0.004 degrees
-- north and east of its 2-decimal public point, about 600 m, so the real and public points are known to differ.
create temp table hp on commit drop as
select operation_id,
       round(extensions.st_y(geom::extensions.geometry)::numeric, 2)::float8 as pub_lat,
       round(extensions.st_x(geom::extensions.geometry)::numeric, 2)::float8 as pub_lng
  from core.daycares
 where operation_type <> 'Licensed Center' and operation_type = any (core.in_scope_types())
   and geom is not null and operation_status is distinct from 'N'
 order by operation_id
 limit 1;
update core.daycares d
   set geom = extensions.st_setsrid(extensions.st_makepoint(hp.pub_lng + 0.004, hp.pub_lat + 0.004), 4326)::extensions.geography
  from hp where d.operation_id = hp.operation_id;
-- A spot 950 m past the real point, on the side away from the public point: a 1 km circle there holds the real
-- point but not the public one.
create temp table probe on commit drop as
select hp.operation_id, extensions.st_y(o::extensions.geometry) as lat, extensions.st_x(o::extensions.geometry) as lng
  from hp, lateral (
    select extensions.st_project(
             extensions.st_setsrid(extensions.st_makepoint(hp.pub_lng + 0.004, hp.pub_lat + 0.004), 4326)::extensions.geography,
             950,
             extensions.st_azimuth(
               extensions.st_setsrid(extensions.st_makepoint(hp.pub_lng, hp.pub_lat), 4326)::extensions.geography,
               extensions.st_setsrid(extensions.st_makepoint(hp.pub_lng + 0.004, hp.pub_lat + 0.004), 4326)::extensions.geography)
           )::extensions.geography as o) x;
grant select on hp, probe to anon;

set local role anon;
select is(
  (select count(*) from probe p, public.daycares_near(p.lat, p.lng, 1, '{}') n where n.operation_id = p.operation_id),
  0::bigint, 'a 1 km circle that holds a home''s real point but not its public point does not return it');

select is(
  (select count(*) from hp, public.daycares_near(hp.pub_lat + 0.004, hp.pub_lng + 0.004, 0.005, '{}') n
    where n.operation_id = hp.operation_id),
  (select count(*) from hp, public.daycares_near(hp.pub_lat, hp.pub_lng, 0.005, '{}') n
    where n.operation_id = hp.operation_id),
  'a 5 m probe at a home''s real point answers the same as one at its public point');

select is(
  (select count(*) from hp, public.daycares_near(hp.pub_lat + 0.004, hp.pub_lng + 0.004, 0.005, '{}')),
  (select count(*) from hp, public.daycares_near(hp.pub_lat + 0.004, hp.pub_lng + 0.004, 1, '{}')),
  'a radius under 1 km searches 1 km');
reset role;

-- Photo age rule, on a real exact-geocoded licensed center (rolled back). A person checked each verified photo shows
-- this daycare, so the permit date no longer hides one; the 6-year limit still does.
create temp table c on commit drop as
select operation_id, issuance_date from core.daycares
 where operation_type = 'Licensed Center' and geocode_source = 'census' and geocode_quality = 'exact'
   and issuance_date > date '2021-01-01'
 order by operation_id limit 1;
grant select on c to anon;

delete from core.daycare_photos where operation_id = (select operation_id from c);
insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m, verified, verified_at)
select operation_id, 'qa-before-permit', issuance_date - 30, 5, true, now() from c
union all select operation_id, 'qa-current', now() - interval '30 days', 5, true, now() from c;

set local role anon;
select is(
  (select jsonb_agg(p ->> 'image_id') from c, jsonb_array_elements(public.daycare_record(c.operation_id) -> 'photos') p),
  '["qa-current", "qa-before-permit"]'::jsonb, 'a verified photo taken before the permit was issued is still shown');
reset role;

update core.daycare_photos set captured_at = now() - interval '7 years'
 where operation_id = (select operation_id from c) and image_id = 'qa-current';
delete from core.daycare_photos where operation_id = (select operation_id from c) and image_id = 'qa-before-permit';
set local role anon;
select is(
  (select jsonb_array_length(public.daycare_record(c.operation_id) -> 'photos') from c),
  0, 'a photo older than 6 years is dropped');
reset role;

select * from finish();
rollback;
