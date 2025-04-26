import { vec2 } from "gl-matrix";
import { lerp } from "./utils";

export interface QuadBezier {
  p1: vec2;
  p2: vec2;
  p3: vec2;
}

export const quadBezierToPoints = (
  bezier: QuadBezier,
  splitBoundary: number,
): Array<vec2> => {
  const points = [vec2.clone(bezier.p1), vec2.clone(bezier.p3)];

  const quadraticBezierSplit = (
    bezier: QuadBezier,
    min: number,
    max: number,
    insertIndex: number,
  ) => {
    const time = lerp(min, max, 0.5);

    const p1 = vec2.lerp(vec2.create(), bezier.p1, bezier.p2, time);
    const p2 = vec2.lerp(vec2.create(), bezier.p2, bezier.p3, time);

    const point = vec2.lerp(vec2.create(), p1, p2, time);

    const prevPoint = points[insertIndex - 1];
    const nextPoint = points[insertIndex];

    points.splice(insertIndex, 0, point);

    const prevVec = vec2.sub(vec2.create(), point, prevPoint);
    const nextVec = vec2.sub(vec2.create(), nextPoint, point);

    vec2.normalize(prevVec, prevVec);
    vec2.normalize(nextVec, nextVec);

    if (vec2.dot(prevVec, nextVec) < splitBoundary) {
      quadraticBezierSplit(bezier, time, max, insertIndex + 1);
      quadraticBezierSplit(bezier, min, time, insertIndex);
    }
  };

  quadraticBezierSplit(bezier, 0, 1, 1);

  return points;
};
