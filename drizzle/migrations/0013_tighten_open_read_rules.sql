CREATE OR REPLACE FUNCTION public.is_lobby_member(_lobby_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM interview_lobbies l WHERE l.id = _lobby_id AND (l.host_id = _user_id OR l.guest_id = _user_id))
      OR EXISTS (SELECT 1 FROM lobby_participants p WHERE p.lobby_id = _lobby_id AND p.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _profile_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM discussion_posts d WHERE d.user_id = _profile_id)
    OR EXISTS (SELECT 1 FROM shared_solutions s WHERE s.user_id = _profile_id)
    OR EXISTS (SELECT 1 FROM direct_messages m WHERE (m.sender_id = auth.uid() AND m.receiver_id = _profile_id) OR (m.receiver_id = auth.uid() AND m.sender_id = _profile_id))
    OR EXISTS (SELECT 1 FROM lobby_participants a JOIN lobby_participants b ON a.lobby_id = b.lobby_id WHERE a.user_id = auth.uid() AND b.user_id = _profile_id)
    OR EXISTS (SELECT 1 FROM interview_lobbies l WHERE l.host_id = _profile_id AND l.status <> 'closed')
  );
$$;

DROP POLICY IF EXISTS "Anyone view items" ON public.store_items;
CREATE POLICY "View enabled items" ON public.store_items FOR SELECT USING (enabled = true OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone view rules" ON public.coin_reward_rules;
CREATE POLICY "View enabled rules" ON public.coin_reward_rules FOR SELECT USING (enabled = true OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Anyone can view lobby participants" ON public.lobby_participants;
CREATE POLICY "Members view lobby participants" ON public.lobby_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_lobby_member(lobby_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view any lobby" ON public.interview_lobbies;
CREATE POLICY "Members or open lobbies viewable" ON public.interview_lobbies FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR guest_id = auth.uid() OR is_lobby_member(id, auth.uid()) OR status <> 'closed');

DROP POLICY IF EXISTS "Anyone can view user progress" ON public.user_problem_progress;
CREATE POLICY "Own progress viewable" ON public.user_problem_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by related users" ON public.profiles FOR SELECT TO authenticated
  USING (can_view_profile(id));

DROP POLICY IF EXISTS "Anyone can view shared solutions" ON public.shared_solutions;
CREATE POLICY "Signed-in view shared solutions" ON public.shared_solutions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view discussion posts" ON public.discussion_posts;
CREATE POLICY "Signed-in view discussion posts" ON public.discussion_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view contest results for leaderboard" ON public.contest_results;
CREATE POLICY "Signed-in view contest results" ON public.contest_results FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can read cached problem test cases" ON public.problem_test_cases;
CREATE POLICY "Signed-in read cached problem test cases" ON public.problem_test_cases FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can insert users" ON public.users;
DROP POLICY IF EXISTS "Anyone can read users" ON public.users;
CREATE POLICY "Users insert own row" ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Signed-in read users" ON public.users FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);