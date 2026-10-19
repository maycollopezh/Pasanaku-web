-- Run once in the SQL editor of your own Supabase project.
-- Authentication users are created from Supabase > Authentication > Users.
begin;
create table if not exists public.pasanaku_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'schema' = '2'),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table if not exists public.pasanaku_versions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  version bigint not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (owner_id, version)
);
alter table public.pasanaku_workspaces enable row level security;
alter table public.pasanaku_versions enable row level security;
drop policy if exists "Read own workspace" on public.pasanaku_workspaces;
create policy "Read own workspace" on public.pasanaku_workspaces for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Read own versions" on public.pasanaku_versions;
create policy "Read own versions" on public.pasanaku_versions for select to authenticated using ((select auth.uid()) = owner_id);
revoke all on public.pasanaku_workspaces, public.pasanaku_versions from anon, authenticated;
grant select on public.pasanaku_workspaces, public.pasanaku_versions to authenticated;
create or replace function public.save_pasanaku(p_payload jsonb, p_expected bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  account uuid := auth.uid();
  current_version bigint;
  next_version bigint;
begin
  if account is null then raise exception 'Inicia sesión para guardar.'; end if;
  if p_payload is null or p_payload->>'schema' is distinct from '2'
    or jsonb_typeof(p_payload->'groups') is distinct from 'array'
    or pg_column_size(p_payload) > 10000000 then
    raise exception 'Respaldo inválido o demasiado grande.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(account::text, 0));
  select version into current_version from public.pasanaku_workspaces where owner_id = account;
  current_version := coalesce(current_version, 0);
  if p_expected is distinct from current_version then
    raise exception 'Otro dispositivo guardó cambios. Descarga tu copia local y consulta la nube antes de continuar.';
  end if;
  next_version := current_version + 1;
  insert into public.pasanaku_workspaces(owner_id,payload,version) values(account,p_payload,next_version)
    on conflict(owner_id) do update set payload=excluded.payload, version=excluded.version, updated_at=now();
  insert into public.pasanaku_versions(owner_id,version,payload) values(account,next_version,p_payload);
  return next_version;
end;
$$;
revoke all on function public.save_pasanaku(jsonb,bigint) from public, anon;
grant execute on function public.save_pasanaku(jsonb,bigint) to authenticated;
commit;
