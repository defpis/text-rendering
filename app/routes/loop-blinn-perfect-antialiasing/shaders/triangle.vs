#version 300 es

uniform vec2 u_size;
uniform mat4 u_mvp;

in vec2 a_prev;
in vec2 a_curr;
in vec2 a_next;
in vec3 a_color;

flat out vec2 v_prev;
flat out vec2 v_curr;
flat out vec2 v_next;

flat out vec4 v_bounds;

flat out vec2 v_e1;
flat out vec2 v_e2;
flat out vec2 v_e3;

out vec3 v_color;

vec2 world_to_clip(vec2 pos) {
  vec4 proj_pos = u_mvp * vec4(pos, 0.0, 1.0);
  return proj_pos.xy / proj_pos.w;
}

vec2 clip_to_screen(vec2 pos) { return (u_size.xy * (pos + 1.0)) / 2.0; }

vec2 screen_to_clip(vec2 pos) { return (pos * 2.0 / u_size.xy) - 1.0; }

const float EPSILON = 0.000001;
const float OFFSET = sqrt(2.0) / 2.0;

void main() {
  vec2 c_prev = world_to_clip(a_prev);
  vec2 c_curr = world_to_clip(a_curr);
  vec2 c_next = world_to_clip(a_next);

  v_prev = clip_to_screen(c_prev);
  v_curr = clip_to_screen(c_curr);
  v_next = clip_to_screen(c_next);

  vec2 a = normalize(v_prev - v_curr);
  vec2 b = normalize(v_next - v_curr);

  float angle = sqrt((1.0 - dot(a, b)) / 2.0);

  vec2 pos = c_curr;
  if (abs(angle) > EPSILON) {
    pos = screen_to_clip(v_curr - normalize(a + b) * OFFSET / angle);
  }

  v_bounds = vec4(min(min(v_prev, v_curr), v_next) - 0.5,
                  max(max(v_prev, v_curr), v_next) + 0.5);

  v_e1 = v_curr - v_prev;
  v_e2 = v_next - v_curr;
  v_e3 = v_prev - v_next;

  v_color = a_color;

  gl_Position = vec4(pos, 0.0, 1.0);
}
