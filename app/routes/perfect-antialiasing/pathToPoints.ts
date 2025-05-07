import { vec2 } from "gl-matrix";
import { toNumber } from "lodash-es";
import { quadBezierToPoints } from "./quadBezierToPoints";
import { cubicBezierToPoints } from "./cubicBezierToPoints";

const blockRegexp = /(?=[astvzqmhlc])/gi;
const valuesRegexp = /(-?[0-9]*\.?[0-9]+)(?:e[-+]?\d+)?/gi;

export const pathToPoints = (
  pathStr: string,
  splitBoundary: number,
): Array<Array<vec2>> => {
  const pathBlocks = pathStr.split(blockRegexp);

  const points: Array<Array<vec2>> = [];

  if (pathBlocks.length) {
    let currentPolygon: Array<vec2> = [];
    const currentPoint = vec2.create();

    while (pathBlocks.length) {
      const block = pathBlocks.shift();

      if (!block?.length) {
        continue;
      }

      const pathParts = block.substring(1).match(valuesRegexp) || [];

      const nextCommand = block[0];
      const normalizedCommand = nextCommand.toLowerCase();
      const isRelative = nextCommand === normalizedCommand;

      switch (normalizedCommand) {
        case "l":
        case "m":
          while (pathParts.length) {
            const nextPoint = vec2.fromValues(
              toNumber(pathParts.shift()!),
              toNumber(pathParts.shift()!),
            );

            if (isRelative) {
              vec2.add(nextPoint, nextPoint, currentPoint);
            }

            currentPolygon.push(nextPoint);
            vec2.copy(currentPoint, nextPoint);
          }
          break;
        case "h":
          while (pathParts.length) {
            let nextX = toNumber(pathParts.shift()!);

            if (isRelative) {
              nextX += currentPoint[0];
            }

            currentPolygon.push(vec2.fromValues(nextX, currentPoint[1]));
            currentPoint[0] = nextX;
          }
          break;
        case "v":
          while (pathParts.length) {
            let nextY = toNumber(pathParts.shift()!);

            if (isRelative) {
              nextY += currentPoint[1];
            }

            currentPolygon.push(vec2.fromValues(currentPoint[0], nextY));
            currentPoint[1] = nextY;
          }
          break;
        case "z": {
          const firstPoint = currentPolygon[0];
          currentPolygon.push(vec2.clone(firstPoint));
          points.push(currentPolygon);
          currentPolygon = [];
          vec2.zero(currentPoint);

          break;
        }
        case "c":
          while (pathParts.length) {
            const secondPoint = vec2.fromValues(
              toNumber(pathParts.shift()!),
              toNumber(pathParts.shift()!),
            );
            const thirdPoint = vec2.fromValues(
              toNumber(pathParts.shift()!),
              toNumber(pathParts.shift()!),
            );
            const fourthPoint = vec2.fromValues(
              toNumber(pathParts.shift()!),
              toNumber(pathParts.shift()!),
            );

            if (isRelative) {
              vec2.add(secondPoint, secondPoint, currentPoint);
              vec2.add(thirdPoint, thirdPoint, currentPoint);
              vec2.add(fourthPoint, fourthPoint, currentPoint);
            }

            currentPolygon.push(
              ...cubicBezierToPoints(
                {
                  p1: currentPoint,
                  p2: secondPoint,
                  p3: thirdPoint,
                  p4: fourthPoint,
                },
                splitBoundary,
              ),
            );

            vec2.copy(currentPoint, fourthPoint);
          }
          break;
        case "q":
          while (pathParts.length) {
            const secondPoint = vec2.fromValues(
              toNumber(pathParts.shift()!),
              toNumber(pathParts.shift()!),
            );
            const thirdPoint = vec2.fromValues(
              toNumber(pathParts.shift()!),
              toNumber(pathParts.shift()!),
            );

            if (isRelative) {
              vec2.add(secondPoint, secondPoint, currentPoint);
              vec2.add(thirdPoint, thirdPoint, currentPoint);
            }

            currentPolygon.push(
              ...quadBezierToPoints(
                {
                  p1: currentPoint,
                  p2: secondPoint,
                  p3: thirdPoint,
                },
                splitBoundary,
              ),
            );

            vec2.copy(currentPoint, thirdPoint);
          }
          break;
        case "s":
        case "t":
        case "a":
          console.log(`${normalizedCommand} is not implemented!`);
          break;
      }
    }

    if (currentPolygon.length) {
      points.push(currentPolygon);
    }
  }

  return points;
};
