import { determineType } from "./determineType";
import { CurveType, lerp2, type Point } from "./utils";

export interface KlmResult extends Point {
  k: number;
  l: number;
  m: number;
}

export const computeCubic = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  recursiveType = -1,
): Array<KlmResult[]> => {
  const [d1, d2, d3, type] = determineType(p0, p1, p2, p3);

  const oneThird = 1.0 / 3.0;
  const twoThirds = 2.0 / 3.0;

  const klm: number[] = new Array(12).fill(0);

  let flip = false;
  let splitType = -1;
  let splitTime = 0;

  switch (type) {
    case CurveType.SERPENTINE: {
      const t1 = Math.sqrt(9 * d2 * d2 - 12 * d1 * d3);
      const ls = 3 * d2 - t1;
      const lt = 6 * d1;
      const ms = 3 * d2 + t1;
      const mt = lt;
      const ltMinusLs = lt - ls;
      const mtMinusMs = mt - ms;

      klm[0] = ls * ms;
      klm[1] = ls ** 3;
      klm[2] = ms ** 3;

      klm[3] = oneThird * (3 * ls * ms - ls * mt - lt * ms);
      klm[4] = ls ** 2 * (ls - lt);
      klm[5] = ms ** 2 * (ms - mt);

      klm[6] = oneThird * (lt * (mt - 2 * ms) + ls * (3 * ms - 2 * mt));
      klm[7] = ltMinusLs ** 2 * ls;
      klm[8] = mtMinusMs ** 2 * ms;

      klm[9] = ltMinusLs * mtMinusMs;
      klm[10] = -(ltMinusLs ** 3);
      klm[11] = -(mtMinusMs ** 3);

      if (d1 < 0) flip = true;

      break;
    }

    case CurveType.LOOP: {
      const t1 = Math.sqrt(4 * d1 * d3 - 3 * d2 ** 2);
      const ls = d2 - t1;
      const lt = 2 * d1;
      const ms = d2 + t1;
      const mt = lt;
      const ltMinusLs = lt - ls;
      const mtMinusMs = mt - ms;

      const ql = ls / lt;
      const qm = ms / mt;
      if (ql > 0 && ql < 1) {
        splitType = 0;
        splitTime = ql;
      }
      if (qm > 0 && qm < 1) {
        splitType = 1;
        splitTime = qm;
      }

      klm[0] = ls * ms;
      klm[1] = ls ** 2 * ms;
      klm[2] = ls * ms ** 2;

      klm[3] = oneThird * (3 * ls * ms - ls * mt - lt * ms);
      klm[4] = -oneThird * ls * (ls * (mt - 3 * ms) + 2 * lt * ms);
      klm[5] = -oneThird * ms * (ls * (2 * mt - 3 * ms) + lt * ms);

      klm[6] = oneThird * (lt * (mt - 2 * ms) + ls * (3 * ms - 2 * mt));
      klm[7] = oneThird * ltMinusLs * (ls * (2 * mt - 3 * ms) + lt * ms);
      klm[8] = oneThird * mtMinusMs * (ls * (mt - 3 * ms) + 2 * lt * ms);

      klm[9] = ltMinusLs * mtMinusMs;
      klm[10] = -(ltMinusLs ** 2) * mtMinusMs;
      klm[11] = -ltMinusLs * mtMinusMs ** 2;

      if (recursiveType === -1) {
        flip = (d1 > 0 && klm[0] < 0) || (d1 < 0 && klm[0] > 0);
      }

      break;
    }

    case CurveType.CUSP: {
      const ls = d3;
      const lt = 3 * d2;
      const lsMinusLt = ls - lt;

      klm[0] = ls;
      klm[1] = ls ** 3;
      klm[2] = 1.0;

      klm[3] = ls - oneThird * lt;
      klm[4] = ls ** 2 * lsMinusLt;
      klm[5] = 1.0;

      klm[6] = ls - twoThirds * lt;
      klm[7] = lsMinusLt ** 2 * ls;
      klm[8] = 1.0;

      klm[9] = lsMinusLt;
      klm[10] = lsMinusLt ** 3;
      klm[11] = 1.0;

      break;
    }

    case CurveType.QUADRATIC: {
      klm[0] = 0;
      klm[1] = 0;
      klm[2] = 0;

      klm[3] = oneThird;
      klm[4] = 0;
      klm[5] = oneThird;

      klm[6] = twoThirds;
      klm[7] = oneThird;
      klm[8] = twoThirds;

      klm[9] = 1;
      klm[10] = 1;
      klm[11] = 1;

      if (d3 < 0) flip = true;

      break;
    }

    case CurveType.LINE:
    case CurveType.POINT:
      break;
  }

  if (splitType !== -1 && recursiveType === -1) {
    const p01 = lerp2(p0, p1, splitTime);
    const p12 = lerp2(p1, p2, splitTime);
    const p23 = lerp2(p2, p3, splitTime);

    const p012 = lerp2(p01, p12, splitTime);
    const p123 = lerp2(p12, p23, splitTime);

    const p0123 = lerp2(p012, p123, splitTime);

    if (splitType === 0) {
      return [
        ...computeCubic(p0, p01, p012, p0123, 0),
        ...computeCubic(p0123, p123, p23, p3, 1),
      ];
    }
    if (splitType === 1) {
      return [
        ...computeCubic(p0, p01, p012, p0123, 1),
        ...computeCubic(p0123, p123, p23, p3, 0),
      ];
    }
  }

  if (recursiveType === 1) flip = !flip;

  if (flip) {
    klm[0] = -klm[0];
    klm[1] = -klm[1];
    klm[3] = -klm[3];
    klm[4] = -klm[4];
    klm[6] = -klm[6];
    klm[7] = -klm[7];
    klm[9] = -klm[9];
    klm[10] = -klm[10];
  }

  return [
    [p0, p1, p2, p3].map((p, i) => ({
      ...p,
      k: klm[0 + i * 3],
      l: klm[1 + i * 3],
      m: klm[2 + i * 3],
    })),
  ];
};
