-- Client mistakes get a 4xx, never a 500. PostgREST turns SQLSTATE PTxyz into HTTP xyz, so watch answers an
-- unknown daycare with 404 and the 100-watch limit with 409 (they were P0002 and 54000, which PostgREST sends
-- as 500). register_device also refuses a token over 200 characters or with spaces or brackets inside it (a
-- real Expo token is about 41), so a client cannot park a 20,000-character string in app.devices.
-- Same signatures, so the grants from 20261024210500_rpc.sql stand.

create or replace function public.watch(p_operation_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  if not exists (select 1 from core.daycares d where d.operation_id = p_operation_id) then
    raise exception 'unknown operation_id %', p_operation_id using errcode = 'PT404';
  end if;
  if (select count(*) from app.watches w where w.user_id = v_uid) >= 100 then
    raise exception 'watch limit reached (100)' using errcode = 'PT409';
  end if;
  insert into app.watches (user_id, operation_id)
  values (v_uid, p_operation_id)
  on conflict do nothing;
end
$$;

create or replace function public.register_device(p_expo_push_token text, p_platform text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sign-in required' using errcode = '42501';
  end if;
  if p_expo_push_token is null or length(p_expo_push_token) > 200
     or p_expo_push_token !~ '^Expo(nent)?PushToken\[[^]\s]+\]$' then
    raise exception 'not an Expo push token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'platform must be ios or android' using errcode = '22023';
  end if;
  insert into app.devices (expo_push_token, user_id, platform, last_seen, disabled_at)
  values (p_expo_push_token, v_uid, p_platform::public.device_platform, now(), null)
  on conflict (expo_push_token) do update
     set user_id = excluded.user_id,
         platform = excluded.platform,
         last_seen = now(),
         disabled_at = null;
end
$$;
