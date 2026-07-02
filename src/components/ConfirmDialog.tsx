import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            destructive ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"
          }`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{title}</h2>
            <div className="mt-1 text-sm text-muted-foreground">{message}</div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel}
            className="h-10 rounded-xl border px-4 text-sm hover:bg-accent">{cancelLabel}</button>
          <button onClick={onConfirm}
            className={`h-10 rounded-xl px-4 text-sm font-medium text-primary-foreground ${
              destructive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            }`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
