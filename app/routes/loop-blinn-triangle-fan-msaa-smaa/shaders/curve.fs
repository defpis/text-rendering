#version 300 es

precision mediump float;

in vec3 v_klm;
flat in vec3 v_aa_color;

out vec4 o_color;

void main() {
  float f = pow(v_klm.x, 3.0) - v_klm.y * v_klm.z;
  if (f > 0.0)
    o_color = vec4(v_aa_color, 1.0);
}
