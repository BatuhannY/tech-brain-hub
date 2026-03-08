
-- Tighten issue_logs: public can SELECT, only admins can INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Anyone can delete issues" ON public.issue_logs;
DROP POLICY IF EXISTS "Anyone can insert issues" ON public.issue_logs;
DROP POLICY IF EXISTS "Anyone can update issues" ON public.issue_logs;

CREATE POLICY "Admins can insert issues"
ON public.issue_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update issues"
ON public.issue_logs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete issues"
ON public.issue_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
