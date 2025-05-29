export interface Point {
  x: number;
  y: number;
}

export enum CurveType {
  POINT = "Point",
  LINE = "Line",
  QUADRATIC = "Quadratic",
  CUSP = "Cusp",
  LOOP = "Loop",
  SERPENTINE = "Serpentine",
}

export const clone = (p: Point) => {
  return { x: p.x, y: p.y };
};

export const lerp = (a: number, b: number, t: number) => {
  return a * (1 - t) + b * t;
};

export const lerp2 = (p1: Point, p2: Point, t: number) => {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
};

export const EPSILON = 1e-3;

export const toZero = (v: number, epsilon = EPSILON) => {
  return equal(v, 0, epsilon) ? 0 : v;
};

export const equal = (a: number, b: number, epsilon = EPSILON) => {
  return Math.abs(a - b) < epsilon;
};

export const equals = (p1: Point, p2: Point) => {
  return equal(p1.x, p2.x) && equal(p1.y, p2.y);
};

export const len = (p: Point) => {
  return Math.sqrt(p.x * p.x + p.y * p.y);
};

export const sub = (p1: Point, p2: Point) => {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
};

export const cross = (p1: Point, p2: Point) => {
  return p1.x * p2.y - p1.y * p2.x;
};

export const inside = (points: Point[], p: Point, epsilon = EPSILON) => {
  let count = 0;
  let curr = points[points.length - 1];

  points.forEach((next) => {
    const [p1, p2] = curr.y < next.y ? [curr, next] : [next, curr];

    if (p.y > p1.y + epsilon && p.y < p2.y + epsilon) {
      const v1 = sub(p1, p);
      const v2 = sub(p2, p1);

      if (cross(v1, v2) > 0) {
        count += 1;
      }
    }
    curr = next;
  });

  return count % 2 !== 0;
};

export const orientation = (p1: Point, p2: Point, p3: Point): number => {
  const v1 = sub(p2, p1);
  const v2 = sub(p3, p2);
  const prod = cross(v1, v2);
  return equal(prod, 0) ? 0 : prod < 0 ? -1 : 1;
};

export const linesIntersect = (
  p1: Point,
  q1: Point,
  p2: Point,
  q2: Point,
): boolean => {
  return (
    orientation(p1, q1, p2) !== orientation(p1, q1, q2) &&
    orientation(p2, q2, p1) !== orientation(p2, q2, q1)
  );
};
