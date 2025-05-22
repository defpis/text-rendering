#version 300 es

precision mediump float;

in vec2 v_coord;

uniform sampler2D u_texture;

out vec4 o_color;

void main() {
  float v = float(uint(texture(u_texture, v_coord).x * 255.0) & 1u);
  if (v > 0.0) {
    o_color = vec4(0.0, 0.0, 0.0, 1.0);
  }
}
