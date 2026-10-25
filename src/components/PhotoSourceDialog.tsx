import { Camera, Images, X } from "lucide-react";

export function PhotoSourceDialog({
  open,
  onCamera,
  onGallery,
  onCancel,
}: {
  open: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Add a photo</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose where the photo comes from.
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onCamera}
            className="flex h-14 items-center gap-3 rounded-xl border bg-background px-4 text-left text-sm font-medium hover:bg-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Camera className="h-5 w-5" />
            </span>
            Take photo
          </button>
          <button
            type="button"
            onClick={onGallery}
            className="flex h-14 items-center gap-3 rounded-xl border bg-background px-4 text-left text-sm font-medium hover:bg-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Images className="h-5 w-5" />
            </span>
            Choose from gallery
          </button>
        </div>
      </div>
    </div>
  );
}
