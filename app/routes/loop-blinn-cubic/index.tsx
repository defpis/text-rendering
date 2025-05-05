import { mat4, vec3 } from "gl-matrix";
import { clamp } from "lodash-es";
import opentype from "opentype.js";
import { useEffect, useRef } from "react";
import {
  fromEvent,
  map,
  merge,
  Observable,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs";
// import fontURL from "~/assets/fonts/LXGWWenKaiMono-Regular.ttf";
import fontURL from "~/assets/fonts/ComicCode.otf";
import { pathToPolygons } from "./pathToPolygons";
import { polygonToTriangles } from "./polygonToTriangles";

export default function LoopBlinnCubic() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 not supported");

    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec3 a_klm;
      in vec3 a_color;

      out vec3 v_klm;
      out vec3 v_color;

      uniform mat4 u_mvp;

      void main() {
        gl_Position = u_mvp * vec4(a_position, 0.0, 1.0);
        v_klm = a_klm;
        v_color = a_color;
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision mediump float;

      in vec3 v_klm;
      in vec3 v_color;

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

        float alpha = smoothstep(-1.0, 1.0, sd);

        if(alpha < 0.001) discard;
        fragColor = vec4(v_color, alpha);
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

    const vertexLength = 8;
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

    const klmAttributeLocation = gl.getAttribLocation(program, "a_klm");
    gl.enableVertexAttribArray(klmAttributeLocation);
    gl.vertexAttribPointer(
      klmAttributeLocation,
      3,
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
      5 * Float32Array.BYTES_PER_ELEMENT,
    );

    const mvpUniformLocation = gl.getUniformLocation(program, "u_mvp");

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    const draw = () => {
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      gl.uniformMatrix4fv(mvpUniformLocation, false, mvpMatrix);

      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLES, 0, positionsAndColors.length / vertexLength);
    };

    const mouseDown$ = fromEvent<MouseEvent>(canvas, "mousedown");
    const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove");
    const mouseUp$ = fromEvent<MouseEvent>(document, "mouseup");
    const mouseWheel$ = fromEvent<WheelEvent>(canvas, "wheel");

    const drag$ = mouseDown$.pipe(
      switchMap((startEvent) => {
        let lastX = startEvent.clientX;
        let lastY = startEvent.clientY;

        return mouseMove$.pipe(
          map((moveEvent) => {
            const dx = moveEvent.clientX - lastX;
            const dy = moveEvent.clientY - lastY;

            lastX = moveEvent.clientX;
            lastY = moveEvent.clientY;

            return { dx, dy };
          }),
          takeUntil(mouseUp$),
        );
      }),
    );

    const zoom$ = mouseWheel$.pipe(
      map((event) => {
        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const deltaY = event.deltaY;

        return { mouseX, mouseY, deltaY };
      }),
    );

    const resize$ = new Observable<{ width: number; height: number }>(
      (subscriber) => {
        const resizeObserver = new ResizeObserver((entries) => {
          requestAnimationFrame(() => {
            const { width, height } = entries[0].contentRect;
            subscriber.next({ width, height });
          });
        });
        resizeObserver.observe(container);

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

    const draw$ = merge(drag$, zoom$, resize$);

    const subscription = new Subscription();

    subscription.add(
      drag$.subscribe(({ dx, dy }) => {
        const moveVec = vec3.fromValues(dx, dy, 0);
        const inverted = mat4.invert(mat4.create(), viewMatrix);
        mat4.translate(inverted, inverted, vec3.negate(vec3.create(), moveVec));
        mat4.invert(viewMatrix, inverted);
      }),
    );

    subscription.add(
      zoom$.subscribe(({ mouseX, mouseY, deltaY }) => {
        const mousePos = vec3.fromValues(mouseX, mouseY, 0);
        const inverted = mat4.invert(mat4.create(), viewMatrix);
        vec3.transformMat4(mousePos, mousePos, inverted);

        const delta = clamp(1.0 + deltaY / 1000, 0.5, 2.0);

        mat4.translate(viewMatrix, viewMatrix, mousePos);
        mat4.scale(viewMatrix, viewMatrix, vec3.fromValues(delta, delta, 1));
        mat4.translate(
          viewMatrix,
          viewMatrix,
          vec3.negate(vec3.create(), mousePos),
        );
      }),
    );

    subscription.add(
      resize$.subscribe(({ width, height }) => {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mat4.ortho(projMatrix, 0, width, height, 0, -1, 1);
      }),
    );

    subscription.add(draw$.subscribe(() => draw()));

    const fontSize = 100;
    let offsetX = 0;
    let offsetY = fontSize;
    const text = "Hello World! 你好，世界！";

    opentype.load(fontURL).then((font) => {
      const flip = fontURL.endsWith(".otf");
      const sign = flip ? -1 : 1;

      positionsAndColors = [];

      const getColor = () =>
        Array.from({ length: 3 }, () => Math.random() * 255).join(",");

      for (const glyph of font.stringToGlyphs(text)) {
        const path = glyph.getPath(offsetX, offsetY, fontSize);
        offsetX += ((glyph.advanceWidth || 0) / 1000) * fontSize;
        const { polygons, outerTriangles, innerTriangles } = pathToPolygons(
          path,
          sign,
        );
        const triangles = polygonToTriangles(polygons);

        // prettier-ignore
        triangles.forEach(({ p0, p1, p2 }) => {
          positionsAndColors.push(
            p0.x, p0.y, 1, 1, 0, 0, 1, 0,
            p1.x, p1.y, 1, 0, 1, 0, 1, 0,
            p2.x, p2.y, 1, 0, 0, 0, 1, 0,
          );
        });

        // prettier-ignore
        outerTriangles.forEach(([p0, p1, p2]) => {
          positionsAndColors.push(
            p0.x, p0.y, sign * p0.k, sign * p0.l, p0.m, 1, 0, 0,
            p1.x, p1.y, sign * p1.k, sign * p1.l, p1.m, 1, 0, 0,
            p2.x, p2.y, sign * p2.k, sign * p2.l, p2.m, 1, 0, 0,
          );
        });

        // prettier-ignore
        innerTriangles.forEach(([p0, p1, p2]) => {
          positionsAndColors.push(
            p0.x, p0.y, sign * p0.k, sign * p0.l, p0.m, 0, 0, 1,
            p1.x, p1.y, sign * p1.k, sign * p1.l, p1.m, 0, 0, 1,
            p2.x, p2.y, sign * p2.k, sign * p2.l, p2.m, 0, 0, 1,
          );
        });
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, positionAndColorBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positionsAndColors),
        gl.STATIC_DRAW,
      );

      draw();
    });

    return () => {
      canvas.remove();
      subscription.unsubscribe();
    };
  }, []);

  return <div ref={containerRef} className="min-h-screen"></div>;
}
