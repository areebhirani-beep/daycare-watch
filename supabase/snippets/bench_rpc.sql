-- RPC latency check on the real backfill. Read-only; run with:
--   docker exec -i supabase_db_daycare-watch psql -U postgres -v ON_ERROR_STOP=1 < supabase/snippets/bench_rpc.sql
-- Each RPC runs 60 times over real operation ids and real coordinates; prints p50/p95/max in ms.
begin;
set local role anon;
create temp table bench (rpc text, ms float8) on commit drop;

do $$
declare
  ids bigint[];
  pts float8[][];
  t0 timestamptz;
  i int;
  terms text[] := array['Frisco', 'McKinney', '75034', 'Montessori', 'Rockwall', 'Kids', 'Learning', 'Sherman'];
begin
  reset role;
  select array_agg(operation_id order by operation_id) into ids
    from (select operation_id from core.daycares tablesample bernoulli (5) repeatable (42) limit 60) s;
  select array_agg(array[extensions.st_y(geom::extensions.geometry), extensions.st_x(geom::extensions.geometry)])
    into pts
    from (select geom from core.daycares where geom is not null
          order by operation_id limit 60) s;
  set local role anon;

  for i in 1 .. 60 loop
    t0 := clock_timestamp();
    perform public.daycares_near(pts[i][1], pts[i][2], 10, '{}'::jsonb);
    insert into bench values ('daycares_near 10km', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform public.daycares_near(pts[i][1], pts[i][2], 10, '{"in_district": true}'::jsonb);
    insert into bench values ('daycares_near in_district', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform public.daycare_search(terms[1 + (i % array_length(terms, 1))]);
    insert into bench values ('daycare_search', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform public.daycare_record(ids[1 + (i - 1) % array_length(ids, 1)]);
    insert into bench values ('daycare_record', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform public.area_compare(ids[1 + (i - 1) % array_length(ids, 1)]);
    insert into bench values ('area_compare', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform public.district_pulse(null);
    insert into bench values ('district_pulse', extract(epoch from clock_timestamp() - t0) * 1000);

    t0 := clock_timestamp();
    perform public.last_sync();
    insert into bench values ('last_sync', extract(epoch from clock_timestamp() - t0) * 1000);
  end loop;
end $$;

select rpc,
       count(*) as n,
       round(percentile_cont(0.5) within group (order by ms)::numeric, 1) as p50_ms,
       round(percentile_cont(0.95) within group (order by ms)::numeric, 1) as p95_ms,
       round(max(ms)::numeric, 1) as max_ms
  from bench group by rpc order by p95_ms desc;
rollback;
