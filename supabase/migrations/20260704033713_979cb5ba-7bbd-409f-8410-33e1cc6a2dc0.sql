-- Log DELETE actions on attendance into history
CREATE OR REPLACE FUNCTION public.log_attendance_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.attendance_history
    (attendance_id, classroom_id, attendance_date, on_time_count, late_count, action, changed_by)
  VALUES
    (OLD.id, OLD.classroom_id, OLD.attendance_date, OLD.on_time_count, OLD.late_count, 'delete', auth.uid());
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS attendance_log_change ON public.attendance;
DROP TRIGGER IF EXISTS attendance_log_delete ON public.attendance;

CREATE TRIGGER attendance_log_change
AFTER INSERT OR UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.log_attendance_change();

CREATE TRIGGER attendance_log_delete
AFTER DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.log_attendance_delete();

-- Allow attendance_id to remain after deletion (already nullable per schema)
ALTER TABLE public.attendance_history
  DROP CONSTRAINT IF EXISTS attendance_history_attendance_id_fkey;