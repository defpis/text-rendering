import { clone, determinant2, equals, sub, type Point } from "./utils";
import { insideQuad, splitQuad } from "./quadBezier";
import { flatten, isArray } from "lodash-es";

export interface QuadBezier {
  p1: Point;
  p2: Point;
  p3: Point;
}

export interface QuadBezierResult extends QuadBezier {
  points: Point[];
  quads?: QuadBezier[];
}

export const pathToPolygons = (path: opentype.Path) => {
  let _polygons: Array<Array<Point | Point[]>> = [];
  let _innerQuads: QuadBezierResult[] = [];
  let _outterQuads: QuadBezierResult[] = [];

  let currentPolygon: Array<Point | Point[]> = [];
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
        currentPoint = clone(nextPoint);
        break;
      }
      case "Z":
        const firstPoint = currentPolygon[0];
        if (isArray(firstPoint)) continue;
        currentPolygon.push(clone(firstPoint));
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
          points: [], // 占位后续修改
          p1: currentPoint,
          p2: ctrlPoint,
          p3: nextPoint,
        };

        if (areaSigned < 0) {
          quad.points.push(ctrlPoint);
          _innerQuads.push(quad);
        } else {
          _outterQuads.push(quad);
        }

        currentPolygon.push(quad.points);
        currentPolygon.push(nextPoint);
        currentPoint = clone(nextPoint);
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

  const overlaps = [];
  for (const outterQuad of _outterQuads) {
    for (const innerQuad of _innerQuads) {
      if (insideQuad(outterQuad, innerQuad.p2)) {
        overlaps.push({ innerQuad, outterQuad });

        const [q1, q2] = splitQuad(outterQuad, 0.5);
        outterQuad.points.push(q1.p3);
        outterQuad.quads = [q1, q2];

        const [q3, q4] = splitQuad(innerQuad, 0.5);
        innerQuad.points.splice(0, 1, q3.p2, q3.p3, q4.p2);
        innerQuad.quads = [q3, q4];
      }
    }
  }

  const polygons = _polygons.map((polygon) =>
    flatten(polygon.map((point) => (isArray(point) ? point : [point]))),
  );
  const outterQuads = flatten(
    _outterQuads.map((quad) => (quad.quads ? quad.quads : [quad])),
  );
  const innerQuads = flatten(
    _innerQuads.map((quad) => (quad.quads ? quad.quads : [quad])),
  );

  return { polygons, outterQuads, innerQuads };
};
