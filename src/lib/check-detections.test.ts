/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { countPresentDetections } from "./check-detections";

function output(rows: number[][]) {
  return new Float32Array(Array.from({ length: 6 }, (_, channel) => rows.map((row) => row[channel])).flat());
}

describe("uploaded attendance model", () => {
  test("counts present class 1 but not leave class 0", () => {
    expect(countPresentDetections(output([[50, 50, 20, 20, 0.1, 0.9], [150, 50, 20, 20, 0.9, 0.1]]), 2)).toBe(1);
  });
  test("suppresses duplicate present boxes", () => {
    expect(countPresentDetections(output([[50, 50, 20, 20, 0.1, 0.9], [51, 50, 20, 20, 0.1, 0.8], [150, 50, 20, 20, 0.1, 0.9]]), 3)).toBe(2);
  });
  test("ignores detections below 25 percent confidence", () => {
    expect(countPresentDetections(output([[50, 50, 20, 20, 0.1, 0.24]]), 1)).toBe(0);
  });
  test("rejects a mismatched output shape", () => {
    expect(() => countPresentDetections(new Float32Array(5), 1)).toThrow();
  });
});