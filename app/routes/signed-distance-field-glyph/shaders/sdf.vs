#version 300 es

in vec2 a_pos;
in vec2 a_uv;
in float a_idx;

uniform mat4 u_mvp;

out vec2 v_uv;
flat out float v_idx;

void main() {
  gl_Position = u_mvp * vec4(a_pos, 0.0, 1.0);
  v_uv = a_uv;
  v_idx = a_idx;
}
