import modelAsset from "@/assets/best_int8.onnx.asset.json";
import wasmAsset from "@/assets/ort-wasm-simd-threaded.wasm.asset.json";
import loaderAsset from "@/assets/ort-wasm-simd-threaded.mjs.asset.json";
import { countPresentDetections, detectPresentBoxes } from "./check-detections";
import type { InferenceSession } from "onnxruntime-web";

let sessionPromise: Promise<InferenceSession> | undefined;

export type PhotoBox = { x: number; y: number; w: number; h: number; score: number };
export type CountResult = { count: number; boxes: PhotoBox[] };

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = {
        wasm: new URL(wasmAsset.url, window.location.origin).href,
        mjs: new URL(loaderAsset.url, window.location.origin).href,
      };
      return ort.InferenceSession.create(modelAsset.url, { executionProviders: ["wasm"] });
    })().catch((error) => { sessionPromise = undefined; throw error; });
  }
  return sessionPromise;
}

export async function countPhotoWithModel(file: File): Promise<CountResult> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not open this photo. Try a JPG or PNG."));
      img.src = url;
    });
    const size = 640;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable on this browser.");
    // Ultralytics letterboxing uses neutral 114 padding and RGB / 255.
    context.fillStyle = "rgb(114, 114, 114)";
    context.fillRect(0, 0, size, size);
    const scale = Math.min(size / image.width, size / image.height);
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);
    const padX = Math.round((size - width) / 2);
    const padY = Math.round((size - height) / 2);
    context.drawImage(image, padX, padY, width, height);
    const pixels = context.getImageData(0, 0, size, size).data;
    const area = size * size;
    const input = new Float32Array(3 * area);
    for (let i = 0; i < area; i++) {
      input[i] = pixels[i * 4] / 255;
      input[area + i] = pixels[i * 4 + 1] / 255;
      input[area * 2 + i] = pixels[i * 4 + 2] / 255;
    }
    const session = await getSession();
    const { Tensor } = await import("onnxruntime-web/wasm");
    const tensor = new Tensor("float32", input, [1, 3, size, size]);
    try {
      const outputs = await session.run({ images: tensor });
      try {
        const output = outputs.output0;
        if (!output || output.dims[1] !== 6 || !(output.data instanceof Float32Array)) throw new Error("Unexpected model output.");
        const columns = output.dims[2];
        const detected = detectPresentBoxes(output.data, columns);
        // Map the letterboxed 640-space boxes back onto the original photo (normalized 0-1).
        const boxes: PhotoBox[] = detected.map((box) => {
          const x = Math.max(0, (box.x * size - padX) / scale);
          const y = Math.max(0, (box.y * size - padY) / scale);
          const w = Math.min(image.width - x, (box.w * size) / scale);
          const h = Math.min(image.height - y, (box.h * size) / scale);
          return { x: x / image.width, y: y / image.height, w: w / image.width, h: h / image.height, score: box.score };
        });
        return { count: countPresentDetections(output.data, columns), boxes };
      } finally {
        Object.values(outputs).forEach((output) => output.dispose());
      }
    } finally {
      tensor.dispose();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
