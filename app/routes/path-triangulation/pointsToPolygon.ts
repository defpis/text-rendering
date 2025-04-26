import earcut from "earcut";

import { inside } from "./utils";
import { polygonAreaSigned } from "./polygonArea";
import { vec2 } from "gl-matrix";

export interface Triangle {
  p1: vec2;
  p2: vec2;
  p3: vec2;
}

interface Group {
  points: Array<vec2>;
  area: number;
  children: Array<Group>;
}

export const pointsToPolygons = (
  points: Array<Array<vec2>>,
): Array<Array<Triangle>> => {
  const groups: Array<Group> = points.map((pointsArr) => ({
    points: pointsArr,
    area: polygonAreaSigned(pointsArr),
    children: [],
  }));

  groups.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

  const root = [];

  for (let i = 0; i < groups.length; ++i) {
    let parent;
    for (let j = i - 1; j >= 0; j--) {
      if (
        inside(groups[j].points, groups[i].points[0]) &&
        groups[i].area * groups[j].area < 0
      ) {
        parent = groups[j];
        break;
      }
    }
    if (parent) {
      parent.children.push(groups[i]);
    } else {
      root.push(groups[i]);
    }
  }

  const polygons: Array<Array<Triangle>> = [];
  let triangles: Array<Triangle> = [];

  const process = (group: Group) => {
    const coords: number[] = [];
    const holes: number[] = [];

    group.points.forEach((point) => {
      coords.push(...point);
    });

    group.children.forEach((child) => {
      child.children.forEach(process);
      holes.push(coords.length / 2);
      child.points.forEach((point) => {
        coords.push(...point);
      });
    });

    const indices = earcut(coords, holes);

    for (let i = 0; i < indices.length; i += 3) {
      const p1 = vec2.fromValues(
        coords[indices[i + 0] * 2],
        coords[indices[i + 0] * 2 + 1],
      );
      const p2 = vec2.fromValues(
        coords[indices[i + 1] * 2],
        coords[indices[i + 1] * 2 + 1],
      );
      const p3 = vec2.fromValues(
        coords[indices[i + 2] * 2],
        coords[indices[i + 2] * 2 + 1],
      );

      triangles.push({ p1, p2, p3 });
    }
  };

  root.forEach((group) => {
    process(group);
    polygons.push(triangles);
    triangles = [];
  });

  return polygons;
};
