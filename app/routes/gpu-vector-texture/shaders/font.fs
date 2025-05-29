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

void main() {
  Glyph glyph = load_glyph(v_index);

  for (int i = 0; i < glyph.count; i++) {
    Curve curve = load_curve(float(glyph.start + i));

    // if (i == 2) {
    //   o_color = vec4(curve.p2, 0.0, 1.0);
    //   return;
    // }

    vec2 p0 = curve.p0 - v_uv;
    vec2 p1 = curve.p1 - v_uv;
    vec2 p2 = curve.p2 - v_uv;
  }

  o_color = vec4(0.0, 0.0, 0.0, 1.0);
}
