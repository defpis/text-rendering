export interface Point {
  x: number;
  y: number;
}

export const equal = (a: number, b: number, epsilon = Number.EPSILON) => {
  return Math.abs(a - b) < epsilon;
};

export const equals = (p1: Point, p2: Point) => {
  return equal(p1.x, p2.x) && equal(p1.y, p2.y);
};

export const mid = (a: number, b: number) => {
  return (a + b) / 2;
};

export const mid2 = (p1: Point, p2: Point) => {
  return {
    x: mid(p1.x, p2.x),
    y: mid(p1.y, p2.y),
  };
};

export const lerp = (a: number, b: number, t: number) => {
  return a * (1 - t) + b * t; // a + (b - a) * t;
};

export const lerp2 = (p1: Point, p2: Point, t: number) => {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
};
