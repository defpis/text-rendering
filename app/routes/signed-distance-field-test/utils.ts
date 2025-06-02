export interface Point {
  x: number;
  y: number;
}

export interface Curve {
  p0: Point;
  p1: Point;
  p2: Point;
}

export const lerp = (a: number, b: number, t: number) => {
  return a * (1 - t) + b * t;
};

export const lerp2 = (a: Point, b: Point, t: number) => {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
};

export const len = (p: Point) => {
  return Math.sqrt(p.x * p.x + p.y * p.y);
};

export const normalize = (p: Point): Point => {
  const l = len(p);
  if (l === 0) return { x: 0, y: 0 };
  return { x: p.x / l, y: p.y / l };
};

export const dot = (a: Point, b: Point): number => {
  return a.x * b.x + a.y * b.y;
};

export const cross = (a: Point, b: Point) => {
  return a.x * b.y - a.y * b.x;
};

export const sub = (a: Point, ...rest: Point[]) => {
  return rest.reduce((acc, cur) => {
    return { x: acc.x - cur.x, y: acc.y - cur.y };
  }, a);
};

export const rotate = (point: Point, angle: number) => {
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
  };
};

export const add = (...rest: Point[]): Point => {
  return rest.reduce(
    (acc, cur) => {
      return { x: acc.x + cur.x, y: acc.y + cur.y };
    },
    { x: 0, y: 0 },
  );
};

export const multiply = (p: Point, scalar: number): Point => {
  return { x: p.x * scalar, y: p.y * scalar };
};

export const bbox = (points: Point[], padding = 0) => {
  const x = points.map((p) => p.x);
  const y = points.map((p) => p.y);
  return {
    min: { x: Math.min(...x) - padding, y: Math.min(...y) - padding },
    max: { x: Math.max(...x) + padding, y: Math.max(...y) + padding },
  };
};
