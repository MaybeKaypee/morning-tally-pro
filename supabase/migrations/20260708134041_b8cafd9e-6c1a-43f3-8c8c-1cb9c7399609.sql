GRANT SELECT ON public.attendance_history TO anon, authenticated;
CREATE POLICY "Public read attendance history" ON public.attendance_history FOR SELECT TO anon, authenticated USING (true);