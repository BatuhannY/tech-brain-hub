-- Create issue_logs table
CREATE TABLE public.issue_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Bug',
  solution_steps TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.issue_logs ENABLE ROW LEVEL SECURITY;

-- Allow all access (internal admin tool)
CREATE POLICY "Anyone can read issues" ON public.issue_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert issues" ON public.issue_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update issues" ON public.issue_logs FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Anyone can delete issues" ON public.issue_logs FOR DELETE TO anon, authenticated USING (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_issue_logs_updated_at
  BEFORE UPDATE ON public.issue_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();