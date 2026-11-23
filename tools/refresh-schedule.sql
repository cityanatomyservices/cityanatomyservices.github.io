-- Install on the hosted Austin.chat Supabase project. GitHub schedules also run.
-- Vault key github_refresh_dispatch needs Actions write on this repository only.
begin;
create schema if not exists feed_refresh_private;
revoke all on schema feed_refresh_private from public, anon, authenticated, service_role;

create or replace function feed_refresh_private.dispatch_if_due(workflow text)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  endpoint constant text := 'https://api.github.com/repos/cityanatomyservices/cityanatomyservices.github.io/actions/workflows/';
  cadence interval;
  credential text;
  headers public.http_header[];
  response public.http_response;
  latest jsonb;
begin
  case workflow
    when 'build-sports.yml' then cadence := interval '14 minutes';
    when 'build-explore.yml' then cadence := interval '2 hours 55 minutes';
    else raise exception 'Unknown feed workflow';
  end case;
  select decrypted_secret into credential from vault.decrypted_secrets where name='github_refresh_dispatch';
  if nullif(credential,'') is null then raise exception 'Missing Vault credential github_refresh_dispatch'; end if;

  headers := array[public.http_header('Authorization', 'Bearer ' || credential),
                   public.http_header('User-Agent', 'Austin-chat-feed-scheduler'),
                   public.http_header('Accept', 'application/vnd.github+json')];
  response := public.http(('GET', endpoint || workflow || '/runs?branch=main&per_page=1',
                            headers, null, null)::public.http_request);
  if response.status <> 200 then raise exception 'GitHub run lookup for % returned HTTP %',workflow,response.status; end if;
  latest := response.content::jsonb->'workflow_runs'->0;
  if latest->>'status' <> 'completed' then return 'Refresh already queued or running'; end if;
  if (latest->>'created_at')::timestamptz > now() - cadence then return 'Recent refresh'; end if;

  response := public.http(('POST', endpoint || workflow || '/dispatches',
                            headers, 'application/json', '{"ref":"main"}')::public.http_request);
  if response.status not in (200,204) then raise exception 'GitHub dispatch for % returned HTTP %',workflow,response.status; end if;
  return 'Dispatched ' || workflow;
end $$;
revoke all on function feed_refresh_private.dispatch_if_due(text) from public, anon, authenticated, service_role;

select cron.schedule('austin-github-refresh-sports', '1-59/5 * * * *',
  $$select feed_refresh_private.dispatch_if_due('build-sports.yml')$$);
select cron.schedule('austin-github-refresh-explore', '4,19,34,49 * * * *',
  $$select feed_refresh_private.dispatch_if_due('build-explore.yml')$$);
commit;
