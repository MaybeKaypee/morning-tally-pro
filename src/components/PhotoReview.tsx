import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMark, markDiameter, removeMark } from "@/lib/photo-review-marks";

const btn =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground transition hover:bg-accent";

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

type View = { zoom: number; x: number; y: number };
type Geom = { cw: number; ch: number; bw: number; bh: number };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep the photo inside the frame: no blank gap on the side that has content. */
function clampView(v: View, g: Geom | null): View {
  if (!g) return v;
  const sw = g.bw * v.zoom;
  const sh = g.bh * v.zoom;
  return {
    zoom: v.zoom,
    x: clamp(v.x, Math.min(0, g.cw - sw), Math.max(0, g.cw - sw)),
    y: clamp(v.y, Math.min(0, g.ch - sh), Math.max(0, g.ch - sh)),
  };
}

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
  const [review, setReview] = useState(() => ({ count: initialCount, marks: boxes }));
  const { count, marks } = review;
  const setCount = (update: (count: number) => number) => setReview((current) => ({ ...current, count: update(current.count) }));
  const containerRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ cw: number; ch: number } | null>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const geomRef = useRef<Geom | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // The photo is laid out at "fit" size; zoom is applied as a transform on top.
  const base = useMemo(() => {
    if (!natural || !frame) return null;
    const scale = Math.min(frame.cw / natural.w, frame.ch / natural.h, 1);
    return { bw: Math.max(1, Math.round(natural.w * scale)), bh: Math.max(1, Math.round(natural.h * scale)) };
  }, [natural, frame]);

  const diameter = useMemo(() => natural ? markDiameter(boxes, natural.w, natural.h) : 0, [boxes, natural]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const read = () => {
      const next = { cw: el.clientWidth, ch: el.clientHeight };
      setFrame((cur) => (cur && cur.cw === next.cw && cur.ch === next.ch ? cur : next));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure the photo off-screen so the on-screen <img> only mounts once its fit size is known.
  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setNatural({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = imageUrl;
    return () => { probe.onload = null; };
  }, [imageUrl]);


  // Reset to a centred fit whenever the photo or the frame size changes.
  useEffect(() => {
    if (!base || !frame) return;
    geomRef.current = { ...frame, ...base };
    setView({ zoom: 1, x: (frame.cw - base.bw) / 2, y: (frame.ch - base.bh) / 2 });
  }, [base, frame]);

  function fitView(): View {
    const g = geomRef.current;
    if (!g) return { zoom: 1, x: 0, y: 0 };
    return { zoom: 1, x: (g.cw - g.bw) / 2, y: (g.ch - g.bh) / 2 };
  }

  /** Scale to `next` while keeping the point (px, py) of the photo under the finger/cursor. */
  function zoomTo(px: number, py: number, next: number) {
    setView((v) => {
      const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
      if (target === v.zoom) return v;
      const k = target / v.zoom;
      return clampView({ zoom: target, x: px - (px - v.x) * k, y: py - (py - v.y) * k }, geomRef.current);
    });
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 };
  };

  const active = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null);
  const lastSingle = useRef<{ x: number; y: number } | null>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Capturing the pointer here would retarget the click, so leave control taps alone.
    if ((e.target as HTMLElement).closest("button")) return;
    const p = local(e);

    active.current.set(e.pointerId, p);
    tapStart.current = active.current.size === 1 ? p : null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    if (active.current.size === 2) {
      const [a, b] = [...active.current.values()];
      pinchStart.current = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: viewRef.current.zoom };
      lastSingle.current = null;
    } else {
      lastSingle.current = p;
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!active.current.has(e.pointerId)) return;
    const p = local(e);
    if (tapStart.current && Math.hypot(p.x - tapStart.current.x, p.y - tapStart.current.y) > 6) tapStart.current = null;
    active.current.set(e.pointerId, p);
    if (active.current.size >= 2) {
      const [a, b] = [...active.current.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const start = (pinchStart.current ??= { dist, zoom: viewRef.current.zoom });
      zoomTo((a.x + b.x) / 2, (a.y + b.y) / 2, start.zoom * (dist / start.dist));
    } else if (lastSingle.current) {
      const dx = p.x - lastSingle.current.x;
      const dy = p.y - lastSingle.current.y;
      lastSingle.current = p;
      if (dx || dy) setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }, geomRef.current));
    }
  }

  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (e.type === "pointerup" && active.current.size === 1 && tapStart.current && base && natural) {
      const p = local(e);
      const v = viewRef.current;
      const x = (p.x - v.x) / (base.bw * v.zoom);
      const y = (p.y - v.y) / (base.bh * v.zoom);
      setReview((current) => addMark(current, x, y, diameter / natural.w, diameter / natural.h));
    }
    tapStart.current = null;
    active.current.delete(e.pointerId);
    if (active.current.size < 2) pinchStart.current = null;
    lastSingle.current = active.current.size === 1 ? [...active.current.values()][0] : null;
  }

  // Wheel / trackpad pinch: native listener so preventDefault actually works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      zoomTo(e.clientX - rect.left, e.clientY - rect.top, viewRef.current.zoom * Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomCentre(factor: number) {
    const g = geomRef.current;
    if (!g) return;
    zoomTo(g.cw / 2, g.ch / 2, viewRef.current.zoom * factor);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-3 py-3">
        <Button type="button" variant="ghost" size="icon" aria-label="Back to form" onClick={onCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Review photo</h2>
          <p className="text-xs text-muted-foreground">
            {marks.length} check mark{marks.length === 1 ? "" : "s"} marked
          </p>
        </div>
      </header>

      <div
        ref={containerRef}
        className="relative flex-1 touch-none select-none overflow-hidden bg-muted/20"
        style={{ cursor: view.zoom > 1.01 ? "grab" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {base && (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: base.bw,
              height: base.bh,
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
              willChange: "transform",
            }}
          >
            <img
              src={imageUrl}
              alt="Taken attendance sheet"
              draggable={false}
              className="block h-full w-full border"
            />

            {natural && marks.map((box, i) => (
              <Button
                key={i}
                type="button"
                variant="ghost"
                aria-label={`Remove check mark ${i + 1}`}
                title="Remove check mark"
                onClick={() => setReview((current) => removeMark(current, i))}
                className="absolute min-h-0 min-w-0 rounded-full border-primary bg-primary/20 p-0 hover:bg-primary/40"
                style={{
                  left: `${(box.x + box.w / 2) * 100}%`,
                  top: `${(box.y + box.h / 2) * 100}%`,
                  width: `${diameter / natural.w * 100}%`,
                  height: `${diameter / natural.h * 100}%`,
                  transform: "translate(-50%, -50%)",
                  borderWidth: `${2 / view.zoom}px`,
                  borderStyle: "solid",
                }}
              />
            ))}
          </div>
        )}

        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full border bg-card/95 px-1 py-2 shadow-sm backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            title="Zoom out"
            className="h-8 w-8 rounded-full"
            onClick={() => zoomCentre(1 / 1.4)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(view.zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            title="Zoom in"
            className="h-8 w-8 rounded-full"
            onClick={() => zoomCentre(1.4)}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Fit photo"
            title="Fit photo"
            className="h-8 w-8 rounded-full"
            onClick={() => setView(fitView())}
          >
            <Maximize className="h-4 w-4" />
          </Button>
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
