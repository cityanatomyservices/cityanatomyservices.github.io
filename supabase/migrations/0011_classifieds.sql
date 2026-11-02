-- One self-managed, text-only classified per confirmed account. No public reads.
begin;
create schema classifieds_private;
revoke all on schema classifieds_private from public,anon,authenticated;
create table classifieds_private.categories (
  id text primary key, title text not null, position smallint not null unique
);
insert into classifieds_private.categories values
 ('for-sale','For Sale',1),('free','Free Stuff',2),('services','Services',3),
 ('housing','Housing',4),('jobs','Jobs',5),('gigs','Gigs',6),
 ('community','Community',7),('lost-found','Lost & Found',8);
create table classifieds_private.ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  category text not null references classifieds_private.categories(id),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 1000),
  revision bigint not null default 1 check (revision>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index classifieds_category on classifieds_private.ads(category,created_at desc,id desc);
alter table classifieds_private.categories enable row level security;
alter table classifieds_private.ads enable row level security;
revoke all on all tables in schema classifieds_private from public,anon,authenticated;

create function classifieds_private.member_id() returns uuid language plpgsql
stable security definer set search_path='' as $$
declare member uuid;
begin
  if coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then
    raise exception using errcode='42501',message='Create an account or sign in to use free classifieds.';
  end if;
  select u.id into member from auth.users u where u.id=auth.uid()
    and not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null;
  if member is null then
    raise exception using errcode='42501',message='Sign in with a confirmed account to use free classifieds.';
  end if;
  return member;
end $$;
create function classifieds_private.ad_json(ad classifieds_private.ads,viewer uuid) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',ad.id,'category',ad.category,'title',ad.title,'body',ad.body,
    'created_at',ad.created_at,'updated_at',ad.updated_at,
    'mine',ad.owner_id=viewer,'revision',case when ad.owner_id=viewer then ad.revision else null end);
$$;
revoke all on all functions in schema classifieds_private from public,anon,authenticated;

create function public.classifieds_read(p_category text default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member uuid; mine jsonb; categories jsonb; rows jsonb; total integer; skip integer;
begin
  member:=classifieds_private.member_id();
  if p_category is not null and not exists(select 1 from classifieds_private.categories where id=p_category) then
    raise exception using errcode='22023',message='Unknown classified category.';
  end if;
  skip:=greatest(0,least(coalesce(p_offset,0),10000));
  select classifieds_private.ad_json(a,member) into mine from classifieds_private.ads a where a.owner_id=member;
  select jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'count',(select count(*) from classifieds_private.ads a where a.category=c.id)) order by c.position)
    into categories from classifieds_private.categories c;
  select count(*) into total from classifieds_private.ads where category=p_category;
  select coalesce(jsonb_agg(classifieds_private.ad_json(r.ad,member) order by (r.ad).created_at desc,(r.ad).id desc),'[]'::jsonb) into rows from (
    select a as ad from classifieds_private.ads a where a.category=p_category
      order by a.created_at desc,a.id desc limit 20 offset skip
  ) r;
  return jsonb_build_object('categories',categories,'mine',mine,'ads',rows,'total',total,'more',skip+20<total and skip<10000);
end $$;

create function public.classifieds_save(p_owner_id uuid,p_category text,p_title text,p_body text,p_expected_revision bigint default 0,p_expected_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member uuid; ad classifieds_private.ads; heading text; paragraph text;
begin
  member:=classifieds_private.member_id();
  if p_owner_id is distinct from member then raise exception using errcode='42501',message='Account changed. Please sign in again.'; end if;
  heading:=btrim(regexp_replace(coalesce(p_title,''),'[[:space:]]+',' ','g'));
  paragraph:=btrim(regexp_replace(coalesce(p_body,''),'[[:space:]]+',' ','g'));
  if not exists(select 1 from classifieds_private.categories where id=p_category) then
    raise exception using errcode='22023',message='Choose a category.';
  end if;
  if char_length(heading) not between 1 and 100 or char_length(paragraph) not between 1 and 1000 then
    raise exception using errcode='22023',message='Use a title of 1–100 characters and a paragraph of 1–1,000 characters.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,731));
  select * into ad from classifieds_private.ads where owner_id=auth.uid() for update;
  if p_expected_revision is null or p_expected_revision<>coalesce(ad.revision,0) or p_expected_id is distinct from ad.id then
    raise exception using errcode='PT409',message='Your ad changed in another window. Close this form and refresh before editing.';
  end if;
  if ad.id is null then
    insert into classifieds_private.ads(owner_id,category,title,body)
      values(member,p_category,heading,paragraph) returning * into ad;
  else
    update classifieds_private.ads set category=p_category,title=heading,body=paragraph,
      revision=revision+1,updated_at=now() where owner_id=auth.uid() returning * into ad;
  end if;
  return classifieds_private.ad_json(ad,auth.uid());
exception when unique_violation then
  raise exception using errcode='PT409',message='This account already has a classified ad.';
end $$;
create function public.classifieds_delete(p_owner_id uuid,p_expected_revision bigint,p_expected_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare member uuid; ad classifieds_private.ads;
begin
  member:=classifieds_private.member_id();
  if p_owner_id is distinct from member then raise exception using errcode='42501',message='Account changed. Please sign in again.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,731));
  select * into ad from classifieds_private.ads where owner_id=auth.uid() for update;
  if ad.id is null then return; end if;
  if p_expected_revision is null or ad.revision<>p_expected_revision or p_expected_id is distinct from ad.id then
    raise exception using errcode='PT409',message='Your ad changed in another window. Refresh before deleting.';
  end if;
  delete from classifieds_private.ads where owner_id=auth.uid();
end $$;
revoke all on function public.classifieds_read(text,integer),public.classifieds_save(uuid,text,text,text,bigint,uuid),public.classifieds_delete(uuid,bigint,uuid) from public,anon;
grant execute on function public.classifieds_read(text,integer),public.classifieds_save(uuid,text,text,text,bigint,uuid),public.classifieds_delete(uuid,bigint,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
