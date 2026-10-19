-- Integration checks. Everything created in this transaction is rolled back.
-- Use only in the Pasanaku project after applying schema.sql.
begin;
insert into auth.users(id) values
 ('9c37df4a-4d4a-41e2-9e18-74cc0bb56ca1'),
 ('d438dfd0-7b85-4f9b-9cb3-a9345b1165b2');
select set_config('request.jwt.claim.sub','9c37df4a-4d4a-41e2-9e18-74cc0bb56ca1',true);
set local role authenticated;
select public.save_pasanaku('{"schema":2,"groups":[],"active":null}'::jsonb,0);
select public.save_pasanaku('{"schema":2,"groups":[],"active":null}'::jsonb,1);
do $$ begin
 if (select version from public.pasanaku_workspaces) <> 2 then
   raise exception 'TEST FAILED: version increment';
 end if;
 if (select count(*) from public.pasanaku_versions) <> 2 then
   raise exception 'TEST FAILED: snapshot history';
 end if;
 begin
   perform public.save_pasanaku('{"schema":2,"groups":[],"active":null}'::jsonb,0);
   raise exception 'TEST FAILED: stale version accepted';
 exception when others then
   if SQLERRM not like 'Otro dispositivo%' then raise; end if;
 end;
 begin
   update public.pasanaku_workspaces set version=100;
   raise exception 'TEST FAILED: direct write accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','d438dfd0-7b85-4f9b-9cb3-a9345b1165b2',true);
do $$ begin
 if (select count(*) from public.pasanaku_workspaces) <> 0 then
   raise exception 'TEST FAILED: another account can read workspace';
 end if;
 if (select count(*) from public.pasanaku_versions) <> 0 then
   raise exception 'TEST FAILED: another account can read snapshots';
 end if;
end $$;
select public.save_pasanaku('{"schema":2,"groups":[],"active":null}'::jsonb,0);
do $$ begin
 if (select count(*) from public.pasanaku_workspaces) <> 1 then
   raise exception 'TEST FAILED: account isolation';
 end if;
end $$;
set local role anon;
do $$ begin
 begin
   perform public.save_pasanaku('{"schema":2,"groups":[],"active":null}'::jsonb,0);
   raise exception 'TEST FAILED: anonymous write accepted';
 exception when insufficient_privilege then null;
 end;
 begin
   perform count(*) from public.pasanaku_workspaces;
   raise exception 'TEST FAILED: anonymous read accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS: account isolation, anonymous access blocked, direct writes blocked, version conflicts rejected, snapshots saved. Test data rolled back.' as verification;
