-- Email notifications (pilot): remember what has been emailed so nothing is sent twice.
alter table alerts add column if not exists notified_at timestamptz;
alter table data_sources add column if not exists offline_notified_at timestamptz;

-- Alerts that exist when this migration runs are not emailed retroactively. They are stamped with their own
-- creation time, so they do not count towards the per-metric cooldown of the first real alert.
update alerts set notified_at = created_at where notified_at is null;
