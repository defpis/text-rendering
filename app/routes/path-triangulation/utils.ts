import { vec2 } from "gl-matrix";

export const EPSILON = 0.000001;

export const lerp = (a: number, b: number, t: number) => {
  return a * (1 - t) + b * t;
};

export const determinant2 = (p1: vec2, p2: vec2) => {
  return p1[0] * p2[1] - p1[1] * p2[0];
};

export const inside = (points: vec2[], p: vec2) => {
  let count = 0;
  let curr = points[points.length - 1];

  points.forEach((next) => {
    const p1 = curr[1] < next[1] ? curr : next;
    const p2 = curr[1] < next[1] ? next : curr;

    if (p1[1] < p[1] + EPSILON && p2[1] > p[1] + EPSILON) {
      const v1 = vec2.sub(vec2.create(), p2, p1);
      const v2 = vec2.sub(vec2.create(), p, p1);

      if (determinant2(v1, v2) > 0) {
        count += 1;
      }
    }
    curr = next;
  });

  return count % 2 !== 0;
};
