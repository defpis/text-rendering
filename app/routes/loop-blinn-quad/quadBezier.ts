import { clone, inside, lerp2, type Point } from "./utils";

export interface QuadBezier {
  p1: Point;
  p2: Point;
  p3: Point;
}

export const insideQuad = (bezier: QuadBezier, point: Point): boolean => {
  return inside([bezier.p1, bezier.p2, bezier.p3], point);
};

export const splitQuad = (
  bezier: QuadBezier,
  time: number,
): [QuadBezier, QuadBezier] => {
  const p1 = lerp2(bezier.p1, bezier.p2, time);
  const p2 = lerp2(bezier.p2, bezier.p3, time);
  const p3 = lerp2(p1, p2, time);

  return [
    {
      p1: clone(bezier.p1),
      p2: p1,
      p3: p3,
    },
    {
      p1: p3,
      p2: p2,
      p3: clone(bezier.p3),
    },
  ];
};
