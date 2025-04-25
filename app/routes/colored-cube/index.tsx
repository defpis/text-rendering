import { mat4, vec3 } from "gl-matrix";
import { useEffect, useRef } from "react";
import { Observable, Subscription } from "rxjs";

export default function ColoredCube() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    // 高度撑满容器时不显示滚动条
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) return;

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
    if (!vertexShader) return;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    // 创建并编译片元着色器
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) return;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    // 创建着色器程序
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // 定义带有颜色信息的三角形顶点数据
    const size = 50.0;

    // prettier-ignore
    const positionsAndColors = [
      // 前表面
      -size, -size,  size, 1.0, 0.0, 0.0, 1.0, // 左下前 红色
       size, -size,  size, 0.0, 1.0, 0.0, 1.0, // 右下前 绿色
       size,  size,  size, 0.0, 0.0, 1.0, 1.0, // 右上前 蓝色
      -size,  size,  size, 1.0, 1.0, 0.0, 1.0, // 左上前 黄色
      // 后表面
      -size, -size, -size, 1.0, 0.0, 1.0, 1.0, // 左下后 紫色
       size, -size, -size, 0.0, 1.0, 1.0, 1.0, // 右下后 青色
       size,  size, -size, 0.0, 0.0, 0.0, 1.0, // 右上后 白色
      -size,  size, -size, 1.0, 1.0, 1.0, 1.0, // 左上后 黑色
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
      gl.STATIC_DRAW
    );

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );

    // 获取位置属性位置并启用
    const positionAttributeLocation = gl.getAttribLocation(
      program,
      "a_position"
    );
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
      positionAttributeLocation,
      3,
      gl.FLOAT,
      false,
      7 * Float32Array.BYTES_PER_ELEMENT,
      0
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
      3 * Float32Array.BYTES_PER_ELEMENT
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
      }
    );

    subscription.add(
      resize$.subscribe(({ width, height }) => {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;

        gl.viewport(0, 0, canvas.width, canvas.height);

        // 更新投影矩阵
        mat4.ortho(
          projMatrix,
          -width / 2,
          width / 2,
          -height / 2,
          height / 2,
          0.1,
          1000
        );
      })
    );

    const cameraPosition = vec3.fromValues(0, 0, 500); // 相机位置
    const cameraTarget = vec3.fromValues(0, 0, 0); // 观察目标点
    const cameraUp = vec3.fromValues(0, 1, 0); // 上方向向量

    mat4.lookAt(viewMatrix, cameraPosition, cameraTarget, cameraUp);

    gl.enable(gl.DEPTH_TEST);

    const draw = () => {
      requestAnimationFrame(draw);

      mat4.rotateY(viewMatrix, viewMatrix, 0.01);
      mat4.rotateX(viewMatrix, viewMatrix, 0.01);

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
    draw();

    return () => {
      canvas.remove();
      subscription.unsubscribe();
    };
  }, []);

  return <div ref={containerRef} className="min-h-screen"></div>;
}
