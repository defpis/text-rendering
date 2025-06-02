#version 300 es

precision mediump float;

in vec2 v_uv;

uniform sampler2D u_texture0;
uniform sampler2D u_texture1;

out vec4 o_color;

void main() {
  uint n = uint(texture(u_texture0, v_uv).r * 255.0);
  float s = float(n & 1u);
  float d = texture(u_texture1, v_uv).r;

  float r = s > 0.0 ? 1.0 - d : d;
  o_color = vec4(r, 0.0, 0.0, 1.0);
}
