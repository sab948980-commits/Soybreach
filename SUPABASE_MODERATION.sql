-- SOYBREACH moderation migration
-- Run this in Supabase SQL Editor AFTER the original setup SQL.

-- 1) Posts require approval. Existing posts are approved so this does not hide them.
alter table public.posts add column if not exists approved boolean not null default true;

-- 2) Private moderation table. This keeps role/ban state out of the public profiles table.
create table if not exists public.moderation_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  banned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.moderation_users enable row level security;

-- No public SELECT/INSERT/UPDATE/DELETE policies are intentionally provided.
-- Moderation is performed through security-definer functions below.

create or replace function public.is_admin_or_moderator()
returns boolean language sql security definer set search_path=public stable as $$
  select exists (select 1 from public.moderation_users where id=auth.uid() and role in ('admin','moderator') and banned=false);
$$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path=public stable as $$
  select exists (select 1 from public.moderation_users where id=auth.uid() and role='admin' and banned=false);
$$;

create or replace function public.is_banned_user()
returns boolean language sql security definer set search_path=public stable as $$
  select exists (select 1 from public.moderation_users where id=auth.uid() and banned=true);
$$;

create or replace function public.get_my_moderation_status()
returns table(is_admin boolean, is_moderator boolean, banned boolean)
language sql security definer set search_path=public as $$
  select
    exists(select 1 from public.moderation_users where id=auth.uid() and role='admin' and banned=false),
    exists(select 1 from public.moderation_users where id=auth.uid() and role in ('admin','moderator') and banned=false),
    exists(select 1 from public.moderation_users where id=auth.uid() and banned=true);
$$;

create or replace function public.list_moderation_users()
returns table(id uuid, username text, banned boolean, role text)
language sql security definer set search_path=public as $$
  select p.id,p.username,coalesce(m.banned,false),coalesce(m.role,'user')
  from public.profiles p left join public.moderation_users m on m.id=p.id
  where public.is_admin_or_moderator()
  order by p.username;
$$;

create or replace function public.set_user_banned(target_user_id uuid, should_ban boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin_or_moderator() then raise exception 'Not authorized'; end if;
  if target_user_id = auth.uid() then raise exception 'You cannot ban yourself'; end if;
  insert into public.moderation_users(id,role,banned) values(target_user_id,'user',should_ban)
  on conflict (id) do update set banned=excluded.banned;
end; $$;

-- Never allow a normal user to approve their own post, even if they try to modify the API request.
create or replace function public.enforce_post_approval()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.approved=true and not public.is_admin_or_moderator() then
    new.approved=false;
  end if;
  return new;
end; $$;

drop trigger if exists enforce_post_approval on public.posts;
create trigger enforce_post_approval
before insert or update on public.posts
for each row execute procedure public.enforce_post_approval();

-- Replace public SELECT policy so only approved posts are public; admins/mods can see pending posts.
drop policy if exists "Anyone can view posts" on public.posts;
create policy "Public can view approved posts"
on public.posts for select to anon, authenticated
using (approved=true or user_id=auth.uid() or public.is_admin_or_moderator());

-- Only admins/moderators may approve/edit any post; owners can still update their own pending posts.
drop policy if exists "Users can update own posts" on public.posts;
create policy "Owners and moderators can update posts"
on public.posts for update to authenticated
using (user_id=auth.uid() or public.is_admin_or_moderator())
with check (user_id=auth.uid() or public.is_admin_or_moderator());

-- Owners can delete their own posts; moderators/admins can delete any post.
drop policy if exists "Users can delete own posts" on public.posts;
create policy "Owners and moderators can delete posts"
on public.posts for delete to authenticated
using (user_id=auth.uid() or public.is_admin_or_moderator());

-- Block banned users from creating posts/comments.
drop policy if exists "Users can insert posts" on public.posts;
create policy "Non-banned users can insert posts"
on public.posts for insert to authenticated
with check (user_id=auth.uid() and not public.is_banned_user());

drop policy if exists "Users can insert comments" on public.comments;
create policy "Non-banned users can insert comments"
on public.comments for insert to authenticated
with check (user_id=auth.uid() and not public.is_banned_user());

-- Make the frontend's public feed show only approved posts by default.
-- Existing posts remain approved because the column was created with default true.

-- IMPORTANT: after you register your own account, make yourself the first admin:
-- Replace the email below with your account email and run this ONCE:
-- insert into public.moderation_users(id,role,banned)
-- select id,'admin',false from auth.users where email='YOUR-EMAIL-HERE'
-- on conflict (id) do update set role='admin',banned=false;


-- ADMIN LIST
-- The website also contains admins.js, where public admin names/colors are listed.
-- IMPORTANT: admins.js is NOT the security boundary because GitHub Pages is public.
-- Supabase moderation_users/RLS remains the authority for actual permissions.
-- Put Groot3 in the database as an admin when that account exists:
-- insert into public.moderation_users(id,role,banned)
-- select p.id,'admin',false from public.profiles p where p.username='Groot3'
-- on conflict (id) do update set role='admin', banned=false;
