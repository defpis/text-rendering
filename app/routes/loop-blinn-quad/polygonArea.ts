import { cross, type Point } from "./utils";

export const polygonAreaSigned = (points: Array<Point>): number => {
  if (points.length < 3) {
    return 0;
  }

  const lastIndex = points.length - 1;
  let area = 0;

  for (let i = 0; i < lastIndex; i++) {
    area += cross(points[i], points[i + 1]);
  }

  area += cross(points[lastIndex], points[0]);

  return area / 2;
};
