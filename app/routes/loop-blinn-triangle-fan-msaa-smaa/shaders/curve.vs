#version 300 es

in vec2 a_position;
in vec3 a_klm;
in vec2 a_aa_delta;
in vec3 a_aa_color;

uniform mat4 u_mvp;
uniform vec2 u_size;

out vec3 v_klm;
flat out vec3 v_aa_color;

vec2 world_to_clip(vec2 pos) {
  vec4 proj_pos = u_mvp * vec4(pos, 0.0, 1.0);
  return proj_pos.xy / proj_pos.w;
}

vec2 clip_to_screen(vec2 pos) { return (u_size.xy * (pos + 1.0)) / 2.0; }

vec2 screen_to_clip(vec2 pos) { return (pos * 2.0 / u_size.xy) - 1.0; }

void main() {
  v_klm = a_klm;
  v_aa_color = a_aa_color;

  vec2 c_pos = world_to_clip(a_position);
  vec2 s_pos = clip_to_screen(c_pos);
  s_pos += a_aa_delta;
  c_pos = screen_to_clip(s_pos);

  gl_Position = vec4(c_pos, 0.0, 1.0);
}
