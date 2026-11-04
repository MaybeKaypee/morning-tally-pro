import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { addMark, markDiameter, removeMark } from "./photo-review-marks";

describe("photo review corrections", () => {
  const marks = [{ x: 0.1, y: 0.2, w: 0.04, h: 0.02 }];
  test("removing a circle subtracts exactly one", () => {
    assert.deepEqual(removeMark({ count: 5, marks }, 0), { count: 4, marks: [] });
    assert.equal(removeMark({ count: 0, marks }, 0).count, 0);
  });
  test("adding a circle centers it at the tapped position and adds one", () => {
    const next = addMark({ count: 5, marks }, 0.5, 0.6, 0.04, 0.02);
    assert.equal(next.count, 6);
    assert.deepEqual(next.marks[1], { x: 0.48, y: 0.59, w: 0.04, h: 0.02 });
  });
  test("new circles match the typical existing diameter", () => {
    assert.equal(markDiameter(marks, 1000, 2000), 40);
  });
  test("taps outside the photo do not change the count", () => {
    const state = { count: 5, marks };
    assert.equal(addMark(state, -0.1, 0.5, 0.04, 0.02), state);
    assert.equal(addMark(state, 0.5, 1.1, 0.04, 0.02), state);
  });
});