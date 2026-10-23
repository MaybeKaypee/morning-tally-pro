import { useRef, useState } from "react";
import { Camera, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { countCheckMarks } from "@/lib/count-checks.functions";

async function resizeToDataUrl(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const btn =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground transition hover:bg-accent disabled:opacity-50";

export function CountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const count = useServerFn(countCheckMarks);

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
      const image = await resizeToDataUrl(file);
      const { count: n } = await count({ data: { image } });
      onChange(String(n));
      toast.success(`Counted ${n} check marks. Please double-check and fix with − / +.`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not count the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button type="button" aria-label="Decrease" className={btn} onClick={() => step(-1)}>
        <Minus className="h-5 w-5" />
      </button>
      <input
        type="number" min={0} step={1} inputMode="numeric"
        value={value} onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full min-w-0 rounded-xl border bg-background px-3 text-center text-base outline-none focus:ring-2 focus:ring-primary"
      />
      <button type="button" aria-label="Increase" className={btn} onClick={() => step(1)}>
        <Plus className="h-5 w-5" />
      </button>
      <button
        type="button" aria-label="Take photo to count" disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>
  );
}
