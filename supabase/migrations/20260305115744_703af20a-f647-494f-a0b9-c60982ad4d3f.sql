
ALTER TABLE public.issue_logs 
  ADD COLUMN IF NOT EXISTS ai_suggested_fix text,
  ADD COLUMN IF NOT EXISTS web_fix text,
  ADD COLUMN IF NOT EXISTS internal_fix text,
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1;

-- Migrate existing solution_steps data to internal_fix
UPDATE public.issue_logs SET internal_fix = solution_steps WHERE solution_steps IS NOT NULL;

-- Update default status
ALTER TABLE public.issue_logs ALTER COLUMN status SET DEFAULT 'Unresolved';
