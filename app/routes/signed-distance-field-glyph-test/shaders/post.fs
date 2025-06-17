#version 300 es

precision mediump float;

in vec2 v_uv;

uniform sampler2D u_texture0;
uniform sampler2D u_texture1;

out vec4 o_color;

const float t = 0.5;

void main() {
  // u_texture0 纹理本身由于放大就有锯齿
  // 采样 u_texture0 得到的 s 因此出现跳变
  // 进而导致 r 的值不稳定，放大出现锯齿
  // 生成 sdf 纹理之后再进行线性采样就没有此问题？
  uint n = uint(texture(u_texture0, v_uv).r * 255.0);
  float s = float(n & 1u);
  float d = texture(u_texture1, v_uv).r;
  float r = s > 0.0 ? 1.0 - d : d;
  float dr = fwidth(r) * 0.5;
  float a = smoothstep(t - dr, t + dr, r);
  o_color = vec4(0.0, 0.0, 0.0, a);
}
