-- pgTAP stays installed on the local database. `supabase test db` installs it for a run and drops it at the
-- end, so two runs that overlap break each other ("function ok(boolean, text) does not exist"). A seed runs
-- only locally, never on the cloud project.
create extension if not exists pgtap with schema extensions;
