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

export default function ColoredTriangle() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    // 高度撑满容器时不显示滚动条
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 not supported");

    // 修改后的顶点着色器代码，加入颜色属性
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

    // 修改后的片元着色器代码，使用传入的颜色
    const fragmentShaderSource = `
      precision mediump float;
      varying vec4 v_color;

      void main() {
        gl_FragColor = v_color;
      }
    `;

    // 创建并编译顶点着色器
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Failed to create vertex shader");
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    // 创建并编译片元着色器
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Failed to create fragment shader");
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    // 创建着色器程序
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // 定义带有颜色信息的三角形顶点数据
    const len = 100.0;

    // prettier-ignore
    const positionsAndColors = [
      // 位置         颜色
         0.0, 0.0,   1.0, 0.0, 0.0, 1.0, // 红色
         0.0, len,   0.0, 1.0, 0.0, 1.0, // 绿色
         len, 0.0,   0.0, 0.0, 1.0, 1.0, // 蓝色
    ];

    // 创建缓冲区并绑定数据
    const positionAndColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionAndColorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positionsAndColors),
      gl.STATIC_DRAW,
    );

    // 获取位置属性位置并启用
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
      6 * Float32Array.BYTES_PER_ELEMENT,
      0,
    );

    // 获取颜色属性位置并启用
    const colorAttributeLocation = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(colorAttributeLocation);
    gl.vertexAttribPointer(
      colorAttributeLocation,
      4,
      gl.FLOAT,
      false,
      6 * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    const mvpUniformLocation = gl.getUniformLocation(program, "u_mvp");

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    // RxJS 处理鼠标事件
    const mouseDown$ = fromEvent<MouseEvent>(canvas, "mousedown");
    // 绑定事件到 document 实现浏览器窗口外拖动
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

    const subscription = new Subscription();

    // 视图矩阵：World -> Camera
    // 相机矩阵：Camera -> World

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

        // 更新投影矩阵
        mat4.ortho(projMatrix, 0, width, height, 0, -1, 1);
      }),
    );

    const draw = () => {
      // 计算 MVP 矩阵
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      // 将 MVP 矩阵传递给着色器
      gl.uniformMatrix4fv(mvpUniformLocation, false, mvpMatrix);

      // 清除画布
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 绘制三角形
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const draw$ = merge(drag$, zoom$, resize$);
    subscription.add(draw$.subscribe(() => draw()));

    return () => {
      canvas.remove();
      subscription.unsubscribe();
    };
  }, []);

  return <div ref={containerRef} className="min-h-screen"></div>;
}
