-- supabase/migrations/0003_measurements.sql
-- Measurements tab: an `extended` jsonb blob on body_profile holds everything the
-- fixed columns don't (extra circumferences, sleeve/leg lengths, thumb/finger
-- girth, default shirt/pants/ring sizes, left/right foot dimensions, the EU/US/JPN
-- shoe sizes, and the metric/imperial unit preference). Canonical numeric values
-- stay metric; the client converts for display.

alter table body_profile
  add column if not exists extended jsonb not null default '{}'::jsonb;
