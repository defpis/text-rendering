#version 300 es

precision mediump float;

in vec3 v_klm;
in vec3 v_color;

layout(location = 0) out vec4 fragColor;

void main() {
  float k = v_klm.x;
  float l = v_klm.y;
  float m = v_klm.z;

  vec2 dk = vec2(dFdx(k), dFdy(k));
  vec2 dl = vec2(dFdx(l), dFdy(l));
  vec2 dm = vec2(dFdx(m), dFdy(m));

  float dfx = 3.0 * k * k * dk.x - (l * dm.x + m * dl.x);
  float dfy = 3.0 * k * k * dk.y - (l * dm.y + m * dl.y);

  float f = k * k * k - l * m;
  float sd = f / length(vec2(dfx, dfy));

  float alpha = smoothstep(-1.0, 1.0, sd);

  if (alpha < 0.001)
    discard;
  fragColor = vec4(v_color, alpha);
}
