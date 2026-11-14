-- Allow larger new chat circles; existing centers, sizes and access stay intact.
begin;
set local lock_timeout='5s';
alter table geofence_private.spaces
 drop constraint spaces_diameter_check,
 add constraint spaces_diameter_check check(diameter between 10 and 500);
commit;
