import { vec2 } from "gl-matrix";
import { lerp } from "./utils";

export interface CubicBezier {
  p1: vec2;
  p2: vec2;
  p3: vec2;
  p4: vec2;
}

export const cubicBezierToPoints = (
  bezier: CubicBezier,
  splitThreshold: number,
): Array<vec2> => {
  const points = [vec2.clone(bezier.p1), vec2.clone(bezier.p4)];

  const cubicBezierSplit = (
    bezier: CubicBezier,
    min: number,
    max: number,
    insertIndex: number,
    splitFirst = false,
  ) => {
    const time = lerp(min, max, 0.5);

    const p1 = vec2.lerp(vec2.create(), bezier.p1, bezier.p2, time);
    const p2 = vec2.lerp(vec2.create(), bezier.p2, bezier.p3, time);
    const p3 = vec2.lerp(vec2.create(), bezier.p3, bezier.p4, time);

    const p4 = vec2.lerp(vec2.create(), p1, p2, time);
    const p5 = vec2.lerp(vec2.create(), p2, p3, time);

    const point = vec2.lerp(vec2.create(), p4, p5, time);

    const prevPoint = points[insertIndex - 1];
    const nextPoint = points[insertIndex];

    points.splice(insertIndex, 0, point);

    const prevVec = vec2.sub(vec2.create(), point, prevPoint);
    const nextVec = vec2.sub(vec2.create(), nextPoint, point);

    vec2.normalize(prevVec, prevVec);
    vec2.normalize(nextVec, nextVec);

    if (vec2.dot(prevVec, nextVec) > splitThreshold || splitFirst) {
      cubicBezierSplit(bezier, time, max, insertIndex + 1);
      cubicBezierSplit(bezier, min, time, insertIndex);
    }
  };

  cubicBezierSplit(bezier, 0, 1, 1, true);

  return points;
};
