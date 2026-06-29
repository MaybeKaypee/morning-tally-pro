
-- Add updated_at to attendance + auto-update trigger
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_updated_at ON public.attendance;
CREATE TRIGGER trg_attendance_updated_at
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- History/audit log of submissions and edits
CREATE TABLE IF NOT EXISTS public.attendance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id uuid,
  classroom_id uuid NOT NULL,
  attendance_date date NOT NULL,
  on_time_count integer NOT NULL,
  late_count integer NOT NULL,
  action text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.attendance_history TO authenticated;
GRANT ALL ON public.attendance_history TO service_role;

ALTER TABLE public.attendance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read attendance history" ON public.attendance_history;
CREATE POLICY "Admins read attendance history"
ON public.attendance_history FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendance_history
    (attendance_id, classroom_id, attendance_date, on_time_count, late_count, action)
  VALUES
    (NEW.id, NEW.classroom_id, NEW.attendance_date, NEW.on_time_count, NEW.late_count,
     CASE WHEN TG_OP = 'INSERT' THEN 'insert' ELSE 'update' END);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_history ON public.attendance;
CREATE TRIGGER trg_attendance_history
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.log_attendance_change();

CREATE INDEX IF NOT EXISTS idx_attendance_history_classroom_date
  ON public.attendance_history (classroom_id, attendance_date, changed_at DESC);
