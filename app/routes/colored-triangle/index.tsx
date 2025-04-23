import { mat4 } from "gl-matrix";
import { useEffect, useRef } from "react";

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
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
    });
    if (!gl) return;

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
    const len = 400.0;

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
      2,
      gl.FLOAT,
      false,
      6 * Float32Array.BYTES_PER_ELEMENT,
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
      6 * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT
    );

    const mvpLocation = gl.getUniformLocation(program, "u_mvp");

    const projectionMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const modelMatrix = mat4.create();

    const tick = () => {
      requestAnimationFrame(tick);

      const mvpMatrix = mat4.create();

      // 计算 MVP 矩阵
      mat4.multiply(mvpMatrix, mvpMatrix, projectionMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

      // 将 MVP 矩阵传递给着色器
      gl.uniformMatrix4fv(mvpLocation, false, mvpMatrix);

      // 清除画布
      gl.clearColor(1.0, 1.0, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 绘制三角形
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    tick();

    const resize = (width: number, height: number, ratio: number) => {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      canvas.width = width * ratio;
      canvas.height = height * ratio;

      gl.viewport(0, 0, canvas.width, canvas.height);

      // 更新投影矩阵
      mat4.ortho(projectionMatrix, 0, width, height, 0, -1, 1);
    };

    // ------------------------------------------------------------------------------
    // 处理窗口大小变化，比如拉伸窗口
    const resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        const { width, height } = entries[0].contentRect;
        resize(width, height, devicePixelRatio);
      });
    });
    resizeObserver.observe(container);

    // 处理设备像素比变化，比如从一个高分辨率屏幕切换到一个低分辨率屏幕
    let remove: () => void;
    const onPixelRatioChange = () => {
      remove?.();

      const query = `(resolution: ${devicePixelRatio}dppx)`;
      const media = matchMedia(query);

      media.addEventListener("change", onPixelRatioChange);
      remove = () => media.removeEventListener("change", onPixelRatioChange);

      const { width, height } = container.getBoundingClientRect();
      resize(width, height, devicePixelRatio);
    };
    onPixelRatioChange();
    // ------------------------------------------------------------------------------

    return () => {
      resizeObserver.disconnect();
      remove?.();
    };
  }, []);

  return <div ref={containerRef} className="min-h-screen"></div>;
}
