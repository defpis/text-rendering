import { equals, lerp2, mid2, type Point } from "./utils";

export interface Curve {
  p1: Point;
  p2: Point;
  p3: Point;
}

export class Glyph {
  glyph: opentype.Glyph;
  curves: Curve[] = [];

  constructor(glyph: opentype.Glyph) {
    this.glyph = glyph;
  }

  get index() {
    return this.glyph.index;
  }

  prepare() {
    const { commands } = this.glyph.getPath(0, 0, 1);

    let p = { x: 0, y: 0 };

    while (commands.length) {
      const cmd = commands.shift()!;

      switch (cmd.type) {
        case "M":
        case "L": {
          const n = { x: cmd.x, y: cmd.y };

          if (equals(p, n)) {
            continue;
          }

          const m = mid2(p, n);

          this.curves.push({
            p1: p,
            p2: m,
            p3: n,
          });

          p = n;
          break;
        }
        case "Z":
          p = { x: 0, y: 0 };
          break;
        case "Q": {
          const c = { x: cmd.x1, y: cmd.y1 };
          const n = { x: cmd.x, y: cmd.y };

          this.curves.push({
            p1: p,
            p2: c,
            p3: n,
          });

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

          this.curves.push(
            {
              p1: p,
              p2: c3,
              p3: d,
            },
            {
              p1: d,
              p2: c4,
              p3: n,
            },
          );

          p = n;
          break;
        }
      }
    }
  }
}
