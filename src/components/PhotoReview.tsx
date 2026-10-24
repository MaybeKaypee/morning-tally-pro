import { useState } from "react";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const btn =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground transition hover:bg-accent";

export function PhotoReview({
  imageUrl,
  initialCount,
  boxes,
  onCancel,
  onConfirm,
}: {
  imageUrl: string;
  initialCount: number;
  boxes: { x: number; y: number; w: number; h: number }[];
  onCancel: () => void;
  onConfirm: (count: number) => void;
}) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to form" onClick={onCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Review photo</h2>
          <p className="text-xs text-muted-foreground">
            {boxes.length} check mark{boxes.length === 1 ? "" : "s"} detected
          </p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-auto p-4">
        <div className="relative inline-block">
          <img
            src={imageUrl}
            alt="Taken attendance sheet"
            className="block max-h-[55vh] max-w-full rounded-xl border"
          />
          {boxes.map((box, i) => (
            <div
              key={i}
              className="pointer-events-none absolute rounded border-2 border-primary bg-primary/10"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="border-t bg-card p-4">
        <span className="mb-1.5 block text-sm font-medium text-foreground">Check marks counted</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Decrease" title="Decrease" className={btn} onClick={() => setCount((c) => Math.max(0, c - 1))}>
            <Minus className="h-5 w-5" />
          </Button>
          <div className="flex h-12 flex-1 items-center justify-center rounded-xl border bg-background text-lg font-semibold text-foreground">
            {count}
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Increase" title="Increase" className={btn} onClick={() => setCount((c) => c + 1)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
        <Button
          type="button"
          className="mt-3 h-12 w-full rounded-xl text-base font-medium"
          onClick={() => onConfirm(count)}
        >
          Use this count
        </Button>
      </div>
    </div>
  );
}
