import { mat4, vec3 } from "gl-matrix";
import { useEffect, useRef } from "react";
import {
  fromEvent,
  map,
  Observable,
  Subscription,
  switchMap,
  takeUntil,
  merge,
  EMPTY,
} from "rxjs";
import {
  type Point,
  CurveType,
  equals,
  inside,
  linesIntersect,
  sub,
  len,
  lerp2,
} from "./utils";
import { round } from "lodash-es";

export interface CubicBezierResult {
  klm: number[];
  points: Point[];
}

export const computeCubic = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  recursiveType = -1,
): Array<CubicBezierResult> => {
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
    {
      klm,
      points: [p0, p1, p2, p3],
    },
  ];
};

export const determineType = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): [number, number, number, CurveType] => {
  if (equals(p0, p1) && equals(p1, p2) && equals(p2, p3)) {
    return [0, 0, 0, CurveType.POINT];
  }

  const b0 = vec3.fromValues(p0.x, p0.y, 1.0);
  const b1 = vec3.fromValues(p1.x, p1.y, 1.0);
  const b2 = vec3.fromValues(p2.x, p2.y, 1.0);
  const b3 = vec3.fromValues(p3.x, p3.y, 1.0);

  const a1 = vec3.dot(b0, vec3.cross(vec3.create(), b3, b2));
  const a2 = vec3.dot(b1, vec3.cross(vec3.create(), b0, b3));
  const a3 = vec3.dot(b2, vec3.cross(vec3.create(), b1, b0));

  let d3 = 3 * a3;
  let d2 = d3 - a2;
  let d1 = d2 - a2 + a1;

  const max = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3);

  d1 /= max;
  d2 /= max;
  d3 /= max;

  const d: [number, number, number] = [d1, d2, d3];

  const D = 3 * d2 * d2 - 4 * d1 * d3;
  const disc = d1 * d1 * D;

  if (!disc) {
    if (!d1 && !d2) {
      if (!d3) {
        return [...d, CurveType.LINE];
      }
      return [...d, CurveType.QUADRATIC];
    }

    if (!d1) {
      return [...d, CurveType.CUSP];
    }

    return D < 0 ? [...d, CurveType.LOOP] : [...d, CurveType.SERPENTINE];
  }

  return disc > 0 ? [...d, CurveType.SERPENTINE] : [...d, CurveType.LOOP];
};

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const [canvas, helper] = container.querySelectorAll("canvas");

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 not supported");

    const ctx = helper.getContext("2d");
    if (!ctx) throw new Error("Canvas2d not supported");

    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec3 a_klm;
      out vec3 v_klm;

      uniform mat4 u_mvp;

      void main() {
        gl_Position = u_mvp * vec4(a_position, 0.0, 1.0);
        v_klm = a_klm;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision mediump float;
      in vec3 v_klm;
      layout(location = 0) out vec4 fragColor;

      void main() {
        float k = v_klm.x;
        float l = v_klm.y;
        float m = v_klm.z;

        vec2 dk = vec2(dFdx(k), dFdy(k));
        vec2 dl = vec2(dFdx(l), dFdy(l));
        vec2 dm = vec2(dFdx(m), dFdy(m));

        float dfx = 3.0 * k * k * dk.x - (l * dm.x + m * dl.x);
        float dfy = 3.0 * k * k * dk.y - (l * dm.y + m * dl.y);

        float f = k * k * k - l * m;
        float sd = f / length(vec2(dfx, dfy));

        float w = fwidth(sd);
        float alpha = smoothstep(-w, w, -sd);

        if(alpha < 0.01) discard;
        fragColor = vec4(0.0, 0.0, 0.0, 0.2 * alpha);
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Failed to create vertex shader");
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    // 在顶点着色器编译后添加
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("顶点着色器编译错误:", gl.getShaderInfoLog(vertexShader));
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Failed to create fragment shader");
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    // 在片段着色器编译后添加
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("片段着色器编译错误:", gl.getShaderInfoLog(fragmentShader));
    }

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    // 在程序链接后添加
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("程序链接错误:", gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    const VERTEX_SIZE = 5;
    let positions: number[] = [];

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(
      program,
      "a_position",
    );
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
      positionAttributeLocation,
      2,
      gl.FLOAT,
      false,
      VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    const kmlAttributeLocation = gl.getAttribLocation(program, "a_klm");
    gl.enableVertexAttribArray(kmlAttributeLocation);
    gl.vertexAttribPointer(
      kmlAttributeLocation,
      3,
      gl.FLOAT,
      false,
      VERTEX_SIZE * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    const mvpUniformLocation = gl.getUniformLocation(program, "u_mvp");

    const projMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    const subscription = new Subscription();

    const resize$ = new Observable<{ width: number; height: number }>(
      (subscriber) => {
        // 处理窗口大小变化，比如拉伸窗口
        const resizeObserver = new ResizeObserver((entries) => {
          requestAnimationFrame(() => {
            const { width, height } = entries[0].contentRect;
            subscriber.next({ width, height });
          });
        });
        resizeObserver.observe(container);

        // 处理设备像素比变化，比如从一个高分辨率屏幕切换到一个低分辨率屏幕
        let remove: Function | null = null;
        const onPixelRatioChange = () => {
          remove?.();

          const query = `(resolution: ${devicePixelRatio}dppx)`;
          const media = matchMedia(query);

          media.addEventListener("change", onPixelRatioChange);
          remove = () => {
            media.removeEventListener("change", onPixelRatioChange);
            remove = null;
          };

          const { width, height } = container.getBoundingClientRect();
          subscriber.next({ width, height });
        };
        onPixelRatioChange();

        return () => {
          resizeObserver.disconnect();
          remove?.();
        };
      },
    );

    subscription.add(
      resize$.subscribe(({ width, height }) => {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mat4.ortho(projMatrix, 0, width, height, 0, -1, 1);

        helper.style.width = `${width}px`;
        helper.style.height = `${height}px`;
        helper.width = width * devicePixelRatio;
        helper.height = height * devicePixelRatio;

        ctx.scale(devicePixelRatio, devicePixelRatio);
      }),
    );

    const circleSize = 3;
    const circles = [
      { x: 120, y: 120 },
      { x: 200, y: 160 },
      { x: 280, y: 160 },
      { x: 360, y: 120 },
    ];

    const getCircle = (mouseX: number, mouseY: number, tolerance = 3) => {
      for (const circle of circles) {
        if (
          Math.sqrt((mouseX - circle.x) ** 2 + (mouseY - circle.y) ** 2) <=
          circleSize + tolerance
        ) {
          return circle;
        }
      }
      return null;
    };

    const mouseDown$ = fromEvent<MouseEvent>(container, "mousedown");
    const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove");
    const mouseUp$ = fromEvent<MouseEvent>(document, "mouseup");

    const drag$ = mouseDown$.pipe(
      switchMap((startEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = startEvent.clientX - rect.left;
        const mouseY = startEvent.clientY - rect.top;

        const circle = getCircle(mouseX, mouseY);
        if (!circle) {
          return EMPTY;
        }

        return mouseMove$.pipe(
          map((moveEvent) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = moveEvent.clientX - rect.left;
            const mouseY = moveEvent.clientY - rect.top;

            return { circle, mouseX, mouseY };
          }),
          takeUntil(mouseUp$),
        );
      }),
    );

    subscription.add(
      drag$.subscribe(({ circle, mouseX, mouseY }) => {
        circle.x = mouseX;
        circle.y = mouseY;
      }),
    );

    let triangles: Point[][] = [];
    let debug = true;

    const getColor = () =>
      Array.from({ length: 3 }, () => Math.random() * 255).join(",");

    let colorIdx = 0;
    let colorLen = 10;

    const colors = Array.from({ length: colorLen }, () => getColor());

    let offsetX = 0;
    let offsetY = 0;

    const draw = () => {
      const [p0, p1, p2, p3] = circles;

      positions = [];
      triangles = [];

      const quads = computeCubic(p0, p1, p2, p3); // 四边形列表

      const triangulation = (quad: CubicBezierResult) => {
        const { klm, points } = quad;

        const addTriangle = (...indices: number[]) => {
          triangles.push(indices.map((idx) => points[idx]));
          indices.forEach((idx) => {
            positions.push(
              points[idx].x,
              points[idx].y,
              klm[0 + idx * 3],
              klm[1 + idx * 3],
              klm[2 + idx * 3],
            );
          });
        };

        for (let i = 0; i < 4; ++i) {
          for (let j = i + 1; j < 4; ++j) {
            if (equals(points[i], points[j])) {
              const indices = [0, 0, 0];
              let index = 0;
              for (let k = 0; k < 4; ++k) {
                if (k !== j) indices[index++] = k;
              }

              // 单个三角形
              addTriangle(...indices);

              return;
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
              indices.map((idx) => points[idx]),
              points[i],
            )
          ) {
            // 三个三角形
            for (let j = 0; j < 3; ++j) {
              addTriangle(indices[(j + 0) % 3], indices[(j + 1) % 3], i);
            }

            return;
          }
        }

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
      };

      quads.forEach((quad) => triangulation(quad));

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW,
      );

      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);

      gl.uniformMatrix4fv(mvpUniformLocation, false, mvpMatrix);

      gl.clearColor(0.9, 0.9, 0.9, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLES, 0, positions.length / VERTEX_SIZE);

      // ------------------------

      ctx.clearRect(0, 0, helper.width, helper.height);

      if (debug) {
        colorIdx = 0;

        offsetX = 0;
        offsetY = 400;

        quads.forEach((quad) => {
          const color = colors[colorIdx++ % colorLen];

          ctx.beginPath();
          ctx.moveTo(quad.points[3].x, quad.points[3].y + offsetY);
          quad.points.forEach((point) => {
            ctx.lineTo(point.x, point.y + offsetY);
          });
          ctx.closePath();
          ctx.strokeStyle = `rgba(${color}, 1.0)`;
          ctx.stroke();
          ctx.fillStyle = `rgba(${color}, 0.2)`;
          ctx.fill();

          ctx.fillStyle = `rgba(0, 0, 0, 1.0)`;
          quad.points.forEach((point, idx) => {
            ctx.fillText(
              [
                quad.klm[0 + idx * 3],
                quad.klm[1 + idx * 3],
                quad.klm[2 + idx * 3],
              ]
                .map((n) => round(n, 2))
                .join(", "),
              point.x,
              point.y + offsetY,
            );
          });

          offsetY += 100;
        });

        offsetX = 600;
        offsetY = 0;

        triangles.forEach((triangle) => {
          const color = colors[colorIdx++ % colorLen];

          ctx.beginPath();
          ctx.moveTo(triangle[2].x, triangle[2].y);
          triangle.forEach((point) => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
          ctx.strokeStyle = `rgba(${color}, 1.0)`;
          ctx.stroke();
          ctx.fillStyle = `rgba(${color}, 0.2)`;
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(triangle[2].x + offsetX, triangle[2].y + offsetY);
          triangle.forEach((point) => {
            ctx.lineTo(point.x + offsetX, point.y + offsetY);
          });
          ctx.closePath();
          ctx.strokeStyle = `rgba(${color}, 1.0)`;
          ctx.stroke();
          ctx.fillStyle = `rgba(${color}, 0.2)`;
          ctx.fill();

          offsetY += 100;
        });
      }

      circles.forEach((circle, index) => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circleSize, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle =
          index === 0 || index === 3
            ? "rgba(0, 255, 0, 1)"
            : "rgba(255, 0, 0, 1)";
        ctx.fill();
      });
    };

    const draw$ = merge(resize$, drag$);
    subscription.add(draw$.subscribe(() => draw()));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen relative">
      <canvas></canvas>
      <canvas className="absolute start-0 top-0"></canvas>
    </div>
  );
}
