-- Home daycares are private residences: the API never returns a home's street or a point finer
-- than 2 decimals, search never matches a home on its street, and district_recent_visits stays
-- name-free. Also the photo age rule (no photo before the permit or older than 6 years).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create temp table h on commit drop as
select d.operation_id, d.name, d.address, d.city,
       extensions.st_y(d.geom::extensions.geometry) as lat, extensions.st_x(d.geom::extensions.geometry) as lng
  from core.daycares d
 where d.operation_type <> 'Licensed Center' and d.address ~ '^[0-9]+ ' and d.geom is not null
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
  (select bool_and(n.address is null and n.lat = round(n.lat::numeric, 2)::float8
                   and n.distance_km = round(n.distance_km::numeric, 1)::float8)
     from h, public.daycares_near(h.lat, h.lng, 2, '{}') n
    where n.operation_type <> 'Licensed Center'),
  'daycares_near: every home has no street, a 2-decimal point, and a 0.1 km distance');

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

reset role;

-- Photo age rule, on a real exact-geocoded licensed center (rolled back).
create temp table c on commit drop as
select operation_id, issuance_date from core.daycares
 where operation_type = 'Licensed Center' and geocode_source = 'census' and geocode_quality = 'exact'
   and issuance_date > date '2021-01-01'
 order by operation_id limit 1;
grant select on c to anon;

delete from core.daycare_photos where operation_id = (select operation_id from c);
insert into core.daycare_photos (operation_id, image_id, captured_at, distance_m)
select operation_id, 'qa-before-permit', issuance_date - 30, 5 from c
union all select operation_id, 'qa-current', now() - interval '30 days', 5 from c;

set local role anon;
select is(
  (select jsonb_agg(p ->> 'image_id') from c, jsonb_array_elements(public.daycare_record(c.operation_id) -> 'photos') p),
  '["qa-current"]'::jsonb, 'a photo taken before the permit was issued is dropped');
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
