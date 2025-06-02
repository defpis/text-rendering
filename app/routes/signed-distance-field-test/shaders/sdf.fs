#version 300 es

precision highp float;

flat in float v_idx;

uniform mat4 u_mvp;
uniform vec2 u_size;
uniform float u_max;
uniform sampler2D u_curves;

out vec4 o_color;

// 裁剪空间以画布中心为原点，范围为 [-1, 1]
// 屏幕空间以画布左下角为原点，宽高乘以 dpr

vec2 world_to_clip(vec2 pos) {
  vec4 proj_pos = u_mvp * vec4(pos, 0.0, 1.0);
  return proj_pos.xy / proj_pos.w;
}

vec2 clip_to_screen(vec2 pos) { return (u_size.xy * (pos + 1.0)) / 2.0; }

vec2 world_to_screen(vec2 pos) { return clip_to_screen(world_to_clip(pos)); }

vec2 calc_uv(float index, vec2 size) {
  float col = mod(index, size.x);
  float row = floor(index / size.x);
  return vec2(col / size.x, row / size.y);
}

struct Curve {
  vec2 p0;
  vec2 p1;
  vec2 p2;
};

Curve load_curve(float index) {
  vec2 size = vec2(textureSize(u_curves, 0));

  Curve curve;
  curve.p0 = texture(u_curves, calc_uv(index * 3.0 + 0.0, size)).xy;
  curve.p1 = texture(u_curves, calc_uv(index * 3.0 + 1.0, size)).xy;
  curve.p2 = texture(u_curves, calc_uv(index * 3.0 + 2.0, size)).xy;
  return curve;
}

const float PI = 3.1415926;

vec2 rotate(vec2 v, float r) {
  return vec2(v.x * cos(r) - v.y * sin(r), v.x * sin(r) + v.y * cos(r));
}

void qbezier_to_parabola(Curve curve, out mat3 matrix, out float scale,
                         out vec2 x_limits) {
  vec2 p0 = curve.p0;
  vec2 p1 = curve.p1;
  vec2 p2 = curve.p2;

  vec2 c02 = mix(p0, p2, 0.5);

  vec2 v01 = p1 - p0;
  vec2 v02 = p2 - p0;
  vec2 v10 = p0 - p1;
  vec2 v12 = p2 - p1;

  float cosAngle = dot(normalize(v10), normalize(v12));
  float threshold = 1.0 - 1e-6; // 视为共线的阈值

  vec2 x_axis;
  vec2 y_axis;
  vec2 translate;

  if (cosAngle >= threshold || cosAngle <= -threshold) {
    x_axis = normalize(v02);
    y_axis = rotate(x_axis, PI * 0.5);

    float x_range = 1e-3;
    x_limits = vec2(-x_range, x_range);

    float l02 = length(v02);
    scale = l02 / 2.0 / x_range;

    float y_offset = l02 * pow(x_range, 2.0);
    translate = c02 + y_offset * y_axis;
  } else {
    y_axis = normalize(c02 - p1);
    x_axis = rotate(y_axis, -PI / 2.0);

    float x0 = dot(y_axis, v01) / dot(x_axis, v01) / 2.0;
    float x1 = dot(y_axis, v12) / dot(x_axis, v12) / 2.0;

    scale = dot(x_axis, v02) / (x1 - x0);
    translate = p0 - scale * x_axis * x0 - scale * y_axis * pow(x0, 2.0);
    x_limits = x0 < x1 ? vec2(x0, x1) : vec2(x1, x0);
  }

  matrix = mat3(x_axis * scale, 0.0, y_axis * scale, 0.0, translate, 1.0);
}

vec2 convert_space(mat3 matrix, vec2 pos) {
  vec3 p = matrix * vec3(pos, 1.0);
  return p.xy / p.z;
}

void nearest_on_parabola(vec2 pos, vec2 x_limits, out vec2 nearest,
                         out float distance) {
  float p = 0.5 - pos.y;
  float q = -0.5 * pos.x;

  float d = pow(q / 2.0, 2.0) + pow(p / 3.0, 3.0);
  float t = -p / 3.0;
  float s = -sign(q);

  if (d >= 0.0) {
    float a = pow(abs(q) / 2.0 + sqrt(d), 1.0 / 3.0);
    float x = s * (a + t / a);
    float cx = clamp(x, x_limits.x, x_limits.y);
    nearest = vec2(cx, pow(cx, 2.0));
    distance = length(pos - nearest);
  } else {
    float cos3a = sqrt(abs(27.0 * pow(q, 2.0) / (4.0 * pow(p, 3.0))));
    float a = acos(cos3a) / 3.0;
    float x0 = s * 2.0 * sqrt(t) * cos(a);
    float sd = s * sqrt(-3.0 * pow(x0, 2.0) - 4.0 * p);
    float x1 = (-x0 - sd) / 2.0;

    float cx0 = clamp(x0, x_limits.x, x_limits.y);
    float cx1 = clamp(x1, x_limits.x, x_limits.y);

    vec2 p0 = vec2(cx0, pow(cx0, 2.0));
    vec2 p1 = vec2(cx1, pow(cx1, 2.0));

    vec2 v0 = pos - p0;
    vec2 v1 = pos - p1;

    float s0 = dot(v0, v0);
    float s1 = dot(v1, v1);

    nearest = s0 < s1 ? p0 : p1;
    distance = sqrt(min(s0, s1));
  }
}

void main() {
  Curve curve = load_curve(v_idx);

  curve.p0 = world_to_screen(curve.p0);
  curve.p1 = world_to_screen(curve.p1);
  curve.p2 = world_to_screen(curve.p2);

  mat3 matrix;
  float scale;
  vec2 x_limits;

  qbezier_to_parabola(curve, matrix, scale, x_limits);

  mat3 inverse_matrix = inverse(matrix);

  vec2 p = convert_space(inverse_matrix, gl_FragCoord.xy);

  vec2 nearest;
  float distance;

  nearest_on_parabola(p, x_limits, nearest, distance);

  float alpha = 1.0 - clamp(scale * distance / u_max, 0.0, 1.0);

  o_color = vec4(1.0, 1.0, 0.0, alpha);
}
