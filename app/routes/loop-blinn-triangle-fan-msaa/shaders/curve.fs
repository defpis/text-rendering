#version 300 es

precision mediump float;

in vec3 v_klm;

out vec4 o_color;

void main() {
  float f = pow(v_klm.x, 3.0) - v_klm.y * v_klm.z;
  if (f > 0.0)
    o_color = vec4(1.0 / 255.0, 0.0, 0.0, 1.0);
}
