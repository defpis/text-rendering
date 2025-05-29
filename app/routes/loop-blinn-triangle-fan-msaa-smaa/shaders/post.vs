#version 300 es

in vec2 a_position;
in vec2 a_coord;

out vec2 v_coord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_coord = a_coord;
}
