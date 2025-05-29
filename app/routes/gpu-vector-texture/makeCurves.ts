import { equals, lerp2, mid2, type Point } from "./utils";

export interface Curve {
  p1: Point;
  p2: Point;
  p3: Point;
}

export const makeCurves = (glyph: opentype.Glyph, flip: boolean) => {
  const curves: Curve[] = [];

  const addCurve = (p1: Point, p2: Point, p3: Point) => {
    if (flip) {
      curves.push({ p1, p2, p3 });
    } else {
      curves.push({ p1: p3, p2, p3: p1 });
    }
  };

  const { commands } = glyph.getPath(0, 0, 1);

  let p = { x: 0, y: 0 };

  while (commands.length) {
    const cmd = commands.shift()!;

    switch (cmd.type) {
      case "M":
        p = { x: cmd.x, y: cmd.y };
        break;
      case "L": {
        const n = { x: cmd.x, y: cmd.y };

        if (equals(p, n)) {
          continue;
        }

        const m = mid2(p, n);

        addCurve(p, m, n);

        p = n;
        break;
      }
      case "Z":
        p = { x: 0, y: 0 };
        break;
      case "Q": {
        const c = { x: cmd.x1, y: cmd.y1 };
        const n = { x: cmd.x, y: cmd.y };

        addCurve(p, c, n);

        p = n;
        break;
      }
      case "C": {
        const c1 = { x: cmd.x1, y: cmd.y1 };
        const c2 = { x: cmd.x2, y: cmd.y2 };
        const n = { x: cmd.x, y: cmd.y };

        const c3 = lerp2(p, c1, 3 / 4);
        const c4 = lerp2(n, c2, 3 / 4);

        const d = lerp2(c3, c4, 1 / 2);

        addCurve(p, c3, d);
        addCurve(d, c4, n);

        p = n;
        break;
      }
    }
  }

  return curves;
};
