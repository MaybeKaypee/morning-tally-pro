
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Classrooms
CREATE TABLE public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_name text NOT NULL,
  total_students integer NOT NULL CHECK (total_students >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.classrooms TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.classrooms TO authenticated;
GRANT ALL ON public.classrooms TO service_role;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read classrooms" ON public.classrooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert classrooms" ON public.classrooms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update classrooms" ON public.classrooms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete classrooms" ON public.classrooms FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  on_time_count integer NOT NULL CHECK (on_time_count >= 0),
  late_count integer NOT NULL CHECK (late_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, attendance_date)
);
GRANT SELECT, INSERT, UPDATE ON public.attendance TO anon, authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attendance" ON public.attendance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert attendance" ON public.attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update attendance" ON public.attendance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed classrooms
INSERT INTO public.classrooms (classroom_name, total_students) VALUES
  ('Grade 1A', 28),('Grade 1B', 30),('Grade 2A', 27),('Grade 2B', 29),
  ('Grade 3A', 32),('Grade 3B', 31),('Grade 4A', 30),('Grade 4B', 28),
  ('Grade 5A', 33),('Grade 5B', 30),('Grade 6A', 29);
