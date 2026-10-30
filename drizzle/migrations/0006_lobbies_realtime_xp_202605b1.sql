-- Create Interview Lobbies table
CREATE TABLE IF NOT EXISTS public.interview_lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  problem_key text,
  status text NOT NULL DEFAULT 'waiting', -- waiting, coding, review
  current_code text,
  time_limit integer DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_activity timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view any lobby" ON public.interview_lobbies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create lobbies" ON public.interview_lobbies FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Users can update their lobbies" ON public.interview_lobbies FOR UPDATE TO authenticated USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- Lobby Messages (Chat)
CREATE TABLE IF NOT EXISTS public.lobby_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.interview_lobbies(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lobby_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lobby messages" ON public.lobby_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.interview_lobbies WHERE id = lobby_id AND (host_id = auth.uid() OR guest_id = auth.uid()))
);

CREATE POLICY "Users can post to lobby" ON public.lobby_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.interview_lobbies WHERE id = lobby_id AND (host_id = auth.uid() OR guest_id = auth.uid()))
);

-- Support multiple participants per lobby
CREATE TABLE IF NOT EXISTS public.lobby_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES public.interview_lobbies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username text,
  role text NOT NULL DEFAULT 'participant',
  status text NOT NULL DEFAULT 'active',
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  left_at timestamp with time zone,
  UNIQUE(lobby_id, user_id)
);

ALTER TABLE public.lobby_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lobby participants" 
ON public.lobby_participants FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can join lobbies as participant" 
ON public.lobby_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" 
ON public.lobby_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.interview_lobbies ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;
ALTER TABLE public.interview_lobbies ADD COLUMN IF NOT EXISTS max_participants integer DEFAULT 10;

CREATE POLICY "Host can delete lobby" 
ON public.interview_lobbies FOR DELETE TO authenticated USING (auth.uid() = host_id);

-- Enable realtime for lobby tables so postgres_changes events fire
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;

-- Add XP column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- Recreate the stats view with the new xp column (cannot be reshaped in place)
DROP VIEW IF EXISTS public.public_profile_stats;

CREATE VIEW public.public_profile_stats AS
SELECT 
  p.id as user_id,
  p.username,
  p.display_id,
  p.created_at,
  p.xp,
  COUNT(DISTINCT progress.problem_key) FILTER (WHERE progress.solved = true) as solved_count,
  COUNT(DISTINCT progress.problem_key) as attempted_count,
  MAX(progress.last_attempted) as last_active
FROM public.profiles p
LEFT JOIN public.user_problem_progress progress ON p.id = progress.user_id
GROUP BY p.id, p.username, p.display_id, p.created_at, p.xp;

-- Add email and requested_role to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS requested_role TEXT DEFAULT 'user';

-- Update handle_new_user to populate email and requested_role, and create an issue notification
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    is_admin_email BOOLEAN;
    username_val TEXT;
    requested_role_val TEXT;
BEGIN
  is_admin_email := (NEW.email = 'yashwanthvarma.simats@gmail.com');
  username_val := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  requested_role_val := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'user');

  INSERT INTO public.profiles (id, username, email, status, requested_role)
  VALUES (
    NEW.id,
    username_val,
    NEW.email,
    CASE WHEN is_admin_email THEN 'approved' ELSE 'pending' END,
    requested_role_val
  );
  
  IF is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  IF NOT is_admin_email THEN
    INSERT INTO public.issues (user_id, user_email, page_url, page_title, comment, status)
    VALUES (
      NEW.id,
      NEW.email,
      '/admin',
      'Signup Request',
      'New ' || requested_role_val || ' signup request from ' || username_val || ' (' || NEW.email || '). Please review and approve.',
      'open'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add 'moderator' to app_role enum (committed in its own transaction before use)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Add GitHub settings to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS github_token TEXT,
  ADD COLUMN IF NOT EXISTS github_repo TEXT,
  ADD COLUMN IF NOT EXISTS github_auto_push BOOLEAN DEFAULT false;