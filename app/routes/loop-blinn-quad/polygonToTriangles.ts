import earcut from "earcut";
import { inside, type Point } from "./utils";
import { polygonAreaSigned } from "./polygonArea";

export interface Triangle {
  p1: Point;
  p2: Point;
  p3: Point;
}

interface Group {
  points: Array<Point>;
  area: number;
  children: Array<Group>;
}

export const polygonToTriangles = (
  polygons: Array<Array<Point>>,
): Array<Triangle> => {
  const groups: Array<Group> = polygons.map((pointsArr) => ({
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

  let triangles: Array<Triangle> = [];

  const process = (group: Group) => {
    const coords: number[] = [];
    const holes: number[] = [];

    group.points.forEach((point) => {
      coords.push(point.x, point.y);
    });

    group.children.forEach((child) => {
      child.children.forEach(process);
      holes.push(coords.length / 2);
      child.points.forEach((point) => {
        coords.push(point.x, point.y);
      });
    });

    const indices = earcut(coords, holes);

    for (let i = 0; i < indices.length; i += 3) {
      const p1 = {
        x: coords[indices[i + 0] * 2],
        y: coords[indices[i + 0] * 2 + 1],
      };
      const p2 = {
        x: coords[indices[i + 1] * 2],
        y: coords[indices[i + 1] * 2 + 1],
      };
      const p3 = {
        x: coords[indices[i + 2] * 2],
        y: coords[indices[i + 2] * 2 + 1],
      };

      triangles.push({ p1, p2, p3 });
    }
  };

  root.forEach(process);

  return triangles;
};
