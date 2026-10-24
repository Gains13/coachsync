-- In-person training sessions + linked workout submissions.
--
-- Sessions reuse client_historical_workouts (the same table imported notes go
-- into), with source = 'session'. Clients can already view and repeat rows in
-- that table, so a logged session shows up for them automatically.
--
-- Safe to run more than once.

-- 1. Sessions: who logged them, and whether they are still being logged.
alter table public.client_historical_workouts
  add column if not exists trainer_user_id uuid references auth.users (id) on delete set null,
  add column if not exists status text not null default 'completed',
  add column if not exists updated_at timestamptz not null default now();

alter table public.client_historical_workouts
  drop constraint if exists client_historical_workouts_status_check;

alter table public.client_historical_workouts
  add constraint client_historical_workouts_status_check
  check (status in ('draft', 'completed'));

-- What was actually done, set by set: [{"weight": "30", "reps": "10", "done": true}, ...]
alter table public.client_historical_workout_exercises
  add column if not exists logged_sets jsonb not null default '[]'::jsonb,
  add column if not exists notes text;

create index if not exists client_historical_workouts_client_date_idx
  on public.client_historical_workouts (client_user_id, workout_date desc);

-- 2. Submissions: record where every workout came from, so repeats link back.
alter table public.workout_submissions
  add column if not exists source_type text not null default 'program',
  add column if not exists historical_workout_id uuid
    references public.client_historical_workouts (id) on delete set null;

alter table public.workout_submissions
  drop constraint if exists workout_submissions_source_type_check;

alter table public.workout_submissions
  add constraint workout_submissions_source_type_check
  check (source_type in ('program', 'program_repeat', 'session_repeat', 'imported_repeat'));

create index if not exists workout_submissions_historical_workout_idx
  on public.workout_submissions (historical_workout_id);

-- Backfill the repeats saved before this change (they were only marked in the title).
update public.workout_submissions
set source_type = 'program_repeat'
where source_type = 'program'
  and workout_id is not null
  and workout_title like 'Repeated - %';

update public.workout_submissions
set source_type = 'imported_repeat'
where source_type = 'program'
  and workout_id is null
  and workout_title like '% — Repeated';

alter table public.workout_submission_exercises
  add column if not exists logged_sets jsonb not null default '[]'::jsonb,
  add column if not exists exercise_order integer;

-- 3. Trainers can create, edit and delete sessions and their exercises.
--    (Only takes effect where row level security is enabled.)
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'trainer'
  );
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_historical_workouts'
      and policyname = 'Trainers manage client sessions'
  ) then
    create policy "Trainers manage client sessions"
      on public.client_historical_workouts
      for all to authenticated
      using (public.is_trainer())
      with check (public.is_trainer());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_historical_workout_exercises'
      and policyname = 'Trainers manage client session exercises'
  ) then
    create policy "Trainers manage client session exercises"
      on public.client_historical_workout_exercises
      for all to authenticated
      using (public.is_trainer())
      with check (public.is_trainer());
  end if;
end;
$$;
