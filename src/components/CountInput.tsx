import { useRef, useState } from "react";
import { Camera, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PhotoReview } from "@/components/PhotoReview";
import type { CountResult } from "@/lib/count-checks-model";

const btn =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground transition hover:bg-accent disabled:opacity-50";

export function CountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ imageUrl: string; result: CountResult } | null>(null);

  const step = (d: number) => {
    const n = value.trim() === "" ? 0 : Number(value) || 0;
    onChange(String(Math.max(0, n + d)));
  };

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { countPhotoWithModel } = await import("@/lib/count-checks-model");
      const result = await countPhotoWithModel(file);
      setReview({ imageUrl: URL.createObjectURL(file), result });
    } catch (err: unknown) {
      console.error("Photo model failed", err);
      toast.error("Could not count the photo. Try again or enter the number manually.");
    } finally {
      setBusy(false);
    }
  }

  function closeReview() {
    if (review) URL.revokeObjectURL(review.imageUrl);
    setReview(null);
  }

  return (
    <>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Decrease" title="Decrease" disabled={busy} className={btn} onClick={() => step(-1)}>
          <Minus className="h-5 w-5" />
        </Button>
        <input
          type="number" min={0} step={1} inputMode="numeric"
          value={value} disabled={busy} onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-center text-base outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="button" variant="outline" size="icon" aria-label="Increase" title="Increase" disabled={busy} className={btn} onClick={() => step(1)}>
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          type="button" size="icon" aria-label="Take photo to count" title={busy ? "Counting photo…" : "Take photo to count"} disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </div>
      {review && (
        <PhotoReview
          imageUrl={review.imageUrl}
          initialCount={review.result.count}
          boxes={review.result.boxes}
          onCancel={closeReview}
          onConfirm={(count) => {
            closeReview();
            onChange(String(count));
            toast.success(`Counted ${count} check marks. Please double-check and fix with − / +.`);
          }}
        />
      )}
    </>
  );
}
