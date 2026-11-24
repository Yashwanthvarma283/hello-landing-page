CREATE OR REPLACE FUNCTION public.is_approved_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'approved'
               AND (p.ban_until IS NULL OR p.ban_until < now()))
  );
$$;

DROP POLICY IF EXISTS "Signed-in view shared solutions" ON public.shared_solutions;
CREATE POLICY "Approved members view shared solutions" ON public.shared_solutions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_approved_member());

DROP POLICY IF EXISTS "Signed-in view discussion posts" ON public.discussion_posts;
CREATE POLICY "Approved members view discussion posts" ON public.discussion_posts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_approved_member());

DROP POLICY IF EXISTS "Signed-in view contest results" ON public.contest_results;
CREATE POLICY "Approved members view contest results" ON public.contest_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_approved_member());

DROP POLICY IF EXISTS "Signed-in read cached problem test cases" ON public.problem_test_cases;
CREATE POLICY "Approved members read cached problem test cases" ON public.problem_test_cases
  FOR SELECT TO authenticated USING (public.is_approved_member());

DROP POLICY IF EXISTS "Signed-in read users" ON public.users;
CREATE POLICY "Owner or admin read users" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));