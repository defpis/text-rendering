import { mat4, vec3 } from "gl-matrix";
import { clamp } from "lodash-es";
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
import opentype from "opentype.js";
import fontURL from "~/assets/fonts/LXGWWenKaiMono-Regular.ttf";
import { pathToPoints } from "./pathToPoints";
import { pointsToPolygons } from "./pointsToPolygons";

export default function PathTriangulation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 not supported");

    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      varying vec4 v_color;
      uniform mat4 u_mvp;

      void main() {
        gl_Position = u_mvp * vec4(a_position, 0.0, 1.0);
        v_color = a_color;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      varying vec4 v_color;

      void main() {
        gl_FragColor = v_color;
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Failed to create vertex shader");
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Failed to create fragment shader");
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
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

    const colorAttributeLocation = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(colorAttributeLocation);
    gl.vertexAttribPointer(
      colorAttributeLocation,
      4,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
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
      positionsAndColors = [];

      const getColor = () =>
        Array.from({ length: 3 }, () => Math.random()).concat(1.0);

      for (const glyph of font.stringToGlyphs(text)) {
        const path = glyph.getPath(offsetX, offsetY, fontSize);
        offsetX += ((glyph.advanceWidth || 0) / 1000) * fontSize;
        const pointsGroups = pathToPoints(path.toPathData(3), 0.99);
        const charPolygons = pointsToPolygons(pointsGroups);

        for (const polygon of charPolygons) {
          for (const { p1, p2, p3 } of polygon) {
            positionsAndColors.push(
              p1[0],
              p1[1],
              ...getColor(),
              p2[0],
              p2[1],
              ...getColor(),
              p3[0],
              p3[1],
              ...getColor(),
            );
          }
        }
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
