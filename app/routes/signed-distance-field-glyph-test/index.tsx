import { clamp } from "lodash-es";
import { useEffect, useRef } from "react";
import * as twgl from "twgl.js";
import { sdfShader, postShader, basicShader } from "./shaders";
import { mat4, vec3 } from "gl-matrix";
import { registerMouseEvents } from "./mouse";
import fontURL from "~/assets/fonts/LXGWWenKaiMono-Regular.ttf";
import { makeLinesAndCurves } from "./makeLinesAndCurves";
import opentype from "opentype.js";
import { bbox, mid2, type Point } from "./utils";

class BasicRenderer {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniformSetters: any;
  attributeSetters: any;
  vao: WebGLVertexArrayObject | null = null;
  count = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = twgl.createProgram(gl, [basicShader.vs, basicShader.fs]);
    this.uniformSetters = twgl.createUniformSetters(gl, this.program);
    this.attributeSetters = twgl.createAttributeSetters(gl, this.program);
  }

  setData(vertices: number[]) {
    const gl = this.gl;

    const vertexBuffer = twgl.createBufferFromTypedArray(
      gl,
      new Float32Array(vertices),
    );

    const size = 4;

    this.vao = twgl.createVAOAndSetAttributes(gl, this.attributeSetters, {
      a_pos: {
        buffer: vertexBuffer,
        numComponents: 2,
        offset: 0 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
      a_uv: {
        buffer: vertexBuffer,
        numComponents: 2,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
    });

    this.count = vertices.length / size;
  }

  render(uniforms: any) {
    const gl = this.gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(this.program);

    twgl.setUniforms(this.uniformSetters, uniforms);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
  }
}

class SdfRenderer {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniformSetters: any;
  attributeSetters: any;
  vao: WebGLVertexArrayObject | null = null;
  count = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = twgl.createProgram(gl, [sdfShader.vs, sdfShader.fs]);
    this.uniformSetters = twgl.createUniformSetters(gl, this.program);
    this.attributeSetters = twgl.createAttributeSetters(gl, this.program);
  }

  setData(vertices: number[]) {
    const gl = this.gl;

    const vertexBuffer = twgl.createBufferFromTypedArray(
      gl,
      new Float32Array(vertices),
    );

    const size = 6;

    this.vao = twgl.createVAOAndSetAttributes(gl, this.attributeSetters, {
      a_pos: {
        buffer: vertexBuffer,
        numComponents: 2,
        offset: 0 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
      a_uv: {
        buffer: vertexBuffer,
        numComponents: 2,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
      a_start: {
        buffer: vertexBuffer,
        numComponents: 1,
        offset: 4 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
      a_count: {
        buffer: vertexBuffer,
        numComponents: 1,
        offset: 5 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
    });

    this.count = vertices.length / size;
  }

  render(uniforms: any) {
    const gl = this.gl;

    gl.useProgram(this.program);

    twgl.setUniforms(this.uniformSetters, uniforms);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    gl.bindVertexArray(null);
  }
}

class PostRenderer {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniformSetters: any;
  attributeSetters: any;

  vao: WebGLVertexArrayObject | null = null;
  count = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = twgl.createProgram(gl, [postShader.vs, postShader.fs]);
    this.uniformSetters = twgl.createUniformSetters(gl, this.program);
    this.attributeSetters = twgl.createAttributeSetters(gl, this.program);

    // prettier-ignore
    const vertices = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
       1.0, -1.0, 1.0, 0.0,
      -1.0,  1.0, 0.0, 1.0,
       1.0,  1.0, 1.0, 1.0,
    ]);

    const indices = new Uint16Array([0, 1, 2, 3]);

    const vertexBuffer = twgl.createBufferFromTypedArray(gl, vertices);
    const indexBuffer = twgl.createBufferFromTypedArray(
      gl,
      indices,
      gl.ELEMENT_ARRAY_BUFFER,
    );

    const size = 4;

    this.vao = twgl.createVAOAndSetAttributes(
      gl,
      this.attributeSetters,
      {
        a_pos: {
          buffer: vertexBuffer,
          numComponents: 2,
          offset: 0 * Float32Array.BYTES_PER_ELEMENT,
          stride: size * Float32Array.BYTES_PER_ELEMENT,
        },
        a_uv: {
          buffer: vertexBuffer,
          numComponents: 2,
          offset: 2 * Float32Array.BYTES_PER_ELEMENT,
          stride: size * Float32Array.BYTES_PER_ELEMENT,
        },
      },
      indexBuffer,
    );

    this.count = indices.length;
  }

  render(uniforms: any) {
    const gl = this.gl;

    gl.useProgram(this.program);

    twgl.setUniforms(this.uniformSetters, uniforms);

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLE_STRIP, this.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = container.querySelector("canvas")!;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false, // 会导致 webgl 和 canvas 的渐变距离不同
    });
    if (!gl) throw new Error("WebGL 2.0 not supported");

    const char = "我"; // 渲染字符
    const fontSize = 500; // 字体大小
    const padding = 50; // 渐变距离，对应屏幕空间距离
    const glyphPadding = padding / fontSize; // 渐变距离占字体大小的比例
    const MAX = 12; // 2^12 = 4096，纹理最大边长

    const vertices: number[] = []; // 曲线包围盒+边距四边形拆分为两个三角形的顶点坐标
    const curvePos: number[] = []; // 曲线 fontSize 为 1 计算得到的单位坐标
    // LoopBlinn 渲染的三角形坐标，每个曲线拆分为两个三角形
    // 一个三角形（两点与一个固定点围成）实心填充
    // 另一个三角形（三点围成）曲线填充
    // 直线两点与一个固定点围成的三角形并实心填充
    const positions: number[] = [];

    const curvePosTexture = twgl.createTexture(gl, {
      src: new Float32Array(curvePos),
      width: 0,
      height: 0,
      internalFormat: gl.RG32F,
      min: gl.NEAREST,
      mag: gl.NEAREST,
    });

    const fb0 = twgl.createFramebufferInfo(gl, [
      {
        width: canvas.width,
        height: canvas.height,
        format: gl.RGB,
        internalFormat: gl.RGB,
        type: gl.UNSIGNED_BYTE,
        min: gl.NEAREST,
        mag: gl.NEAREST,
      },
    ]);
    twgl.bindFramebufferInfo(gl);
    const fb1 = twgl.createFramebufferInfo(gl, [
      {
        width: canvas.width,
        height: canvas.height,
        format: gl.RGB,
        internalFormat: gl.RGB,
        type: gl.UNSIGNED_BYTE,
        min: gl.NEAREST,
        mag: gl.NEAREST,
      },
    ]);
    twgl.bindFramebufferInfo(gl);

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const sdfRenderer = new SdfRenderer(gl);
    const postRenderer = new PostRenderer(gl);
    const basicRenderer = new BasicRenderer(gl);

    const draw = () => {
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      twgl.bindFramebufferInfo(gl, fb1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      sdfRenderer.render({
        u_max: glyphPadding,
        u_mvp: mvpMatrix,
        u_curves: curvePosTexture,
      });

      twgl.bindFramebufferInfo(gl, fb0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      basicRenderer.render({ u_mvp: mvpMatrix });

      twgl.bindFramebufferInfo(gl);
      gl.clear(gl.COLOR_BUFFER_BIT);

      postRenderer.render({
        u_texture0: fb0.attachments[0],
        u_texture1: fb1.attachments[0],
      });
    };

    const subscription = registerMouseEvents(canvas, {
      onResize: (width, height) => {
        gl.viewport(0, 0, canvas.width, canvas.height);

        twgl.resizeFramebufferInfo(gl, fb0, [
          {
            width: canvas.width,
            height: canvas.height,
            format: gl.RGB,
            internalFormat: gl.RGB,
            type: gl.UNSIGNED_BYTE,
            min: gl.NEAREST,
            mag: gl.NEAREST,
          },
        ]);
        twgl.resizeFramebufferInfo(gl, fb1, [
          {
            width: canvas.width,
            height: canvas.height,
            format: gl.RGB,
            internalFormat: gl.RGB,
            type: gl.UNSIGNED_BYTE,
            min: gl.NEAREST,
            mag: gl.NEAREST,
          },
        ]);

        mat4.ortho(projMatrix, 0, width, height, 0, -1, 1);
      },
      onDrag: (dx, dy) => {
        const moveVec = vec3.fromValues(dx, dy, 0);
        const inverted = mat4.invert(mat4.create(), viewMatrix);
        mat4.translate(inverted, inverted, vec3.negate(vec3.create(), moveVec));
        mat4.invert(viewMatrix, inverted);
      },
      onZoom: (mouseX, mouseY, deltaY) => {
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
      },
      onDraw: () => {
        draw();
      },
    });

    let offsetX = fontSize / 10;
    let offsetY = fontSize;

    opentype.load(fontURL).then((font) => {
      vertices.length = 0;
      curvePos.length = 0;
      positions.length = 0;

      const flip = fontURL.endsWith(".ttf");

      const glyph = font.charToGlyph(char);
      const path = glyph.getPath(0, 0, 1);
      const { lines, curves } = makeLinesAndCurves(path, flip);
      const bb = path.getBoundingBox();
      const p0 = { x: bb.x1, y: bb.y1 };

      // 重心坐标转 uv
      const bary2uv = (a: number, b: number) => {
        return [a + b * 0.5, a];
      };

      const convertPos = (p: Point) => {
        return [offsetX + p.x * fontSize, offsetY + p.y * fontSize];
      };

      lines.forEach(({ p1, p2 }) => {
        const m = mid2(p1, p2);
        curvePos.push(p1.x, p1.y, m.x, m.y, p2.x, p2.y);

        // prettier-ignore
        positions.push(
          ...convertPos(p0), 0, 1,
          ...convertPos(p1), 0, 1,
          ...convertPos(p2), 0, 1,
        );
      });

      curves.forEach(({ p1, p2, p3 }) => {
        curvePos.push(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);

        // prettier-ignore
        positions.push(
          ...convertPos(p0), 0, 1,
          ...convertPos(p1), 0, 1,
          ...convertPos(p3), 0, 1,
        );

        // prettier-ignore
        positions.push(
          ...convertPos(p1), ...bary2uv(1, 0),
          ...convertPos(p2), ...bary2uv(0, 1),
          ...convertPos(p3), ...bary2uv(0, 0),
        );
      });

      const start = 0;
      const count = curvePos.length / 6;

      const u0 = 0 - glyphPadding;
      const v0 = -font.descender / font.unitsPerEm + glyphPadding;

      const u1 = (glyph.advanceWidth || 0) / font.unitsPerEm + glyphPadding;
      const v1 = -font.ascender / font.unitsPerEm - glyphPadding;

      /*
                        (x1, y1)
          +----------------+
          |                |
          |                |
          +----------------+
      (x0, y0)

                        (u1, v1)
          +----------------+
          |                |
          |                |
          +----------------+
      (u0, v0)
      */

      const x0 = offsetX + u0 * fontSize;
      const y0 = offsetY + v0 * fontSize;
      const x1 = offsetX + u1 * fontSize;
      const y1 = offsetY + v1 * fontSize;

      // 两个三角形
      vertices.push(x0, y0, u0, v0, start, count);
      vertices.push(x1, y0, u1, v0, start, count);
      vertices.push(x0, y1, u0, v1, start, count);

      vertices.push(x1, y0, u1, v0, start, count);
      vertices.push(x0, y1, u0, v1, start, count);
      vertices.push(x1, y1, u1, v1, start, count);

      const s = Math.ceil(Math.log2(Math.sqrt(curvePos.length / 2)));
      if (s > MAX) {
        throw new Error("Too many data!"); // TODO: 单个纹理放不下，分割为多个纹理或分批
      }
      const size = Math.pow(2, s);
      curvePos.length = Math.pow(size, 2) * 2;

      twgl.setTextureFromArray(
        gl,
        curvePosTexture,
        new Float32Array(curvePos),
        {
          width: size,
          height: size,
          internalFormat: gl.RG32F,
          min: gl.NEAREST,
          mag: gl.NEAREST,
        },
      );

      sdfRenderer.setData(vertices);

      basicRenderer.setData(positions);

      draw();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen">
      <canvas></canvas>
    </div>
  );
}
