-- PATCH FINAL - connexion par code + boîte à idées + gestion des membres
create table if not exists public.ideas (
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.members(id) on delete cascade,
 content text not null check (length(trim(content)) > 0), status text not null default 'new' check (status in ('new','read','processed')),
 admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_ideas_status on public.ideas(status);
create index if not exists idx_ideas_member on public.ideas(member_id);
alter table public.ideas enable row level security;
do $$ begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='ideas' and policyname='ideas_read_own_or_admin') then
  create policy ideas_read_own_or_admin on public.ideas for select to authenticated using (member_id = public.current_member_id() or public.is_admin());
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='ideas' and policyname='ideas_insert_own') then
  create policy ideas_insert_own on public.ideas for insert to authenticated with check (member_id = public.current_member_id());
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='ideas' and policyname='ideas_update_admin') then
  create policy ideas_update_admin on public.ideas for update to authenticated using (public.is_admin()) with check (public.is_admin());
 end if;
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='ideas' and policyname='ideas_delete_admin') then
  create policy ideas_delete_admin on public.ideas for delete to authenticated using (public.is_admin());
 end if;
end $$;

create or replace function public.login_with_code(p_access_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_member public.members%rowtype; v_uid uuid := auth.uid();
begin
 if v_uid is null then return jsonb_build_object('success',false,'message','Session de connexion absente'); end if;
 select * into v_member from public.members where access_code_hash = crypt(upper(trim(p_access_code)), access_code_hash) and active=true limit 1;
 if not found then return jsonb_build_object('success',false,'message','Code incorrect ou compte désactivé'); end if;
 update public.members set auth_user_id=v_uid, updated_at=now() where id=v_member.id;
 return jsonb_build_object('success',true,'member',jsonb_build_object('id',v_member.id,'first_name',v_member.first_name,'last_name',v_member.last_name,'role',v_member.role,'active',v_member.active));
end; $$;

create or replace function public.create_member(p_first_name text,p_last_name text,p_code text,p_role text default 'user',p_email text default null,p_phone text default null)
returns jsonb language plpgsql security definer set search_path=public as $$ declare v_id uuid;
begin
 if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
 if length(trim(p_code))<4 then raise exception 'Le code doit contenir au moins 4 caractères'; end if;
 if p_role not in ('user','admin') then raise exception 'Rôle invalide'; end if;
 insert into public.members(first_name,last_name,access_code_hash,role,email,phone,active) values(trim(p_first_name),trim(p_last_name),crypt(upper(trim(p_code)),gen_salt('bf')),p_role,p_email,p_phone,true) returning id into v_id;
 return jsonb_build_object('success',true,'id',v_id);
end; $$;

create or replace function public.set_member_code(p_member_id uuid,p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
 if length(trim(p_code))<4 then raise exception 'Le code doit contenir au moins 4 caractères'; end if;
 update public.members set access_code_hash=crypt(upper(trim(p_code)),gen_salt('bf')),updated_at=now() where id=p_member_id;
 return jsonb_build_object('success',true);
end; $$;

create or replace function public.set_member_active(p_member_id uuid,p_active boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
 update public.members set active=p_active,updated_at=now() where id=p_member_id;
 return jsonb_build_object('success',true);
end; $$;

do $$ begin
 if not exists (select 1 from pg_policies where schemaname='public' and tablename='members' and policyname='members_admin_write') then
  create policy members_admin_write on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());
 end if;
end $$;
