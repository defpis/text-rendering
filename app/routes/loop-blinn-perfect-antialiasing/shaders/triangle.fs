#version 300 es
precision highp float;

flat in vec2 v_prev;
flat in vec2 v_curr;
flat in vec2 v_next;

flat in vec4 v_bounds;

flat in vec2 v_e1;
flat in vec2 v_e2;
flat in vec2 v_e3;

in vec3 v_color;

layout(location = 0) out vec4 o_color;

const float EPSILON = 0.000001;
const float PRECISION_SCALE = 1000.0;

float time_at_pos(float start, float dir, float pos) {
  if (abs(dir) < EPSILON) {
    return 0.0;
  }
  return clamp((pos - start) / dir, 0.0, 1.0);
}

vec4 sort(vec4 val) {
  float a = min(val.x, val.y);
  float b = max(val.x, val.y);
  float c = min(val.z, val.w);
  float d = max(val.z, val.w);

  float h = max(a, min(b, c));
  float i = min(d, max(b, c));

  return vec4(min(a, c), min(h, i), max(h, i), max(b, d));
}

ivec2 prep_point(vec2 point, vec2 pixel_min, vec2 pixel_max) {
  vec2 constrained_point = clamp(point, pixel_min, pixel_max);
  return ivec2(floor(constrained_point * PRECISION_SCALE));
}

int det2(ivec2 p1, ivec2 p2) { return (p1.x * p2.y) - (p1.y * p2.x); }

void main() {
  vec2 pixel_min = floor(gl_FragCoord.xy);
  vec2 pixel_max = pixel_min + 1.0;

  if (pixel_max.x < v_bounds.x || pixel_max.y < v_bounds.y ||
      pixel_min.x > v_bounds.z || pixel_min.y > v_bounds.w) {
    discard;
  }

  vec4 ts1 = sort(vec4(time_at_pos(v_prev.x, v_e1.x, pixel_min.x),
                       time_at_pos(v_prev.x, v_e1.x, pixel_max.x),
                       time_at_pos(v_prev.y, v_e1.y, pixel_min.y),
                       time_at_pos(v_prev.y, v_e1.y, pixel_max.y)));

  ivec2 p11 = prep_point(v_prev + v_e1 * ts1.x, pixel_min, pixel_max);
  ivec2 p12 = prep_point(v_prev + v_e1 * ts1.y, pixel_min, pixel_max);
  ivec2 p13 = prep_point(v_prev + v_e1 * ts1.z, pixel_min, pixel_max);
  ivec2 p14 = prep_point(v_prev + v_e1 * ts1.w, pixel_min, pixel_max);

  vec4 ts2 = sort(vec4(time_at_pos(v_curr.x, v_e2.x, pixel_min.x),
                       time_at_pos(v_curr.x, v_e2.x, pixel_max.x),
                       time_at_pos(v_curr.y, v_e2.y, pixel_min.y),
                       time_at_pos(v_curr.y, v_e2.y, pixel_max.y)));

  ivec2 p21 = prep_point(v_curr + v_e2 * ts2.x, pixel_min, pixel_max);
  ivec2 p22 = prep_point(v_curr + v_e2 * ts2.y, pixel_min, pixel_max);
  ivec2 p23 = prep_point(v_curr + v_e2 * ts2.z, pixel_min, pixel_max);
  ivec2 p24 = prep_point(v_curr + v_e2 * ts2.w, pixel_min, pixel_max);

  vec4 ts3 = sort(vec4(time_at_pos(v_next.x, v_e3.x, pixel_min.x),
                       time_at_pos(v_next.x, v_e3.x, pixel_max.x),
                       time_at_pos(v_next.y, v_e3.y, pixel_min.y),
                       time_at_pos(v_next.y, v_e3.y, pixel_max.y)));

  ivec2 p31 = prep_point(v_next + v_e3 * ts3.x, pixel_min, pixel_max);
  ivec2 p32 = prep_point(v_next + v_e3 * ts3.y, pixel_min, pixel_max);
  ivec2 p33 = prep_point(v_next + v_e3 * ts3.z, pixel_min, pixel_max);
  ivec2 p34 = prep_point(v_next + v_e3 * ts3.w, pixel_min, pixel_max);

  int polygon_area =
      (det2(p11, p12) + det2(p12, p13) + det2(p13, p14) + det2(p14, p21) +
       det2(p21, p22) + det2(p22, p23) + det2(p23, p24) + det2(p24, p31) +
       det2(p31, p32) + det2(p32, p33) + det2(p33, p34) + det2(p34, p11));

  float alpha = clamp(float(abs(polygon_area)) /
                          (2.0 * PRECISION_SCALE * PRECISION_SCALE),
                      0.0, 1.0);
  o_color = vec4(v_color, alpha);
}
