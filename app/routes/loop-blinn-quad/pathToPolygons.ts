import { determinant2, equals, sub, type Point } from "./utils";
import {
  insideQuad,
  splitQuad,
  type NestPoints,
  type QuadBezier,
  type QuadBezierResult,
} from "./quadBezier";
import { isArray } from "lodash-es";

const flattenPolygon = (polygon: NestPoints): Point[] => {
  const result: Point[] = [];
  polygon.forEach((points) =>
    isArray(points)
      ? result.push(...flattenPolygon(points))
      : result.push(points),
  );
  return result;
};

const flattenQuad = (quads: QuadBezierResult[]): QuadBezier[] => {
  const result: QuadBezier[] = [];
  quads.forEach((quad) =>
    isArray(quad.quads)
      ? result.push(...flattenQuad(quad.quads))
      : result.push(quad),
  );
  return result;
};

export const pathToPolygons = (path: opentype.Path) => {
  const _polygons: NestPoints[] = [];

  const _innerQuads: QuadBezierResult[] = [];
  const _outerQuads: QuadBezierResult[] = [];

  let currentPolygon: NestPoints = [];
  let currentPoint = { x: 0, y: 0 };

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
        const ctrlPoint = { x: cmd.x1, y: cmd.y1 };
        const nextPoint = { x: cmd.x, y: cmd.y };

        const v1 = sub(ctrlPoint, currentPoint);
        const v2 = sub(nextPoint, ctrlPoint);
        const areaSigned = determinant2(v1, v2);

        const quad: QuadBezierResult = {
          points: [],
          p1: currentPoint,
          p2: ctrlPoint,
          p3: nextPoint,
        };

        if (areaSigned < 0) {
          quad.points.push(ctrlPoint);
          _innerQuads.push(quad);
        } else {
          _outerQuads.push(quad);
        }

        currentPolygon.push(quad.points);
        currentPolygon.push(nextPoint);
        currentPoint = nextPoint;
        break;
      }
      case "C": {
        break;
      }
    }
  }

  if (currentPolygon.length) {
    _polygons.push(currentPolygon);
  }

  let outers = _outerQuads;
  let inners = _innerQuads;

  let loop = 0; // 处理三次覆盖 99.99% 的字符
  while (loop < 3) {
    loop++;

    const _outers = [];
    const _inners = [];

    for (const outer of outers) {
      for (const inner of inners) {
        if (insideQuad(outer, inner.p2)) {
          const [q1, q2] = splitQuad(outer, 0.5);

          // 修改引用并预留空数组以便下一层修改引用
          outer.points.push(q1.points, q1.p3, q2.points);
          outer.quads = [q1, q2];

          const [q3, q4] = splitQuad(inner, 0.5);

          // 推入控制点
          q3.points.push(q3.p2);
          q4.points.push(q4.p2);

          // 删除之前插入的控制点，插入新的轮廓点
          inner.points.splice(0, 1, q3.points, q3.p3, q4.points);
          inner.quads = [q3, q4];

          _outers.push(q1, q2);
          _inners.push(q3, q4);
        }
      }
    }

    if (!_outers.length || !_inners.length) break;

    outers = _outers;
    inners = _inners;
  }

  const polygons = _polygons.map((polygon) => flattenPolygon(polygon));

  const outerQuads = flattenQuad(_outerQuads);
  const innerQuads = flattenQuad(_innerQuads);

  return { polygons, outerQuads, innerQuads };
};
