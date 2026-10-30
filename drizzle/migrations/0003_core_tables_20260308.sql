-- Create users table (username-only auth)
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert users" ON public.users FOR INSERT WITH CHECK (true);

-- Create problems table
CREATE TABLE public.problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Problem',
  code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own problems" ON public.problems FOR SELECT USING (true);
CREATE POLICY "Users can insert own problems" ON public.problems FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own problems" ON public.problems FOR UPDATE USING (true);
CREATE POLICY "Users can delete own problems" ON public.problems FOR DELETE USING (true);

-- Create analyses table
CREATE TABLE public.analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  algorithm TEXT,
  time_complexity TEXT,
  space_complexity TEXT,
  summary TEXT,
  optimizations TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.analyses FOR SELECT USING (true);
CREATE POLICY "Users can insert analyses" ON public.analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update analyses" ON public.analyses FOR UPDATE USING (true);

-- Create hints table
CREATE TABLE public.hints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  hint_level INT NOT NULL DEFAULT 1,
  hint_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own hints" ON public.hints FOR SELECT USING (true);
CREATE POLICY "Users can insert hints" ON public.hints FOR INSERT WITH CHECK (true);

-- Create solutions table
CREATE TABLE public.solutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  solution_type TEXT NOT NULL CHECK (solution_type IN ('brute', 'better', 'optimal')),
  solution_code TEXT NOT NULL,
  explanation TEXT,
  time_complexity TEXT,
  space_complexity TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own solutions" ON public.solutions FOR SELECT USING (true);
CREATE POLICY "Users can insert solutions" ON public.solutions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update solutions" ON public.solutions FOR UPDATE USING (true);

-- Create test_cases table
CREATE TABLE public.test_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own test_cases" ON public.test_cases FOR SELECT USING (true);
CREATE POLICY "Users can insert test_cases" ON public.test_cases FOR INSERT WITH CHECK (true);

CREATE TRIGGER update_problems_updated_at
  BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop old foreign keys and re-point to auth.users
ALTER TABLE public.problems DROP CONSTRAINT IF EXISTS problems_user_id_fkey;
ALTER TABLE public.analyses DROP CONSTRAINT IF EXISTS analyses_user_id_fkey;
ALTER TABLE public.hints DROP CONSTRAINT IF EXISTS hints_user_id_fkey;
ALTER TABLE public.solutions DROP CONSTRAINT IF EXISTS solutions_user_id_fkey;
ALTER TABLE public.test_cases DROP CONSTRAINT IF EXISTS test_cases_user_id_fkey;

ALTER TABLE public.problems ADD CONSTRAINT problems_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.hints ADD CONSTRAINT hints_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.solutions ADD CONSTRAINT solutions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.test_cases ADD CONSTRAINT test_cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies to use auth.uid()
DROP POLICY IF EXISTS "Users can view own problems" ON public.problems;
DROP POLICY IF EXISTS "Users can insert own problems" ON public.problems;
DROP POLICY IF EXISTS "Users can update own problems" ON public.problems;
DROP POLICY IF EXISTS "Users can delete own problems" ON public.problems;

CREATE POLICY "Users can view own problems" ON public.problems FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own problems" ON public.problems FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own problems" ON public.problems FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own problems" ON public.problems FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own analyses" ON public.analyses;
DROP POLICY IF EXISTS "Users can insert analyses" ON public.analyses;
DROP POLICY IF EXISTS "Users can update analyses" ON public.analyses;

CREATE POLICY "Users can view own analyses" ON public.analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert analyses" ON public.analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update analyses" ON public.analyses FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own hints" ON public.hints;
DROP POLICY IF EXISTS "Users can insert hints" ON public.hints;

CREATE POLICY "Users can view own hints" ON public.hints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert hints" ON public.hints FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own solutions" ON public.solutions;
DROP POLICY IF EXISTS "Users can insert solutions" ON public.solutions;
DROP POLICY IF EXISTS "Users can update solutions" ON public.solutions;

CREATE POLICY "Users can view own solutions" ON public.solutions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert solutions" ON public.solutions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update solutions" ON public.solutions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own test_cases" ON public.test_cases;
DROP POLICY IF EXISTS "Users can insert test_cases" ON public.test_cases;

CREATE POLICY "Users can view own test_cases" ON public.test_cases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert test_cases" ON public.test_cases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Legacy table kept but no longer used (zero-downtime route instead of DROP)
COMMENT ON TABLE public.users IS 'DEPRECATED: replaced by public.profiles';

-- Add input and expected_output columns to test_cases
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS input text NOT NULL DEFAULT '';
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS expected_output text NOT NULL DEFAULT '';

-- Legacy column kept but no longer used (zero-downtime route instead of DROP)
COMMENT ON COLUMN public.test_cases.content IS 'DEPRECATED: replaced by input/inputs';

-- Add update and delete RLS policies for test_cases
CREATE POLICY "Users can update own test_cases" ON public.test_cases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own test_cases" ON public.test_cases FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS variable_name text NOT NULL DEFAULT 'arr';

-- Learning history table
CREATE TABLE IF NOT EXISTS public.learning_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text NOT NULL,
  algorithm text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning_history" ON public.learning_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert learning_history" ON public.learning_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update learning_history" ON public.learning_history FOR UPDATE USING (auth.uid() = user_id);

-- Add difficulty and time_spent to problems table
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS solved boolean NOT NULL DEFAULT false;
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS time_spent_seconds integer NOT NULL DEFAULT 0;
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS topic text NOT NULL DEFAULT 'general';

ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS bookmarked boolean NOT NULL DEFAULT false;
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

CREATE TABLE public.user_problem_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  problem_key text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  attempts integer NOT NULL DEFAULT 0,
  solved boolean NOT NULL DEFAULT false,
  marked_for_revision boolean NOT NULL DEFAULT false,
  last_attempted timestamp with time zone,
  solved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, problem_key)
);

ALTER TABLE public.user_problem_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.user_problem_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.user_problem_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_problem_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own progress" ON public.user_problem_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS inputs jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Migrate existing data: convert old single input/variable_name to new JSON inputs format
UPDATE public.test_cases 
SET inputs = jsonb_build_object(variable_name, input)
WHERE inputs = '{}'::jsonb AND input != '';

-- Add spaced repetition columns to user_problem_progress
ALTER TABLE public.user_problem_progress
  ADD COLUMN IF NOT EXISTS next_review_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ease_factor real NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS review_interval integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

-- Contest results table
CREATE TABLE public.contest_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contest_type text NOT NULL DEFAULT 'practice',
  problems_attempted integer NOT NULL DEFAULT 0,
  problems_solved integer NOT NULL DEFAULT 0,
  total_time_seconds integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  problem_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contest_results ENABLE ROW LEVEL SECURITY;

-- RLS for contest_results
CREATE POLICY "Users can view own contest results" ON public.contest_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contest results" ON public.contest_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Leaderboard view: allow reading all contest_results for leaderboard (aggregate only)
CREATE POLICY "Anyone can view contest results for leaderboard" ON public.contest_results
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.execution_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  problem_id text NOT NULL,
  code_snapshot text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'java',
  test_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  execution_time_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.execution_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own execution history" ON public.execution_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own execution history" ON public.execution_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own execution history" ON public.execution_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_execution_history_user_problem ON public.execution_history (user_id, problem_id, created_at DESC);

-- Achievements table
CREATE TABLE public.user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Custom problems table
CREATE TABLE public.custom_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'Medium',
  starter_code text NOT NULL DEFAULT '',
  test_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom problems" ON public.custom_problems FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view public custom problems" ON public.custom_problems FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Users can insert own custom problems" ON public.custom_problems FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own custom problems" ON public.custom_problems FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own custom problems" ON public.custom_problems FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Interview results table
CREATE TABLE public.interview_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  problem_title text NOT NULL,
  difficulty text NOT NULL DEFAULT 'Medium',
  time_taken_seconds integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  ai_feedback text,
  code_snapshot text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview results" ON public.interview_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interview results" ON public.interview_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Shared solutions table
CREATE TABLE public.shared_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  problem_key text NOT NULL,
  code text NOT NULL,
  approach text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'java',
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared solutions" ON public.shared_solutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own shared solutions" ON public.shared_solutions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shared solutions" ON public.shared_solutions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shared solutions" ON public.shared_solutions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_code_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  problem_key text NOT NULL,
  code text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'java',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, problem_key)
);

ALTER TABLE public.user_code_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own code saves"
  ON public.user_code_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own code saves"
  ON public.user_code_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own code saves"
  ON public.user_code_saves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own code saves"
  ON public.user_code_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_code_saves_updated_at
  BEFORE UPDATE ON public.user_code_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discussion_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_key text NOT NULL,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discussion_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view discussion posts" ON public.discussion_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own discussion posts" ON public.discussion_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own discussion posts" ON public.discussion_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own discussion posts" ON public.discussion_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);