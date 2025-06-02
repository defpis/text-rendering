import { ceil, clamp } from "lodash-es";
import { useEffect, useRef, useState } from "react";
import {
  EMPTY,
  fromEvent,
  map,
  merge,
  Observable,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs";
import * as twgl from "twgl.js";
import { bbox, type Point } from "./utils";
import { nearestOnParabola, qBezierToParabola, convertSpace } from "./nearest";
import { sdfShader } from "./shaders";
import { mat3, mat4 } from "gl-matrix";

const circles = [
  { x: 100, y: 100 },
  { x: 200, y: 200 },
  { x: 300, y: 100 },
];

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderType, setRenderType] = useState("GPU");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const [canvas1, canvas2] = container.querySelectorAll("canvas");

    const gl = canvas1.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false, // 会导致 webgl 和 canvas 的渐变距离不同
    });
    if (!gl) throw new Error("WebGL 2.0 not supported");

    const program = twgl.createProgram(gl, [sdfShader.vs, sdfShader.fs]);

    const uniformSetters = twgl.createUniformSetters(gl, program);
    const attributeSetters = twgl.createAttributeSetters(gl, program);

    let vertices: number[] = [];
    const vertexBuffer = twgl.createBufferFromTypedArray(
      gl,
      new Float32Array(vertices),
    );
    const size = 3;
    const vao = twgl.createVAOAndSetAttributes(gl, attributeSetters, {
      a_pos: {
        buffer: vertexBuffer,
        numComponents: 2,
        offset: 0 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
      a_idx: {
        buffer: vertexBuffer,
        numComponents: 1,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
    });

    let curvePos: number[] = [];
    const curvePosTexture = twgl.createTexture(gl, {
      src: new Float32Array(curvePos),
      width: 0,
      height: 0,
      internalFormat: gl.RG32F,
      min: gl.NEAREST,
      mag: gl.NEAREST,
    });

    const ctx = canvas2.getContext("2d");
    if (!ctx) throw new Error("Canvas2d not supported");

    const boxSize = 10; // 网格宽高
    const lineWidth = 1; // 网格线宽度
    const circleSize = 3; // 控制点半径
    const padding = 100; // 渐变距离

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

    const drawCell = (x: number, y: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(
        x + lineWidth / 2,
        y + lineWidth / 2,
        boxSize - lineWidth,
        boxSize - lineWidth,
      );
    };

    const drawLine = (src: Point, dst: Point) => {
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(dst.x, dst.y);
      ctx.strokeStyle = "rgba(0, 0, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const projMatrix = mat4.create();
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const draw = () => {
      ctx.clearRect(0, 0, canvas2.width, canvas2.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const box = bbox(circles, padding);

      if (renderType === "GPU") {
        // prettier-ignore
        vertices = [
          // 1
          box.min.x, box.min.y, 0,
          box.max.x, box.min.y, 0,
          box.min.x, box.max.y, 0,
          // 2
          box.max.x, box.min.y, 0,
          box.min.x, box.max.y, 0,
          box.max.x, box.max.y, 0,
        ];

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array(vertices),
          gl.STATIC_DRAW,
        );

        // prettier-ignore
        curvePos = [
          circles[0].x, circles[0].y,
          circles[1].x, circles[1].y,
          circles[2].x, circles[2].y,
        ];
        twgl.setTextureFromArray(
          gl,
          curvePosTexture,
          new Float32Array(curvePos),
          {
            width: curvePos.length / 2,
            height: 1,
            internalFormat: gl.RG32F,
            min: gl.NEAREST,
            mag: gl.NEAREST,
          },
        );

        gl.useProgram(program);

        const uniforms = {
          u_max: padding * devicePixelRatio, // 渐变的最大距离，屏幕空间需要乘以 dpr
          u_size: [canvas1.width, canvas1.height],
          u_mvp: projMatrix,
          u_curves: curvePosTexture,
        };
        twgl.setUniforms(uniformSetters, uniforms);

        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, vertices.length / size);
        gl.bindVertexArray(null);
      }

      if (renderType === "CPU") {
        // 绘制网格
        const row = ceil(canvas2.height / boxSize);
        const col = ceil(canvas2.width / boxSize);

        const curve = { p0: circles[0], p1: circles[1], p2: circles[2] };
        const { matrix, scale, xLimits } = qBezierToParabola(curve);

        const inverseMatrix = mat3.create();
        mat3.invert(inverseMatrix, matrix);

        for (let i = 0; i < row; i++) {
          for (let j = 0; j < col; j++) {
            const x = j * boxSize;
            const y = i * boxSize;

            ctx.strokeStyle = `rgb(175, 175, 175)`;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x, y, boxSize, boxSize);

            const p = { x: x + boxSize / 2, y: y + boxSize / 2 };

            if (
              p.x < box.min.x ||
              p.y < box.min.y ||
              p.x > box.max.x ||
              p.y > box.max.y // 优化
            ) {
              drawCell(x, y, `rgb(255, 255, 255)`);
            } else {
              const point = convertSpace(p, inverseMatrix);

              const { distance, nearest } = nearestOnParabola(point, xLimits);

              const length = scale * distance;
              const alpha = 1 - clamp(length / padding, 0, 1);
              drawCell(x, y, `rgba(255, 255, 0, ${alpha})`);

              if (alpha > 0) {
                const n = convertSpace(nearest, matrix);
                drawLine(n, p);
              }
            }
          }
        }
      }

      // 绘制曲线
      ctx.beginPath();
      ctx.moveTo(circles[0].x, circles[0].y);
      ctx.quadraticCurveTo(
        circles[1].x,
        circles[1].y,
        circles[2].x,
        circles[2].y,
      );
      ctx.strokeStyle = `rgb(0, 0, 0)`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // 绘制控制点
      circles.forEach((circle, index) => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circleSize, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fillStyle =
          index !== 1 ? "rgba(0, 255, 0, 1)" : "rgba(255, 0, 0, 1)";
        ctx.fill();
      });
    };

    const mouseDown$ = fromEvent<MouseEvent>(container, "mousedown");
    const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove");
    const mouseUp$ = fromEvent<MouseEvent>(document, "mouseup");

    const drag$ = mouseDown$.pipe(
      switchMap((startEvent) => {
        const rect = canvas2.getBoundingClientRect();
        const mouseX = startEvent.clientX - rect.left;
        const mouseY = startEvent.clientY - rect.top;

        const circle = getCircle(mouseX, mouseY);
        if (!circle) {
          return EMPTY;
        }

        return mouseMove$.pipe(
          map((moveEvent) => {
            const rect = canvas2.getBoundingClientRect();
            const mouseX = moveEvent.clientX - rect.left;
            const mouseY = moveEvent.clientY - rect.top;

            return { circle, mouseX, mouseY };
          }),
          takeUntil(mouseUp$),
        );
      }),
    );

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

    const subscription = new Subscription();

    subscription.add(
      drag$.subscribe(({ circle, mouseX, mouseY }) => {
        circle.x = mouseX;
        circle.y = mouseY;
      }),
    );

    subscription.add(
      resize$.subscribe(({ width, height }) => {
        canvas1.style.width = `${width}px`;
        canvas1.style.height = `${height}px`;
        canvas1.width = width * devicePixelRatio;
        canvas1.height = height * devicePixelRatio;

        // 设置视口和投影矩阵
        gl.viewport(0, 0, canvas1.width, canvas1.height);
        mat4.ortho(projMatrix, 0, width, height, 0, -1, 1);

        canvas2.style.width = `${width}px`;
        canvas2.style.height = `${height}px`;
        canvas2.width = width * devicePixelRatio;
        canvas2.height = height * devicePixelRatio;

        ctx.scale(devicePixelRatio, devicePixelRatio);
      }),
    );

    const draw$ = merge(resize$, drag$);
    subscription.add(draw$.subscribe(() => draw()));

    return () => {
      subscription.unsubscribe();
    };
  }, [renderType]);

  return (
    <div ref={containerRef} className="min-h-screen relative">
      <canvas></canvas>
      <canvas className="absolute start-0 top-0"></canvas>
      <div className="absolute end-0 top-0">
        <label>渲染方式：</label>
        <select
          value={renderType}
          onChange={(ev) => {
            setRenderType(ev.target.value);
          }}
        >
          <option value="CPU">CPU</option>
          <option value="GPU">GPU</option>
        </select>
      </div>
    </div>
  );
}
