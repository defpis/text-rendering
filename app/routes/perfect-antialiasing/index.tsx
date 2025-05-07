import { mat4, vec2, vec3 } from "gl-matrix";
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
// import fontURL from "~/assets/fonts/PingFangSC-Regular.otf";
import { pathToPoints } from "./pathToPoints";
import { pointsToPolygons } from "./pointsToPolygons";

export default function PerfectAntialiasing() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 not supported");

    const vertexShaderSource = `#version 300 es
      uniform vec2 u_size;
      uniform mat4 u_mvp;

      in vec2 a_prev;
      in vec2 a_curr;
      in vec2 a_next;
      in vec3 a_color;

      flat out vec2 v_prev;
      flat out vec2 v_curr;
      flat out vec2 v_next;

      flat out vec4 v_bounds;

      flat out vec2 v_e1;
      flat out vec2 v_e2;
      flat out vec2 v_e3;

      out vec3 v_color;

      vec2 world_to_clip(vec2 pos) {
        vec4 proj_pos = u_mvp * vec4(pos, 0.0, 1.0);
        return proj_pos.xy / proj_pos.w;
      }

      vec2 clip_to_screen(vec2 pos) {
        return (u_size.xy * (pos + 1.0)) / 2.0;
      }

      vec2 screen_to_clip(vec2 pos) {
        return (pos * 2.0 / u_size.xy) - 1.0;
      }

      const float EPSILON = 0.000001;
      const float OFFSET = sqrt(2.0) / 2.0;

      void main() {
        vec2 c_prev = world_to_clip(a_prev);
        vec2 c_curr = world_to_clip(a_curr);
        vec2 c_next = world_to_clip(a_next);

        v_prev = clip_to_screen(c_prev);
        v_curr = clip_to_screen(c_curr);
        v_next = clip_to_screen(c_next);

        vec2 a = normalize(v_prev - v_curr);
        vec2 b = normalize(v_next - v_curr);

        float angle = sqrt((1.0 - dot(a, b)) / 2.0);

        vec2 pos = c_curr;
        if (abs(angle) > EPSILON) {
          pos = screen_to_clip(v_curr - normalize(a + b) * OFFSET / angle);
        }

        v_bounds = vec4(
          min(min(v_prev, v_curr), v_next) - 0.5,
          max(max(v_prev, v_curr), v_next) + 0.5
        );

        v_e1 = v_curr - v_prev;
        v_e2 = v_next - v_curr;
        v_e3 = v_prev - v_next;

        v_color = a_color;

        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;

      flat in vec2 v_prev;
      flat in vec2 v_curr;
      flat in vec2 v_next;

      flat in vec4 v_bounds;

      flat in vec2 v_e1;
      flat in vec2 v_e2;
      flat in vec2 v_e3;

      in vec3 v_color;

      layout(location = 0) out vec4 o_color;

      const float EPSILON = 0.000001;
      const float PRECISION_SCALE = 1000.0;

      float time_at_pos(float start, float dir, float pos) {
        if (abs(dir) < EPSILON) {
          return 0.0;
        }
        return clamp((pos - start) / dir, 0.0, 1.0);
      }

      vec4 sort(vec4 val) {
        float a = min(val.x, val.y);
        float b = max(val.x, val.y);
        float c = min(val.z, val.w);
        float d = max(val.z, val.w);

        float h = max(a, min(b, c));
        float i = min(d, max(b, c));

        return vec4(min(a, c), min(h, i), max(h, i), max(b, d));
      }

      ivec2 prep_point(vec2 point, vec2 pixel_min, vec2 pixel_max) {
        vec2 constrained_point = clamp(point, pixel_min, pixel_max);
        return ivec2(floor(constrained_point * PRECISION_SCALE));
      }

      int det2(ivec2 p1, ivec2 p2) {
        return (p1.x * p2.y) - (p1.y * p2.x);
      }

      void main() {
        vec2 pixel_min = floor(gl_FragCoord.xy);
        vec2 pixel_max = pixel_min + 1.0;

        if (pixel_max.x < v_bounds.x || pixel_max.y < v_bounds.y || pixel_min.x > v_bounds.z || pixel_min.y > v_bounds.w) {
          discard;
        }

        vec4 ts1 = sort(vec4(
          time_at_pos(v_prev.x, v_e1.x, pixel_min.x),
          time_at_pos(v_prev.x, v_e1.x, pixel_max.x),
          time_at_pos(v_prev.y, v_e1.y, pixel_min.y),
          time_at_pos(v_prev.y, v_e1.y, pixel_max.y)
        ));

        ivec2 p11 = prep_point(v_prev + v_e1 * ts1.x, pixel_min, pixel_max);
        ivec2 p12 = prep_point(v_prev + v_e1 * ts1.y, pixel_min, pixel_max);
        ivec2 p13 = prep_point(v_prev + v_e1 * ts1.z, pixel_min, pixel_max);
        ivec2 p14 = prep_point(v_prev + v_e1 * ts1.w, pixel_min, pixel_max);

        vec4 ts2 = sort(vec4(
          time_at_pos(v_curr.x, v_e2.x, pixel_min.x),
          time_at_pos(v_curr.x, v_e2.x, pixel_max.x),
          time_at_pos(v_curr.y, v_e2.y, pixel_min.y),
          time_at_pos(v_curr.y, v_e2.y, pixel_max.y)
        ));

        ivec2 p21 = prep_point(v_curr + v_e2 * ts2.x, pixel_min, pixel_max);
        ivec2 p22 = prep_point(v_curr + v_e2 * ts2.y, pixel_min, pixel_max);
        ivec2 p23 = prep_point(v_curr + v_e2 * ts2.z, pixel_min, pixel_max);
        ivec2 p24 = prep_point(v_curr + v_e2 * ts2.w, pixel_min, pixel_max);

        vec4 ts3 = sort(vec4(
          time_at_pos(v_next.x, v_e3.x, pixel_min.x),
          time_at_pos(v_next.x, v_e3.x, pixel_max.x),
          time_at_pos(v_next.y, v_e3.y, pixel_min.y),
          time_at_pos(v_next.y, v_e3.y, pixel_max.y)
        ));

        ivec2 p31 = prep_point(v_next + v_e3 * ts3.x, pixel_min, pixel_max);
        ivec2 p32 = prep_point(v_next + v_e3 * ts3.y, pixel_min, pixel_max);
        ivec2 p33 = prep_point(v_next + v_e3 * ts3.z, pixel_min, pixel_max);
        ivec2 p34 = prep_point(v_next + v_e3 * ts3.w, pixel_min, pixel_max);

        int polygon_area = (
          det2(p11, p12) + det2(p12, p13) + det2(p13, p14) + det2(p14, p21) +
          det2(p21, p22) + det2(p22, p23) + det2(p23, p24) + det2(p24, p31) +
          det2(p31, p32) + det2(p32, p33) + det2(p33, p34) + det2(p34, p11)
        );

        float alpha = clamp(float(abs(polygon_area)) / (2.0 * PRECISION_SCALE * PRECISION_SCALE), 0.0, 1.0);
        o_color = vec4(v_color, alpha);
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Failed to create vertex shader");
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("VERTEX SHADER ERROR:", gl.getShaderInfoLog(vertexShader));
      throw new Error("Vertex shader compilation failed");
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Failed to create fragment shader");
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(
        "FRAGMENT SHADER ERROR:",
        gl.getShaderInfoLog(fragmentShader),
      );
      throw new Error("Fragment shader compilation failed");
    }

    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("PROGRAM LINK ERROR:", gl.getProgramInfoLog(program));
      throw new Error("Program linking failed");
    }
    gl.useProgram(program);

    const vertexLength = 9;
    let positionsAndColors: number[] = [];

    const positionAndColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionAndColorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positionsAndColors),
      gl.STATIC_DRAW,
    );

    const prevPositionAttributeLocation = gl.getAttribLocation(
      program,
      "a_prev",
    );
    gl.enableVertexAttribArray(prevPositionAttributeLocation);
    gl.vertexAttribPointer(
      prevPositionAttributeLocation,
      2,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      0 * Float32Array.BYTES_PER_ELEMENT,
    );

    const currPositionAttributeLocation = gl.getAttribLocation(
      program,
      "a_curr",
    );
    gl.enableVertexAttribArray(currPositionAttributeLocation);
    gl.vertexAttribPointer(
      currPositionAttributeLocation,
      2,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    const nextPositionAttributeLocation = gl.getAttribLocation(
      program,
      "a_next",
    );
    gl.enableVertexAttribArray(nextPositionAttributeLocation);
    gl.vertexAttribPointer(
      nextPositionAttributeLocation,
      2,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      4 * Float32Array.BYTES_PER_ELEMENT,
    );

    const colorAttributeLocation = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(colorAttributeLocation);
    gl.vertexAttribPointer(
      colorAttributeLocation,
      3,
      gl.FLOAT,
      false,
      vertexLength * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT,
    );

    const mvpUniformLocation = gl.getUniformLocation(program, "u_mvp");
    const sizeUniformLocation = gl.getUniformLocation(program, "u_size");

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const draw = () => {
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      gl.uniformMatrix4fv(mvpUniformLocation, false, mvpMatrix);
      gl.uniform2fv(sizeUniformLocation, [canvas.width, canvas.height]);

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

    let debug = false;

    opentype.load(fontURL).then((font) => {
      positionsAndColors = [];

      const getColor = () =>
        debug ? Array.from({ length: 3 }, () => Math.random()) : [0, 0, 0];

      for (const glyph of font.stringToGlyphs(text)) {
        const path = glyph.getPath(offsetX, offsetY, fontSize);
        offsetX += ((glyph.advanceWidth || 0) / 1000) * fontSize;
        const pointsGroups = pathToPoints(path.toPathData(3), 0.99);
        const charPolygons = pointsToPolygons(pointsGroups);

        for (const polygon of charPolygons) {
          for (const { p1, p2, p3 } of polygon) {
            // prettier-ignore
            positionsAndColors.push(
              //  prev          curr          next
              p3[0], p3[1], p1[0], p1[1], p2[0], p2[1], ...getColor(),
              p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], ...getColor(),
              p2[0], p2[1], p3[0], p3[1], p1[0], p1[1], ...getColor(),
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
