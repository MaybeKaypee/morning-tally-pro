import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { fittedPhotoSize } from "./prepare-photo";

describe("camera photo dimensions", () => {
  test("reduces a 4032 by 5376 portrait without changing its proportions", () => {
    assert.deepEqual(fittedPhotoSize(4032, 5376), { width: 1536, height: 2048 });
  });
  test("keeps EXIF-oriented landscape proportions", () => {
    assert.deepEqual(fittedPhotoSize(5376, 4032), { width: 2048, height: 1536 });
  });
  test("does not enlarge smaller photos", () => {
    assert.deepEqual(fittedPhotoSize(600, 800), { width: 600, height: 800 });
  });
  test("rejects invalid decoded dimensions", () => {
    assert.throws(() => fittedPhotoSize(0, 800));
    assert.throws(() => fittedPhotoSize(NaN, 800));
  });
});