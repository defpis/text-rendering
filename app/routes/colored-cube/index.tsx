import { mat4, vec3 } from "gl-matrix";
import { clamp } from "lodash-es";
import { useEffect, useRef } from "react";
import {
  map,
  merge,
  fromEvent,
  Observable,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs";

export default function Page() {
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
    if (!gl) throw new Error("WebGL 2.0 is not supported");

    // 修改后的顶点着色器代码，加入颜色属性
    const vertexShaderSource = `
      attribute vec3 a_position;
      attribute vec4 a_color;
      varying vec4 v_color;
      uniform mat4 u_mvp;

      void main() {
        gl_Position = u_mvp * vec4(a_position, 1.0);
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
    const size = 50.0;

    // prettier-ignore
    const positionsAndColors = [
      // 前表面
      -size, -size,  size,  1.0, 0.0, 0.0, 1.0, // 左下前 红色
       size, -size,  size,  0.0, 1.0, 0.0, 1.0, // 右下前 绿色
       size,  size,  size,  0.0, 0.0, 1.0, 1.0, // 右上前 蓝色
      -size,  size,  size,  1.0, 1.0, 0.0, 1.0, // 左上前 黄色
      // 后表面
      -size, -size, -size,  1.0, 0.0, 1.0, 1.0, // 左下后 紫色
       size, -size, -size,  0.0, 1.0, 1.0, 1.0, // 右下后 青色
       size,  size, -size,  0.0, 0.0, 0.0, 1.0, // 右上后 白色
      -size,  size, -size,  1.0, 1.0, 1.0, 1.0, // 左上后 黑色
    ];

    // prettier-ignore
    const indices = [
      // 前表面
      0, 1, 2,  0, 2, 3,
      // 后表面
      4, 5, 6,  4, 6, 7,
      // 左表面
      0, 3, 7,  0, 7, 4,
      // 右表面
      1, 5, 6,  1, 6, 2,
      // 上表面
      3, 2, 6,  3, 6, 7,
      // 下表面
      0, 4, 5,  0, 5, 1,
    ];

    const positionAndColorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionAndColorBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(positionsAndColors),
      gl.STATIC_DRAW,
    );

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
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
      3,
      gl.FLOAT,
      false,
      7 * Float32Array.BYTES_PER_ELEMENT,
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
      7 * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    );

    const mvpUniformLocation = gl.getUniformLocation(program, "u_mvp");

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    const mouseDown$ = fromEvent<MouseEvent>(canvas, "mousedown");
    // 绑定事件到 document 实现浏览器窗口外拖动
    const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove");
    const mouseUp$ = fromEvent<MouseEvent>(document, "mouseup");
    const mouseWheel$ = fromEvent<WheelEvent>(canvas, "wheel");

    const subscription = new Subscription();

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

    const ROTATE_SPEED = 0.005;
    const ZOOM_SPEED = 0.001;

    subscription.add(
      drag$.subscribe(({ dx, dy }) => {
        const deltaX = dx * ROTATE_SPEED;
        const deltaY = dy * ROTATE_SPEED;

        const inverted = mat4.invert(mat4.create(), viewMatrix);

        const cameraPosition = vec3.fromValues(
          inverted[12],
          inverted[13],
          inverted[14],
        );

        // 构造以目标点为原点的球坐标系
        const spherical = vec3.create();
        vec3.sub(spherical, cameraPosition, cameraTarget);
        const radius = vec3.len(spherical);

        let theta = Math.atan2(spherical[0], spherical[2]);
        let phi = Math.acos(clamp(spherical[1] / radius, -1, 1));

        theta -= deltaX;
        phi -= deltaY;

        phi = clamp(phi, 0.01 * Math.PI, 0.99 * Math.PI);

        const newPosition = vec3.fromValues(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta),
        );

        vec3.add(cameraPosition, cameraTarget, newPosition);
        mat4.lookAt(viewMatrix, cameraPosition, cameraTarget, cameraUp);
      }),
    );

    subscription.add(
      zoom$.subscribe(({ deltaY }) => {
        const inverted = mat4.invert(mat4.create(), viewMatrix);

        // 转换到相机矩阵，就能避免在世界坐标系中的旋转影响
        // 视图矩阵的作用是将世界坐标系中的点转换到相机坐标系中

        const cameraPosition = vec3.fromValues(
          inverted[12],
          inverted[13],
          inverted[14],
        );

        const delta = clamp(1.0 + deltaY * ZOOM_SPEED, 0.5, 2.0);
        vec3.scale(cameraPosition, cameraPosition, delta);

        mat4.lookAt(viewMatrix, cameraPosition, cameraTarget, cameraUp);

        // 有两种缩放实现方式：

        // 1. 调整相机位置的远近
        // Z 轴移动可以保持正确的透视缩短效果（近大远小）
        // mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -deltaY));

        // 2. 调整相机的视野范围
        // const delta = clamp(1.0 + deltaY / 1000, 0.5, 2.0);
        // mat4.scale(viewMatrix, viewMatrix, vec3.fromValues(delta, delta, 1));
      }),
    );

    subscription.add(
      resize$.subscribe(({ width, height }) => {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;

        gl.viewport(0, 0, canvas.width, canvas.height);

        // viewport 会自动处理逻辑像素和物理像素的转换，投影矩阵不再需要处理 dpr

        // 更新投影矩阵
        const aspect = width / height;
        mat4.perspective(projMatrix, Math.PI / 4, aspect, 0.1, 1000);
      }),
    );

    const cameraPosition = vec3.fromValues(0, 0, 500); // 相机位置
    const cameraTarget = vec3.fromValues(0, 0, 0); // 观察目标点
    const cameraUp = vec3.fromValues(0, 1, 0); // 上方向向量

    mat4.lookAt(viewMatrix, cameraPosition, cameraTarget, cameraUp);

    gl.enable(gl.DEPTH_TEST);

    const draw = () => {
      // 计算 MVP 矩阵
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      // 将 MVP 矩阵传递给着色器
      gl.uniformMatrix4fv(mvpUniformLocation, false, mvpMatrix);

      // 清除画布
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // 绘制三角形
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
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
