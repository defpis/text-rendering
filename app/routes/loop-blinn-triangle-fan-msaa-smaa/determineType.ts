import { vec3 } from "gl-matrix";
import { CurveType, equals, toZero, type Point } from "./utils";

export const determineType = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): [number, number, number, CurveType] => {
  if (equals(p0, p1) && equals(p1, p2) && equals(p2, p3)) {
    return [0, 0, 0, CurveType.POINT];
  }

  const b0 = vec3.fromValues(p0.x, p0.y, 1.0);
  const b1 = vec3.fromValues(p1.x, p1.y, 1.0);
  const b2 = vec3.fromValues(p2.x, p2.y, 1.0);
  const b3 = vec3.fromValues(p3.x, p3.y, 1.0);

  const a1 = vec3.dot(b0, vec3.cross(vec3.create(), b3, b2));
  const a2 = vec3.dot(b1, vec3.cross(vec3.create(), b0, b3));
  const a3 = vec3.dot(b2, vec3.cross(vec3.create(), b1, b0));

  let d3 = 3 * a3;
  let d2 = d3 - a2;
  let d1 = d2 - a2 + a1;

  const max = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3);

  d1 /= max;
  d2 /= max;
  d3 /= max;

  let D = 3 * d2 * d2 - 4 * d1 * d3;
  let disc = d1 * d1 * D;

  d1 = toZero(d1);
  d2 = toZero(d2);
  d3 = toZero(d3);
  D = toZero(D);
  disc = toZero(disc);

  const d: [number, number, number] = [d1, d2, d3];

  if (!disc) {
    if (!d1 && !d2) {
      if (!d3) {
        return [...d, CurveType.LINE];
      }
      return [...d, CurveType.QUADRATIC];
    }

    if (!d1) {
      return [...d, CurveType.CUSP];
    }

    return D < 0 ? [...d, CurveType.LOOP] : [...d, CurveType.SERPENTINE];
  }

  return disc > 0 ? [...d, CurveType.SERPENTINE] : [...d, CurveType.LOOP];
};
