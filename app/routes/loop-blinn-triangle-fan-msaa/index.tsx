import { mat4, vec3 } from "gl-matrix";
import { clamp } from "lodash-es";
import { useEffect, useRef } from "react";
import { registerMouseEvents } from "./mouse";
import * as twgl from "twgl.js";
import { triangleShader, curveShader, postShader } from "./shaders/index";
import opentype from "opentype.js";
import fontURL from "~/assets/fonts/LXGWWenKaiMono-Regular.ttf";
import { pathToPolygons } from "./pathToPolygons";

interface DataPart {
  positions: number[];
  indices: number[];
}

const START_INDEX = 0;
const END_INDEX = 0xffff;

class TriangleRenderer {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniformSetters: any;
  attributeSetters: any;

  parts: DataPart[] = [];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = twgl.createProgram(gl, [
      triangleShader.vs,
      triangleShader.fs,
    ]);
    this.uniformSetters = twgl.createUniformSetters(gl, this.program);
    this.attributeSetters = twgl.createAttributeSetters(gl, this.program);
  }

  setData(parts: DataPart[]) {
    const batches: DataPart[] = [];
    let batch: DataPart = { positions: [], indices: [] };

    for (const part of parts) {
      const partCount = part.positions.length / 2;

      if (partCount + batch.positions.length / 2 >= END_INDEX) {
        batches.push(batch);
        batch = { positions: [], indices: [] };
      }

      batch.indices.push(
        ...part.indices.map((index) =>
          index === END_INDEX ? index : index + batch.positions.length / 2,
        ),
      );
      batch.positions.push(...part.positions);
    }

    if (batch.positions.length > 0) {
      batches.push(batch);
    }

    this.parts = batches;
  }

  render(uniforms: any) {
    const gl = this.gl;

    gl.useProgram(this.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    twgl.setUniforms(this.uniformSetters, uniforms);

    for (const part of this.parts) {
      const { positions, indices } = part;
      const posBuffer = twgl.createBufferFromTypedArray(
        gl,
        new Float32Array(positions),
      );
      const indBuffer = twgl.createBufferFromTypedArray(
        gl,
        new Uint16Array(indices),
        gl.ELEMENT_ARRAY_BUFFER,
      );
      const vao = twgl.createVAOAndSetAttributes(
        gl,
        this.attributeSetters,
        {
          a_position: { buffer: posBuffer, numComponents: 2 },
        },
        indBuffer,
      );

      gl.bindVertexArray(vao);
      gl.drawElementsInstanced(
        gl.TRIANGLE_FAN,
        indices.length,
        gl.UNSIGNED_SHORT,
        0,
        1,
      );
      gl.bindVertexArray(null);
    }

    gl.disable(gl.BLEND);
  }
}

class CurveRenderer {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniformSetters: any;
  attributeSetters: any;
  vao: WebGLVertexArrayObject | null = null;
  count = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = twgl.createProgram(gl, [curveShader.vs, curveShader.fs]);
    this.uniformSetters = twgl.createUniformSetters(gl, this.program);
    this.attributeSetters = twgl.createAttributeSetters(gl, this.program);
  }

  setData(positions: number[]) {
    const gl = this.gl;

    const posBuffer = twgl.createBufferFromTypedArray(
      gl,
      new Float32Array(positions),
    );

    const size = 5;

    this.vao = twgl.createVAOAndSetAttributes(gl, this.attributeSetters, {
      a_position: {
        buffer: posBuffer,
        numComponents: 2,
        offset: 0 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
      a_klm: {
        buffer: posBuffer,
        numComponents: 3,
        offset: 2 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
    });

    this.count = positions.length / size;
  }

  render(uniforms: any) {
    const gl = this.gl;

    gl.useProgram(this.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    twgl.setUniforms(this.uniformSetters, uniforms);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.count, 1);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
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
    const positions = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
       1.0, -1.0, 1.0, 0.0,
      -1.0,  1.0, 0.0, 1.0,
       1.0,  1.0, 1.0, 1.0,
    ]);

    const indices = new Uint16Array([0, 1, 2, 3]);

    const posBuffer = twgl.createBufferFromTypedArray(gl, positions);
    const indBuffer = twgl.createBufferFromTypedArray(
      gl,
      indices,
      gl.ELEMENT_ARRAY_BUFFER,
    );

    const size = 4;

    this.vao = twgl.createVAOAndSetAttributes(
      gl,
      this.attributeSetters,
      {
        a_position: {
          buffer: posBuffer,
          numComponents: 2,
          offset: 0 * Float32Array.BYTES_PER_ELEMENT,
          stride: size * Float32Array.BYTES_PER_ELEMENT,
        },
        a_coord: {
          buffer: posBuffer,
          numComponents: 2,
          offset: 2 * Float32Array.BYTES_PER_ELEMENT,
          stride: size * Float32Array.BYTES_PER_ELEMENT,
        },
      },
      indBuffer,
    );

    this.count = indices.length;
  }

  render(uniforms: any) {
    const gl = this.gl;

    gl.useProgram(this.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);

    twgl.setUniforms(this.uniformSetters, uniforms);

    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLE_STRIP, this.count, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.disable(gl.BLEND);
  }
}

export default function LoopBlinnTriangleFanMSAA() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) throw new Error("WebGL 2.0 is not supported");

    const triangleRenderer = new TriangleRenderer(gl); // 处理轮廓按照 TRIANGLE_FAN 方式绘制
    const curveRenderer = new CurveRenderer(gl); // 绘制贝塞尔曲线填充
    const postRenderer = new PostRenderer(gl); // 多重采样和亚像素抗锯齿后处理

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    const frameBuffer = twgl.createFramebufferInfo(gl, [
      {
        width: canvas.width,
        height: canvas.height,
        internalFormat: gl.RGB,
        format: gl.RGB,
        type: gl.UNSIGNED_BYTE,
        min: gl.NEAREST,
        mag: gl.NEAREST,
      },
    ]);
    twgl.bindFramebufferInfo(gl);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const draw = () => {
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      twgl.bindFramebufferInfo(gl, frameBuffer);

      gl.clear(gl.COLOR_BUFFER_BIT);

      triangleRenderer.render({ u_mvp: mvpMatrix });
      curveRenderer.render({ u_mvp: mvpMatrix });

      twgl.bindFramebufferInfo(gl);

      gl.clear(gl.COLOR_BUFFER_BIT);

      postRenderer.render({ u_texture: frameBuffer.attachments[0] });
    };

    const subscription = registerMouseEvents(canvas, {
      onResize: (width, height) => {
        gl.viewport(0, 0, canvas.width, canvas.height);

        twgl.resizeFramebufferInfo(gl, frameBuffer, [
          {
            width: canvas.width,
            height: canvas.height,
            internalFormat: gl.RGB,
            format: gl.RGB,
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

    const fontSize = 100;
    let offsetX = 0;
    let offsetY = fontSize;
    const text = "Hello World! 你好，世界！";

    opentype.load(fontURL).then((font) => {
      const flip = fontURL.endsWith(".otf");
      const sign = flip ? -1 : 1;

      const parts: DataPart[] = [];
      const curvePos: number[] = [];

      for (const glyph of font.stringToGlyphs(text)) {
        const path = glyph.getPath(offsetX, offsetY, fontSize);
        const bbox = path.getBoundingBox();
        offsetX += ((glyph.advanceWidth || 0) / 1000) * fontSize;
        const { polygons, outerTriangles, innerTriangles } = pathToPolygons(
          path,
          sign,
        );

        const positions = [bbox.x1, bbox.y1];
        const indices = [];

        for (const polygon of polygons) {
          indices.push(START_INDEX);
          for (const point of polygon) {
            indices.push(positions.length / 2);
            positions.push(point.x, point.y);
          }
          indices.push(END_INDEX);
        }

        parts.push({ positions, indices });

        // prettier-ignore
        outerTriangles.forEach(([p0, p1, p2]) => {
          curvePos.push(
            p0.x, p0.y, sign * p0.k, sign * p0.l, p0.m,
            p1.x, p1.y, sign * p1.k, sign * p1.l, p1.m,
            p2.x, p2.y, sign * p2.k, sign * p2.l, p2.m,
          );
        });

        // prettier-ignore
        innerTriangles.forEach(([p0, p1, p2]) => {
          curvePos.push(
            // 添加负号始终绘制凸出区域来计算绕数
            p0.x, p0.y, -sign * p0.k, -sign * p0.l, p0.m,
            p1.x, p1.y, -sign * p1.k, -sign * p1.l, p1.m,
            p2.x, p2.y, -sign * p2.k, -sign * p2.l, p2.m,
          );
        });
      }

      triangleRenderer.setData(parts);
      curveRenderer.setData(curvePos);

      draw();
    });

    return () => {
      canvas.remove();
      subscription.unsubscribe();
    };
  }, []);

  return <div ref={containerRef} className="min-h-screen"></div>;
}
