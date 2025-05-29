import { equals, inside, len, linesIntersect, sub, type Point } from "./utils";
import { type NestPoints, type CubicBezierSplitResult } from "./cubicBezier";
import { isArray } from "lodash-es";
import { polygonAreaSigned } from "./polygonArea";
import { computeCubic, type KlmResult } from "./computeCubic";

const flattenPolygon = (polygon: NestPoints): Point[] => {
  const result: Point[] = [];
  polygon.forEach((points) =>
    isArray(points)
      ? result.push(...flattenPolygon(points))
      : result.push(points),
  );
  return result;
};

const triangulation = (cubic: KlmResult[]) => {
  const triangles: KlmResult[][] = [];

  const addTriangle = (...indices: number[]) => {
    triangles.push(indices.map((idx) => cubic[idx]));
  };

  for (let i = 0; i < 4; ++i) {
    for (let j = i + 1; j < 4; ++j) {
      if (equals(cubic[i], cubic[j])) {
        const indices = [0, 0, 0];
        let index = 0;
        for (let k = 0; k < 4; ++k) {
          if (k !== j) indices[index++] = k;
        }

        // 单个三角形
        addTriangle(...indices);

        return triangles;
      }
    }
  }

  for (let i = 0; i < 4; ++i) {
    const indices = [0, 0, 0];
    let index = 0;
    for (let j = 0; j < 4; ++j) {
      if (j !== i) indices[index++] = j;
    }

    if (
      inside(
        indices.map((idx) => cubic[idx]),
        cubic[i],
      )
    ) {
      // 三个三角形
      for (let j = 0; j < 3; ++j) {
        addTriangle(indices[(j + 0) % 3], indices[(j + 1) % 3], i);
      }

      return triangles;
    }
  }

  const [p0, p1, p2, p3] = cubic;

  if (linesIntersect(p0, p2, p1, p3)) {
    if (len(sub(p2, p0)) < len(sub(p3, p1))) {
      addTriangle(0, 1, 2);
      addTriangle(0, 2, 3);
    } else {
      addTriangle(0, 1, 3);
      addTriangle(1, 2, 3);
    }
  } else if (linesIntersect(p0, p3, p1, p2)) {
    if (len(sub(p3, p0)) < len(sub(p2, p1))) {
      addTriangle(0, 1, 3);
      addTriangle(0, 3, 2);
    } else {
      addTriangle(0, 1, 2);
      addTriangle(2, 1, 3);
    }
  } else {
    if (len(sub(p1, p0)) < len(sub(p3, p2))) {
      addTriangle(0, 2, 1);
      addTriangle(0, 1, 3);
    } else {
      addTriangle(0, 2, 3);
      addTriangle(3, 2, 1);
    }
  }

  return triangles;
};

export const pathToPolygons = (path: opentype.Path, sign: -1 | 1) => {
  const _polygons: NestPoints[] = [];

  const innerCubics: CubicBezierSplitResult[] = [];
  const outerCubics: CubicBezierSplitResult[] = [];

  let currentPolygon: NestPoints = [];
  let currentPoint = { x: 0, y: 0 };

  const processCubic = (cubic: CubicBezierSplitResult) => {
    const areaSigned = polygonAreaSigned([
      cubic.p0,
      cubic.p1,
      cubic.p2,
      cubic.p3,
    ]);

    if (areaSigned * sign < 0) {
      innerCubics.push(cubic);
    } else {
      outerCubics.push(cubic);
    }

    currentPolygon.push(cubic.points);
    currentPolygon.push(cubic.p3);
    currentPoint = cubic.p3;
  };

  while (path.commands.length) {
    const cmd = path.commands.shift()!;

    switch (cmd.type) {
      case "M":
      case "L": {
        const nextPoint = { x: cmd.x, y: cmd.y };

        if (equals(currentPoint, nextPoint)) {
          continue;
        }

        currentPolygon.push(nextPoint);
        currentPoint = nextPoint;
        break;
      }
      case "Z":
        const firstPoint = currentPolygon[0];
        currentPolygon.push(firstPoint);
        _polygons.push(currentPolygon);
        currentPolygon = [];
        currentPoint = { x: 0, y: 0 };
        break;
      case "Q": {
        const controlPoint = { x: cmd.x1, y: cmd.y1 };
        const nextPoint = { x: cmd.x, y: cmd.y };

        const firstCtrl = {
          x: currentPoint.x + (2 / 3) * (controlPoint.x - currentPoint.x),
          y: currentPoint.y + (2 / 3) * (controlPoint.y - currentPoint.y),
        };
        const secondCtrl = {
          x: controlPoint.x + (1 / 3) * (nextPoint.x - controlPoint.x),
          y: controlPoint.y + (1 / 3) * (nextPoint.y - controlPoint.y),
        };

        const cubic: CubicBezierSplitResult = {
          points: [],
          p0: currentPoint,
          p1: firstCtrl,
          p2: secondCtrl,
          p3: nextPoint,
        };

        processCubic(cubic);

        break;
      }
      case "C": {
        const firstCtrl = { x: cmd.x1, y: cmd.y1 };
        const secondCtrl = { x: cmd.x2, y: cmd.y2 };
        const nextPoint = { x: cmd.x, y: cmd.y };

        const cubic: CubicBezierSplitResult = {
          points: [],
          p0: currentPoint,
          p1: firstCtrl,
          p2: secondCtrl,
          p3: nextPoint,
        };

        processCubic(cubic);

        break;
      }
    }
  }

  if (currentPolygon.length) {
    _polygons.push(currentPolygon);
  }

  const outerTriangles: KlmResult[][] = [];
  const innerTriangles: KlmResult[][] = [];

  outerCubics.forEach((cubic) => {
    const cubics = computeCubic(cubic.p0, cubic.p1, cubic.p2, cubic.p3);

    if (cubics.length > 1) {
      cubic.points.push(cubics[0][3]);
    }

    cubics.forEach((cubic) => {
      const triangles = triangulation(cubic);
      outerTriangles.push(...triangles);
    });
  });

  innerCubics.forEach((cubic) => {
    const cubics = computeCubic(cubic.p0, cubic.p1, cubic.p2, cubic.p3);

    if (cubics.length > 1) {
      cubic.points.push(cubics[0][3]);
    }

    cubics.forEach((cubic) => {
      const triangles = triangulation(cubic);
      innerTriangles.push(...triangles);
    });
  });

  const polygons = _polygons.map((polygon) => flattenPolygon(polygon));

  return { polygons, innerTriangles, outerTriangles };
};
