import { clone, inside, lerp2, type Point } from "./utils";

export interface CubicBezier {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

export type NestPointItem = Point | Point[];
export type NestPoints = (NestPointItem | NestPoints)[];

export interface CubicBezierSplitResult extends CubicBezier {
  points: NestPoints;
  cubics?: CubicBezierSplitResult[];
}

export const insideCubic = (bezier: CubicBezier, point: Point): boolean => {
  return inside([bezier.p0, bezier.p1, bezier.p2, bezier.p3], point);
};

export const splitCubic = (
  bezier: CubicBezier,
  time: number,
): [CubicBezierSplitResult, CubicBezierSplitResult] => {
  const p01 = lerp2(bezier.p0, bezier.p1, time);
  const p12 = lerp2(bezier.p1, bezier.p2, time);
  const p23 = lerp2(bezier.p2, bezier.p3, time);

  const p012 = lerp2(p01, p12, time);
  const p123 = lerp2(p12, p23, time);

  const p0123 = lerp2(p012, p123, time);

  return [
    {
      points: [],
      p0: clone(bezier.p0),
      p1: p01,
      p2: p012,
      p3: p0123,
    },
    {
      points: [],
      p0: p0123,
      p1: p123,
      p2: p23,
      p3: clone(bezier.p3),
    },
  ];
};
