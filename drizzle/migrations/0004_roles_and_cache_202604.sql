-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Add status and ban_until to profiles
ALTER TABLE public.profiles 
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD COLUMN ban_until timestamp with time zone;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Security definer function to get user status
CREATE OR REPLACE FUNCTION public.get_user_status(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM public.profiles WHERE id = _user_id
$$;

-- RLS: users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RLS: admins can do everything on user_roles
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user to set status and auto-assign admin for default email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE WHEN NEW.email = 'yashwanthvarma.simats@gmail.com' THEN 'approved' ELSE 'pending' END
  );
  
  -- Auto-assign admin role for default admin
  IF NEW.email = 'yashwanthvarma.simats@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Allow admins to update any profile (for approval/blocking)
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all profiles
CREATE POLICY "Admins can select all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'yashwanth.sse@gmail.com' THEN 'approved'
      WHEN NEW.email = 'yashwanthvarma.simats@gmail.com' THEN 'approved'
      ELSE 'pending' 
    END
  );
  
  -- Auto-assign admin role for default admin accounts
  IF NEW.email IN ('yashwanth.sse@gmail.com', 'yashwanthvarma.simats@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update the handle_new_user trigger to also auto-approve yashwanth.simats@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'yashwanth.sse@gmail.com' THEN 'approved'
      WHEN NEW.email = 'yashwanthvarma.simats@gmail.com' THEN 'approved'
      WHEN NEW.email = 'yashwanth.simats@gmail.com' THEN 'approved'
      ELSE 'pending' 
    END
  );
  
  -- Auto-assign admin role for default admin accounts
  IF NEW.email IN ('yashwanth.sse@gmail.com', 'yashwanthvarma.simats@gmail.com', 'yashwanth.simats@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Allow all authenticated users to view public custom problems (for community sharing)
CREATE POLICY "Anyone can view public custom problems" ON public.custom_problems
FOR SELECT TO anon USING (is_public = true);

-- Shared cache for AI-generated problem details + test cases (lazy generate, then reuse forever)
CREATE TABLE IF NOT EXISTS public.problem_test_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  problem_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  topic TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  starter_code TEXT NOT NULL DEFAULT '',
  function_name TEXT NOT NULL DEFAULT 'solve',
  return_type TEXT NOT NULL DEFAULT 'void',
  params JSONB NOT NULL DEFAULT '[]'::jsonb,
  test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problem_test_cases_key ON public.problem_test_cases(problem_key);

ALTER TABLE public.problem_test_cases ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read the cache
CREATE POLICY "Authenticated can read cached problem test cases"
  ON public.problem_test_cases FOR SELECT
  TO authenticated
  USING (true);

-- Anyone authenticated can populate the cache (first user wins, then upserts)
CREATE POLICY "Authenticated can insert cached problem test cases"
  ON public.problem_test_cases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins (or the original generator) can update / fix entries
CREATE POLICY "Admins or generator can update cache"
  ON public.problem_test_cases FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR generated_by = auth.uid());

CREATE POLICY "Admins can delete cache"
  ON public.problem_test_cases FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_problem_test_cases_updated_at
  BEFORE UPDATE ON public.problem_test_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Authenticated can insert cached problem test cases" ON public.problem_test_cases;

CREATE POLICY "Authenticated can insert their own cache entries"
  ON public.problem_test_cases FOR INSERT
  TO authenticated
  WITH CHECK (generated_by = auth.uid());