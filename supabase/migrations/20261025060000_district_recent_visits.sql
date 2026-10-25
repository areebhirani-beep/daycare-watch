-- district_recent_visits: the newest state visits to daycares inside TX-04 (by geocoded point),
-- up to the end of the last complete Mon-Sun week. If that week has fewer than p_limit visits,
-- the list continues into earlier weeks (newest available).
-- Home-based daycares are private residences: name and address are never returned, and the
-- row is labelled by type and city instead.

create or replace function public.district_recent_visits(p_limit integer default 6)
returns table (
  activity_id bigint,
  date date,
  operation_id bigint,
  name text,
  display_name text,
  city text,
  operation_type text,
  is_home boolean,
  findings_posted_so_far integer,
  categories public.violation_category[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with wk as (
    select (date_trunc('week', core.today()::timestamp) - interval '1 day')::date as week_end
  ),
  v as (
    select i.activity_id, i.activity_date, i.activity_at, d.operation_id, d.name, d.city, d.operation_type,
           d.operation_type <> 'Licensed Center' as is_home,
           -- The state publishes cities in capitals; initcap would print 'Mckinney', so fix the Mc prefix.
           coalesce(regexp_replace(initcap(d.city), '^Mc([a-z])', 'Mc' || upper(substr(initcap(d.city), 3, 1))), 'Texas') as city_label
      from core.inspections i
      join core.daycares d on d.operation_id = i.operation_id
      cross join wk
     where d.in_district
       and d.district_basis = 'point'
       and d.operation_type = any (core.in_scope_types())
       and d.operation_status is distinct from 'N'
       and i.activity_date <= wk.week_end
     order by i.activity_at desc, i.activity_id desc
     limit least(greatest(coalesce(district_recent_visits.p_limit, 6), 1), 50)
  )
  select v.activity_id,
         v.activity_date,
         v.operation_id,
         case when v.is_home then null else v.name end,
         case
           when not v.is_home then v.name
           when v.operation_type = 'Licensed Child-Care Home'   then 'A licensed child-care home in '   || v.city_label
           when v.operation_type = 'Registered Child-Care Home' then 'A registered child-care home in ' || v.city_label
           else                                                      'A listed family home in '         || v.city_label
         end,
         v.city,
         v.operation_type,
         v.is_home,
         coalesce(f.n, 0),
         coalesce(f.categories, '{}')
    from v
    left join lateral (
      select count(*)::integer as n,
             array_agg(distinct x.category order by x.category) as categories
        from core.violations x
       where x.activity_id = v.activity_id
    ) f on true
   order by v.activity_at desc, v.activity_id desc
$$;

revoke all on function public.district_recent_visits(integer) from public, service_role;
grant execute on function public.district_recent_visits(integer) to anon, authenticated;
