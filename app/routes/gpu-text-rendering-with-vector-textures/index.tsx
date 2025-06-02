import { mat4, vec3 } from "gl-matrix";
import { clamp } from "lodash-es";
import { useEffect, useRef } from "react";
import { registerMouseEvents } from "./mouse";
import opentype from "opentype.js";
import fontURL from "~/assets/fonts/LXGWWenKaiMono-Regular.ttf";
// import fontURL from "~/assets/fonts/PingFangSC-Regular.otf";
import { makeCurves } from "./makeCurves";
import * as twgl from "twgl.js";
import { fontShader } from "./shaders";

export default function Page() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) throw new Error("WebGL 2.0 is not supported");

    const projMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const mvpMatrix = mat4.create();

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const program = twgl.createProgram(gl, [fontShader.vs, fontShader.fs]);
    const uniformSetters = twgl.createUniformSetters(gl, program);
    const attributeSetters = twgl.createAttributeSetters(gl, program);

    // prettier-ignore
    const vertices: number[] = [
        0,   0, 0, 0, 0,
      100,   0, 0, 0, 0,
        0, 100, 0, 0, 0,
    ];
    // prettier-ignore
    const glyphPos: number[] = [ // 1x1
      0.0, 3.0,
    ];
    // prettier-ignore
    const curvePos: number[] = [ // 3x3
      1.0, 0.0,  0.0, 1.0,  0.0, 0.0,
      0.0, 1.0,  0.0, 0.0,  1.0, 0.0,
      0.0, 0.0,  1.0, 0.0,  0.0, 1.0,
    ];

    const vertexBuffer = twgl.createBufferFromTypedArray(
      gl,
      new Float32Array(vertices),
    );

    const size = 5;
    const vao = twgl.createVAOAndSetAttributes(gl, attributeSetters, {
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
      a_index: {
        buffer: vertexBuffer,
        numComponents: 1,
        offset: 4 * Float32Array.BYTES_PER_ELEMENT,
        stride: size * Float32Array.BYTES_PER_ELEMENT,
      },
    });

    const MAX_SIZE = 4096; // 纹理固定宽度，高度自适应
    const MAX_DATA = MAX_SIZE * MAX_SIZE * 2;

    const glyphPosTexture = twgl.createTexture(gl, {
      src: new Int32Array(glyphPos), // 可以支持填充稀疏数组
      width: 1,
      height: 1,
      internalFormat: gl.RG32I,
      min: gl.NEAREST,
      mag: gl.NEAREST,
    });
    const curvePosTexture = twgl.createTexture(gl, {
      src: new Float32Array(curvePos),
      width: 3,
      height: 3,
      internalFormat: gl.RG32F,
      min: gl.NEAREST,
      mag: gl.NEAREST,
    });

    // const ext = gl.getExtension("EXT_texture_buffer"); // 是否支持 TEXTURE_BUFFER
    // const extensions = gl.getSupportedExtensions(); // 获取所有支持的扩展

    const draw = () => {
      mat4.identity(mvpMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, projMatrix);
      mat4.multiply(mvpMatrix, mvpMatrix, viewMatrix);

      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      twgl.setUniforms(uniformSetters, {
        u_mvp: mvpMatrix,
        u_glyphs: glyphPosTexture,
        u_curves: curvePosTexture,
      });

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / size);
      gl.bindVertexArray(null);
    };

    const subscription = registerMouseEvents(canvas, {
      onResize: (width, height) => {
        gl.viewport(0, 0, canvas.width, canvas.height);
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
      onDraw: () => draw(),
    });

    const text = "Hello World! 你好，世界！";
    const fontSize = 100;

    let offsetX = 0;
    let offsetY = fontSize;

    opentype.load(fontURL).then((font) => {
      vertices.length = 0;
      glyphPos.length = 0;
      curvePos.length = 0;

      const flip = fontURL.endsWith(".ttf");

      for (const glyph of font.stringToGlyphs(text)) {
        const curves = makeCurves(glyph, flip);

        const u0 = 0;
        const v0 = -font.descender / font.unitsPerEm;

        const u1 = (glyph.advanceWidth || 0) / font.unitsPerEm;
        const v1 = -font.ascender / font.unitsPerEm;

        const count = curves.length;
        if (!count) {
          offsetX += u1 * fontSize; // 跳过空白字符
          continue;
        }
        const start = curvePos.length / 6;

        curves.forEach(({ p1, p2, p3 }) => {
          curvePos.push(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        });

        glyphPos[glyph.index * 2 + 0] = start;
        glyphPos[glyph.index * 2 + 1] = count;

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
        vertices.push(x0, y0, u0, v0, glyph.index);
        vertices.push(x1, y0, u1, v0, glyph.index);
        vertices.push(x0, y1, u0, v1, glyph.index);

        vertices.push(x1, y0, u1, v0, glyph.index);
        vertices.push(x0, y1, u0, v1, glyph.index);
        vertices.push(x1, y1, u1, v1, glyph.index);

        offsetX += (u1 - u0) * fontSize;
      }

      offsetY += fontSize;

      if (glyphPos.length > MAX_DATA || curvePos.length > MAX_DATA) {
        throw new Error("Too many data!");
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(vertices),
        gl.STATIC_DRAW,
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      const h1 = Math.ceil(glyphPos.length / 2 / MAX_SIZE);
      glyphPos.length = MAX_SIZE * h1 * 2;

      twgl.setTextureFromArray(gl, glyphPosTexture, new Int32Array(glyphPos), {
        width: MAX_SIZE,
        height: h1,
        internalFormat: gl.RG32I,
        min: gl.NEAREST,
        mag: gl.NEAREST,
      });

      const h2 = Math.ceil(curvePos.length / 2 / MAX_SIZE);
      curvePos.length = MAX_SIZE * h2 * 2;

      twgl.setTextureFromArray(
        gl,
        curvePosTexture,
        new Float32Array(curvePos),
        {
          width: MAX_SIZE,
          height: h2,
          internalFormat: gl.RG32F,
          min: gl.NEAREST,
          mag: gl.NEAREST,
        },
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
