#version 300 es

precision mediump float;

in vec2 v_uv;

out vec4 o_color;

void main() {
  if (v_uv.x * v_uv.x - v_uv.y < 0.0) {
    o_color = vec4(1.0 / 255.0, 0.0, 0.0, 1.0);
  }
}
