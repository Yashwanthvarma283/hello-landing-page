-- Agent run history
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  problem_key TEXT NOT NULL,
  title TEXT NOT NULL,
  phase TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  error_type TEXT,
  final_code TEXT NOT NULL DEFAULT '',
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all agent runs"
  ON public.agent_runs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert agent runs"
  ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_id = auth.uid());

CREATE POLICY "Admins can update agent runs"
  ON public.agent_runs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_agent_runs_created ON public.agent_runs(created_at DESC);
CREATE INDEX idx_agent_runs_problem ON public.agent_runs(problem_key);

-- System patch proposals (admin reviews, never auto-applied)
CREATE TABLE public.system_patch_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposed_by UUID NOT NULL,
  problem_key TEXT,
  error_type TEXT NOT NULL,
  error_summary TEXT NOT NULL,
  target_files TEXT[] NOT NULL DEFAULT '{}',
  diff TEXT NOT NULL,
  explanation TEXT NOT NULL,
  context_snippet TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_patch_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view patch proposals"
  ON public.system_patch_proposals FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert patch proposals"
  ON public.system_patch_proposals FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND proposed_by = auth.uid());

CREATE POLICY "Admins can update patch proposals"
  ON public.system_patch_proposals FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_patch_proposals_status ON public.system_patch_proposals(status, created_at DESC);

CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  page_url TEXT NOT NULL,
  page_title TEXT,
  comment TEXT NOT NULL,
  admin_reply TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own issues" 
ON public.issues FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all issues" 
ON public.issues FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view their own issues" 
ON public.issues FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can update issues" 
ON public.issues FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Function to allow admins to delete users completely
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Security Check: Only admins can perform this action
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission Denied: Only admins can delete users.';
  END IF;

  -- 2. Clear all user-related data from public tables 
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.user_achievements WHERE user_id = target_user_id;
  DELETE FROM public.user_code_saves WHERE user_id = target_user_id;
  DELETE FROM public.user_problem_progress WHERE user_id = target_user_id;
  DELETE FROM public.execution_history WHERE user_id = target_user_id;
  DELETE FROM public.learning_history WHERE user_id = target_user_id;
  DELETE FROM public.contest_results WHERE user_id = target_user_id;
  DELETE FROM public.interview_results WHERE user_id = target_user_id;
  DELETE FROM public.discussion_posts WHERE user_id = target_user_id;
  DELETE FROM public.shared_solutions WHERE user_id = target_user_id;
  DELETE FROM public.agent_runs WHERE user_id = target_user_id;
  DELETE FROM public.system_patch_proposals WHERE proposed_by = target_user_id;
  DELETE FROM public.issues WHERE user_id = target_user_id;
  
  DELETE FROM public.analyses WHERE user_id = target_user_id;
  DELETE FROM public.hints WHERE user_id = target_user_id;
  DELETE FROM public.solutions WHERE user_id = target_user_id;
  DELETE FROM public.test_cases WHERE user_id = target_user_id;
  DELETE FROM public.custom_problems WHERE user_id = target_user_id;
  DELETE FROM public.problems WHERE user_id = target_user_id;
  
  -- 3. Clear Profile
  DELETE FROM public.profiles WHERE id = target_user_id;
  
  -- 4. Finally, remove the Auth account
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Updated Function to allow Admins OR the Owner to reset a password
CREATE OR REPLACE FUNCTION public.admin_reset_password(target_user_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() = target_user_id
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only reset your own password or must be an admin.';
  END IF;

  UPDATE auth.users 
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$;

-- Updated Function to allow Admins OR the Owner to reset a username
CREATE OR REPLACE FUNCTION public.admin_reset_username(target_user_id UUID, new_username TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR auth.uid() = target_user_id
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only change your own username or must be an admin.';
  END IF;

  UPDATE public.profiles 
  SET username = new_username
  WHERE id = target_user_id;
END;
$$;

-- Threaded conversation messages
CREATE TABLE IF NOT EXISTS public.issue_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.issue_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their own issues"
ON public.issue_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.issues 
    WHERE public.issues.id = public.issue_messages.issue_id 
    AND public.issues.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all issue messages"
ON public.issue_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can insert messages to their own issues"
ON public.issue_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.issues 
    WHERE public.issues.id = issue_id 
    AND public.issues.user_id = auth.uid()
    AND public.issues.status = 'open'
  )
);

CREATE POLICY "Admins can insert messages to any issue"
ON public.issue_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger to automatically add the initial comment to the messages table
CREATE OR REPLACE FUNCTION public.handle_new_issue()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.issue_messages (issue_id, sender_id, sender_role, message, created_at)
  VALUES (NEW.id, NEW.user_id, 'user', NEW.comment, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_issue_created ON public.issues;
CREATE TRIGGER on_issue_created
  AFTER INSERT ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_issue();

-- Add a system-generated numeric ID to profiles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='display_id') THEN
    ALTER TABLE public.profiles ADD COLUMN display_id SERIAL;
  END IF;
END $$;

-- Direct Messages between users (final design: FKs to profiles)
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" 
ON public.direct_messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
ON public.direct_messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can mark messages as read" 
ON public.direct_messages FOR UPDATE 
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- View for public profile statistics
CREATE OR REPLACE VIEW public.public_profile_stats AS
SELECT 
  p.id as user_id,
  p.username,
  p.display_id,
  p.created_at,
  COUNT(DISTINCT progress.problem_key) FILTER (WHERE progress.solved = true) as solved_count,
  COUNT(DISTINCT progress.problem_key) as attempted_count,
  MAX(progress.last_attempted) as last_active
FROM public.profiles p
LEFT JOIN public.user_problem_progress progress ON p.id = progress.user_id
GROUP BY p.id, p.username, p.display_id, p.created_at;

-- Allow all authenticated users to view everyone's progress 
-- so that the leaderboard detail panel can show statistics.
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_problem_progress;

CREATE POLICY "Anyone can view user progress" 
ON public.user_problem_progress FOR SELECT 
TO authenticated 
USING (true);