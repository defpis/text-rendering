export const EPSILON = 0.000001;

export interface Point {
  x: number;
  y: number;
}

export const lerp = (a: number, b: number, t: number) => {
  return a * (1 - t) + b * t;
};

export const lerp2 = (p1: Point, p2: Point, t: number) => {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
};

export const clone = (p: Point) => {
  return { x: p.x, y: p.y };
};

export const equals = (p1: Point, p2: Point) => {
  return Math.abs(p1.x - p2.x) < EPSILON && Math.abs(p1.y - p2.y) < EPSILON;
};

export const sub = (p1: Point, p2: Point) => {
  return { x: p1.x - p2.x, y: p1.y - p2.y };
};

export const determinant2 = (p1: Point, p2: Point) => {
  return p1.x * p2.y - p1.y * p2.x;
};

export const inside = (points: Point[], p: Point) => {
  let count = 0;
  let curr = points[points.length - 1];

  points.forEach((next) => {
    const p1 = curr.y < next.y ? curr : next;
    const p2 = curr.y < next.y ? next : curr;

    if (p1.y < p.y + EPSILON && p2.y > p.y + EPSILON) {
      const v1 = sub(p2, p1);
      const v2 = sub(p, p1);

      if (determinant2(v1, v2) > 0) {
        count += 1;
      }
    }
    curr = next;
  });

  return count % 2 !== 0;
};
