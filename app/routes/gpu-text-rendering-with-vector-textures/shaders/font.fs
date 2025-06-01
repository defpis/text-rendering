#version 300 es

precision highp float;

in vec2 v_uv;
flat in float v_index;

uniform highp isampler2D u_glyphs;
uniform sampler2D u_curves;

out vec4 o_color;

vec2 calc_uv(float index, vec2 size) {
  float col = mod(index, size.x);
  float row = floor(index / size.x);
  return vec2(col / size.x, row / size.y);
}

struct Glyph {
  int start, count;
};

Glyph load_glyph(float index) {
  vec2 size = vec2(textureSize(u_glyphs, 0));
  ivec2 data = texture(u_glyphs, calc_uv(index, size)).xy;

  Glyph result;
  result.start = data.x;
  result.count = data.y;
  return result;
}

struct Curve {
  vec2 p0, p1, p2;
};

Curve load_curve(float index) {
  vec2 size = vec2(textureSize(u_curves, 0));

  Curve result;
  result.p0 = texture(u_curves, calc_uv(index * 3.0 + 0.0, size)).xy;
  result.p1 = texture(u_curves, calc_uv(index * 3.0 + 1.0, size)).xy;
  result.p2 = texture(u_curves, calc_uv(index * 3.0 + 2.0, size)).xy;
  return result;
}

float compute_coverage(float w, vec2 p0, vec2 p1, vec2 p2) {
  // 纵向不相交
  if ((p0.y > 0.0 && p1.y > 0.0 && p2.y > 0.0) ||
      (p0.y < 0.0 && p1.y < 0.0 && p2.y < 0.0)) {
    return 0.0;
  }

  vec2 a = p0 - 2.0 * p1 + p2;
  vec2 b = p0 - p1;
  vec2 c = p0;

  // t0 始终是出口，t1 始终是入口
  float t0, t1;

  // a.y 是曲线的二阶导数，判断曲率
  if (abs(a.y) >= 1e-6) {
    float radicand = b.y * b.y - a.y * c.y;
    // 没有解，不相交
    if (radicand <= 0.0) {
      return 0.0;
    }

    float s = sqrt(radicand);
    t0 = (b.y - s) / a.y;
    t1 = (b.y + s) / a.y;
  } else {
    // 直线，t 范围是 [0, 1]，使用 -1 标记无效值
    float t = p0.y / (p0.y - p2.y);
    if (p0.y < p2.y) {
      t0 = -1.0;
      t1 = t;
    } else {
      t0 = t;
      t1 = -1.0;
    }
  }

  float alpha = 0.0;

  // 中心到右边出口距离，需要填充
  if (t0 >= 0.0 && t0 < 1.0) {
    float x = (a.x * t0 - 2.0 * b.x) * t0 + c.x;
    alpha += clamp(x * w + 0.5, 0.0, 1.0);
  }

  // 中心到左边入口距离，需要裁剪
  if (t1 >= 0.0 && t1 < 1.0) {
    float x = (a.x * t1 - 2.0 * b.x) * t1 + c.x;
    alpha -= clamp(x * w + 0.5, 0.0, 1.0);
  }

  return alpha;
}

// 逆时针旋转
vec2 rotate(vec2 v, float r) {
  // return vec2(v.y, -v.x);
  return vec2(v.x * cos(r) - v.y * sin(r), v.x * sin(r) + v.y * cos(r));
}

const float PI = 3.14;

void main() {
  float alpha = 0.0;
  vec2 w = 1.0 / fwidth(v_uv);
  float r = -PI / 2.0;

  Glyph glyph = load_glyph(v_index);
  for (int i = 0; i < glyph.count; i++) {
    Curve curve = load_curve(float(glyph.start + i));

    vec2 p0 = curve.p0 - v_uv;
    vec2 p1 = curve.p1 - v_uv;
    vec2 p2 = curve.p2 - v_uv;

    // 水平方向计算覆盖率
    alpha += compute_coverage(w.x, p0, p1, p2);
    // 垂直方向计算覆盖率
    alpha += compute_coverage(w.y, rotate(p0, r), rotate(p1, r), rotate(p2, r));
  }

  alpha *= 0.5;
  alpha = clamp(alpha, 0.0, 1.0);
  o_color = vec4(0.0, 0.0, 0.0, alpha);
}
