-- daycare_search: exact, ZIP, city, typo, and no-hit queries on real names; and no function
-- carries a SET of an extension GUC (cloud roles may not set those, so a migration with one fails).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

set local role anon;

select ok((select count(*) >= 1 from public.daycare_search('Viva World') where name = 'Viva World School'),
          'exact name finds Viva World School');
select ok((select bool_and(zip like '75087%') from (select zip from public.daycare_search('75087') limit 5) s),
          'a ZIP query ranks that ZIP first');
select ok((select count(*) > 0 from public.daycare_search('Sherman') where city ilike 'Sherman'),
          'a city query finds daycares in that city');
select ok((select count(*) > 0 from public.daycare_search('Montesori') where name ilike '%Montessori%'),
          'typo "Montesori" finds Montessori schools');
select ok((select count(*) > 0 from public.daycare_search('Lionhart') where name ilike 'Lionheart%'),
          'typo "Lionhart" finds Lionheart (loose pass)');
select ok((select count(*) > 0 from public.daycare_search('Kinder Care') where name ilike '%KinderCare%'),
          '"Kinder Care" finds KinderCare');
select is((select count(*) from public.daycare_search('zzqxv')), 0::bigint, 'gibberish finds nothing');
select is((select count(*) from public.daycare_search('x')), 0::bigint, 'one character finds nothing');

reset role;

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
          unnest(p.proconfig) c
    where n.nspname in ('public', 'core', 'app', 'geo', 'ops', 'staging')
      and split_part(c, '=', 1) like '%.%'),
  0::bigint,
  'no function SETs an extension GUC (cloud would reject the migration)');

select * from finish();
rollback;
