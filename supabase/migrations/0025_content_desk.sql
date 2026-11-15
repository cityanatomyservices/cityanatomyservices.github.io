-- Private editorial lists reuse the existing verified dashboard-owner allowlist.
begin;
create table dashboard_private.content_lists (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  check(jsonb_typeof(document)='object')
);
alter table dashboard_private.content_lists enable row level security;
revoke all on dashboard_private.content_lists from public,anon,authenticated;
create index content_lists_owner on dashboard_private.content_lists(owner_id,updated_at desc);

create or replace function public.content_desk_lists() returns jsonb language plpgsql
security definer set search_path='' as $$
declare result jsonb;
begin
  perform dashboard_private.require_admin();
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',document->>'title','count',jsonb_array_length(document->'items'),'revision',revision,'updated',updated_at) order by updated_at desc),'[]')
    into result from dashboard_private.content_lists where owner_id=auth.uid();
  return result;
end $$;
create or replace function public.content_desk_get(p_id uuid) returns jsonb language plpgsql
security definer set search_path='' as $$
declare result jsonb;
begin
  perform dashboard_private.require_admin();
  select jsonb_build_object('id',id,'document',document,'revision',revision,'updated',updated_at) into result
    from dashboard_private.content_lists where id=p_id and owner_id=auth.uid();
  if result is null then raise exception using errcode='P0002',message='This list is no longer available.';end if;
  return result;
end $$;
create or replace function public.content_desk_save(p_id uuid,p_revision integer,p_document jsonb) returns jsonb language plpgsql
security definer set search_path='' as $$
declare changed integer;
begin
  perform dashboard_private.require_admin();
  if p_id is null or p_revision is null or p_revision<0 or p_document is null or
    jsonb_typeof(p_document) is distinct from 'object' or
    jsonb_typeof(p_document->'title') is distinct from 'string' or
    length(btrim(p_document->>'title')) not between 1 and 160 or
    jsonb_typeof(p_document->'intro') is distinct from 'string' or length(p_document->>'intro')>4000 or
    jsonb_typeof(p_document->'items') is distinct from 'array' or octet_length(p_document::text)>1048576 then
      raise exception using errcode='22023',message='Use a list title, introduction and valid selected items.';
  end if;
  if jsonb_array_length(p_document->'items')>250 or exists(select 1 from jsonb_array_elements(p_document->'items') i where jsonb_typeof(i) is distinct from 'object' or jsonb_typeof(i->'id') is distinct from 'string' or jsonb_typeof(i->'title') is distinct from 'string') then
    raise exception using errcode='22023',message='Each list can contain up to 250 valid items. Create another list for more.';
  end if;
  if p_revision=0 then
    insert into dashboard_private.content_lists(id,owner_id,document) values(p_id,auth.uid(),p_document) on conflict do nothing;
  else
    update dashboard_private.content_lists set document=p_document,revision=revision+1,updated_at=now()
      where id=p_id and owner_id=auth.uid() and revision=p_revision;
  end if;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception using errcode='PT409',message='This list changed in another tab. Save your work as a new list or reload this list.';end if;
  return public.content_desk_get(p_id);
end $$;
create or replace function public.content_desk_delete(p_id uuid,p_revision integer) returns boolean language plpgsql
security definer set search_path='' as $$
declare changed integer;
begin
  perform dashboard_private.require_admin();
  delete from dashboard_private.content_lists where id=p_id and owner_id=auth.uid() and revision=p_revision;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception using errcode='PT409',message='This list changed in another tab. Reload before deleting.';end if;
  return true;
end $$;
revoke all on function public.content_desk_lists(),public.content_desk_get(uuid),public.content_desk_save(uuid,integer,jsonb),public.content_desk_delete(uuid,integer) from public,anon,authenticated;
grant execute on function public.content_desk_lists(),public.content_desk_get(uuid),public.content_desk_save(uuid,integer,jsonb),public.content_desk_delete(uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
