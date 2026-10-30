-- Public place discussions are separate from private itinerary notes.
begin;
create table public.place_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_key text not null check (char_length(source_key) between 7 and 500 and source_key ~ '^(place|explore):.+'),
  body text not null check (char_length(btrim(body)) between 1 and 2000 and octet_length(body)<=8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index place_comments_thread on public.place_comments(source_key,created_at desc,id desc);
create index place_comments_author on public.place_comments(author_id,created_at desc);
alter table public.place_comments enable row level security;
create policy place_comments_own on public.place_comments for all to authenticated
  using ((select auth.uid())=author_id and coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check ((select auth.uid())=author_id and coalesce(auth.jwt()->>'is_anonymous','true')='false');
revoke all on public.place_comments from anon,authenticated;
grant select,delete on public.place_comments to authenticated;
grant insert(source_key,body),update(body) on public.place_comments to authenticated;

create function public.place_comments_guard() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.author_id::text,382));
    if (select count(*) from public.place_comments where author_id=new.author_id)>=1000 then
      raise exception 'Your comment limit is 1,000. Remove older comments before posting more.';
    end if;
    if (select count(*) from public.place_comments where author_id=new.author_id and created_at>now()-interval '1 hour')>=20 then
      raise exception 'Please wait before posting more comments (20 per hour).';
    end if;
  end if;
  new.body=btrim(new.body);new.updated_at=now();
  return new;
end $$;
revoke all on function public.place_comments_guard() from public,anon,authenticated;
create trigger place_comments_guard before insert or update on public.place_comments
  for each row execute function public.place_comments_guard();

-- Only this safe projection is public. Never expose profile email or author UUID.
create function public.place_comments_list(p_source_key text,p_offset integer default 0)
returns table(id uuid,body text,created_at timestamptz,updated_at timestamptz,handle text,emoji text,mine boolean)
language sql stable security definer set search_path='' as $$
  select c.id,c.body,c.created_at,c.updated_at,coalesce(p.handle,'Austin neighbor'),coalesce(p.emoji,'🙂'),
    coalesce(c.author_id=auth.uid() and coalesce(auth.jwt()->>'is_anonymous','true')='false',false)
  from public.place_comments c left join public.profiles p on p.id=c.author_id
  where c.source_key=p_source_key order by c.created_at desc,c.id desc
  limit 30 offset greatest(0,least(coalesce(p_offset,0),10000));
$$;
revoke all on function public.place_comments_list(text,integer) from public;
grant execute on function public.place_comments_list(text,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
