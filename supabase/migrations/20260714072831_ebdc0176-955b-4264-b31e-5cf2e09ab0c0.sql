
-- Heartbeat table
CREATE TABLE public.heartbeat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.heartbeat TO anon, authenticated;
GRANT ALL ON public.heartbeat TO service_role;
ALTER TABLE public.heartbeat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read heartbeat" ON public.heartbeat FOR SELECT TO anon, authenticated USING (true);

-- Dashboard settings (single row)
CREATE TABLE public.dashboard_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  show_warning boolean NOT NULL DEFAULT true,
  show_flag boolean NOT NULL DEFAULT true,
  flag_cutoff_minutes int NOT NULL DEFAULT 500,
  flag_perfect_threshold int NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dashboard_settings TO anon, authenticated;
GRANT UPDATE ON public.dashboard_settings TO authenticated;
GRANT ALL ON public.dashboard_settings TO service_role;
ALTER TABLE public.dashboard_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dashboard settings" ON public.dashboard_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update dashboard settings" ON public.dashboard_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER dashboard_settings_updated_at
  BEFORE UPDATE ON public.dashboard_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.dashboard_settings (id) VALUES (true);

-- Hourly heartbeat cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'heartbeat-hourly',
  '0 * * * *',
  $$
  INSERT INTO public.heartbeat DEFAULT VALUES;
  DELETE FROM public.heartbeat WHERE id IN (
    SELECT id FROM public.heartbeat ORDER BY created_at DESC OFFSET 10
  );
  $$
);
