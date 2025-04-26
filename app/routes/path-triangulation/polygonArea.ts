import type { vec2 } from "gl-matrix";
import { determinant2 } from "./utils";

export const polygonAreaSigned = (points: Array<vec2>): number => {
  if (points.length < 3) {
    return 0;
  }

  const lastIndex = points.length - 1;
  let area = 0;

  for (let i = 0; i < lastIndex; i++) {
    area += determinant2(points[i], points[i + 1]);
  }

  area += determinant2(points[lastIndex], points[0]);

  return area / 2;
};

export const polygonArea = (points: Array<vec2>): number => {
  return Math.abs(polygonAreaSigned(points));
};
