import { mat4 } from "gl-matrix";
import { toNumber } from "lodash-es";
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

export default function LoopBlinnQuadTest() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = container.querySelector("canvas")!;
    const svg = container.querySelector("svg")!;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 not supported");

    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in float a_bary;
      in vec3 a_color;

      flat out float v_sign;

      out vec2 v_bary;
      out vec3 v_color;

      uniform mat4 u_mvp;

      void main() {
        gl_Position = u_mvp * vec4(a_position, 0.0, 1.0);
        v_color = a_color;

        uint bary;
        if (a_bary > 3.0) {
          v_sign = -1.0;
          bary = uint(a_bary - 4.0);
        } else {
          v_sign = 1.0;
          bary = uint(a_bary);
        }

        v_bary.x = float((bary >> 1) & 0x1u);
        v_bary.y = float((bary >> 0) & 0x1u);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision mediump float;

      in vec2 v_bary;
      in vec3 v_color;

      flat in float v_sign;

      layout(location = 0) out vec4 fragColor;

      void main() {
        vec2 uv = vec2(1.0, 1.0) * v_bary.x + vec2(0.5, 0.0) * v_bary.y;

        vec2 px = dFdx(uv);
        vec2 py = dFdy(uv);

        float f = uv.x * uv.x - uv.y;

        float fx = 2.0 * uv.x * px.x - px.y;
        float fy = 2.0 * uv.x * py.x - py.y;

        float sd = f / sqrt(fx * fx + fy * fy);

        float w = fwidth(sd);
        float a = smoothstep(-w, w, v_sign * sd);

        if (a < 0.001) {
          discard;
        } else {
          fragColor = vec4(v_color, a);
        }
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

    const vertexLength = 6;
    let positionsAndColors: number[] = [];

    const positionAndColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionAndColorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positionsAndColors),
      gl.STATIC_DRAW,
    );

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
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    const baryAttributeLocation = gl.getAttribLocation(program, "a_bary");
    gl.enableVertexAttribArray(baryAttributeLocation);
    gl.vertexAttribPointer(
      baryAttributeLocation,
      1,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    const colorAttributeLocation = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(colorAttributeLocation);
    gl.vertexAttribPointer(
      colorAttributeLocation,
      3,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );

    const mvpUniformLocation = gl.getUniformLocation(program, "u_mvp");

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
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

        svg.setAttribute("width", `${width}px`);
        svg.setAttribute("height", `${height}px`);

        gl.viewport(0, 0, canvas.width, canvas.height);
        mat4.ortho(projMatrix, 0, width, height, 0, -1, 1);
      }),
    );

    const circles = svg.querySelectorAll("circle");

    const getCircle = (mouseX: number, mouseY: number, tolerance = 3) => {
      for (const circle of circles) {
        const [cx, cy, r] = ["cx", "cy", "r"].map((attr) => {
          return toNumber(circle.getAttribute(attr) || "0");
        });
        if (
          Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2) <=
          r + tolerance
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
        circle.setAttribute("cx", `${mouseX}`);
        circle.setAttribute("cy", `${mouseY}`);
      }),
    );

    const packed = (baryX: number, baryY: number, offset = 0) =>
      ((baryX << 1) | baryY) + offset;

    const draw = () => {
      const [p1, p2, p3] = [...circles].map((circle) =>
        ["cx", "cy"].map((attr) => {
          return toNumber(circle.getAttribute(attr) || "0");
        }),
      );

      // prettier-ignore
      positionsAndColors = [
        p1[0], p1[1], packed(1, 0), 0.0, 0.0, 1.0,
        p2[0], p2[1], packed(0, 1), 0.0, 0.0, 1.0,
        p3[0], p3[1], packed(0, 0), 0.0, 0.0, 1.0,

        p1[0] + 300, p1[1], packed(1, 0), 0.0, 1.0, 0.0,
        p2[0] + 300, p2[1], packed(0, 1), 0.0, 1.0, 0.0,
        p3[0] + 300, p3[1], packed(1, 1), 0.0, 1.0, 0.0, // 第三个点重心坐标设置为 (1, 1)

        p1[0] + 600, p1[1], packed(1, 0, 4), 1.0, 0.0, 0.0,
        p2[0] + 600, p2[1], packed(0, 1, 4), 1.0, 0.0, 0.0,
        p3[0] + 600, p3[1], packed(0, 0, 4), 1.0, 0.0, 0.0,
      ];

      gl.bindBuffer(gl.ARRAY_BUFFER, positionAndColorBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positionsAndColors),
        gl.STATIC_DRAW,
      );

      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      gl.uniformMatrix4fv(mvpUniformLocation, false, mvpMatrix);

      gl.clearColor(0.9, 0.9, 0.9, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLES, 0, positionsAndColors.length / vertexLength);
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
      <svg className="absolute start-0 top-0">
        <circle cx="100" cy="100" r="3" fill="green" />
        <circle cx="200" cy="200" r="3" fill="orange" />
        <circle cx="300" cy="100" r="3" fill="green" />
      </svg>
    </div>
  );
}
