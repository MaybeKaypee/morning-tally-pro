
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS classrooms_code_key ON public.classrooms (code) WHERE code IS NOT NULL;

-- Seed codes for existing M5/N classrooms as 50N
UPDATE public.classrooms
SET code = '5' || lpad(split_part(classroom_name, '/', 2), 2, '0')
WHERE code IS NULL
  AND classroom_name ~ '^M5/[0-9]+$';

CREATE OR REPLACE FUNCTION public.log_attendance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := 'insert';
  ELSE
    -- If the update just filled in a previously-empty field
    -- (0 -> new value) without changing the other, treat it as an insert.
    IF (OLD.on_time_count = 0 AND NEW.on_time_count <> 0 AND OLD.late_count = NEW.late_count)
       OR (OLD.late_count = 0 AND NEW.late_count <> 0 AND OLD.on_time_count = NEW.on_time_count)
       OR (OLD.on_time_count = NEW.on_time_count AND OLD.late_count = NEW.late_count) THEN
      act := 'insert';
    ELSE
      act := 'update';
    END IF;
  END IF;

  INSERT INTO public.attendance_history
    (attendance_id, classroom_id, attendance_date, on_time_count, late_count, action)
  VALUES
    (NEW.id, NEW.classroom_id, NEW.attendance_date, NEW.on_time_count, NEW.late_count, act);
  RETURN NEW;
END;
$function$;
