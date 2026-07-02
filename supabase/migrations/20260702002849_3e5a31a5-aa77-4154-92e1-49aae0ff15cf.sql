
-- Make late_count nullable so we can distinguish "total not yet submitted" from "0 late".
ALTER TABLE public.attendance ALTER COLUMN late_count DROP NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN late_count DROP DEFAULT;
ALTER TABLE public.attendance_history ALTER COLUMN late_count DROP NOT NULL;

-- Track who caused each history entry (null = public form submission).
ALTER TABLE public.attendance_history ADD COLUMN IF NOT EXISTS changed_by uuid;

-- Rewrite trigger to distinguish insert (partial), submit (complete), update (overwrite).
CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  act text;
  new_complete boolean := (NEW.on_time_count > 0) AND (NEW.late_count IS NOT NULL);
  old_complete boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := CASE WHEN new_complete THEN 'submit' ELSE 'insert' END;
  ELSE
    old_complete := (OLD.on_time_count > 0) AND (OLD.late_count IS NOT NULL);
    IF OLD.on_time_count = NEW.on_time_count
       AND OLD.late_count IS NOT DISTINCT FROM NEW.late_count THEN
      act := CASE WHEN new_complete THEN 'submit' ELSE 'insert' END;
    ELSIF (NOT old_complete) AND new_complete THEN
      act := 'submit';
    ELSIF (NOT old_complete) AND (NOT new_complete) THEN
      act := 'insert';
    ELSE
      act := 'update';
    END IF;
  END IF;

  INSERT INTO public.attendance_history
    (attendance_id, classroom_id, attendance_date, on_time_count, late_count, action, changed_by)
  VALUES
    (NEW.id, NEW.classroom_id, NEW.attendance_date, NEW.on_time_count, NEW.late_count, act, auth.uid());
  RETURN NEW;
END;
$$;
