#version 300 es

precision mediump float;

in vec2 v_coord;

uniform sampler2D u_texture;

out vec4 o_color;

void main() {
  vec2 dx = vec2(dFdx(v_coord.x), 0.0);

  uvec3 t_brg = uvec3(texture(u_texture, v_coord).xyz * 255.0);
  uvec2 t_rg = uvec2(texture(u_texture, v_coord + dx).yz * 255.0);

  vec3 brg = vec3((t_brg & 1u) + ((t_brg & 16u) >> 4));
  vec2 rg = vec2((t_rg & 1u) + ((t_rg & 16u) >> 4));

  // float a = (brg.x + brg.y + brg.z) / 6.0;
  // float b = (rg.x + rg.y) / 4.0;

  // o_color = vec4(a - b, 0.0, 0.0, 1.0);
  // return;

  vec3 res = vec3(
    brg.x + brg.y + brg.z, /* R G [B] [R] [G] B R G B */
     rg.y + brg.x + brg.y, /* R G [B] [R] G B R [G] B */
     rg.x +  rg.y + brg.x  /* R G [B] R G B [R] [G] B */) / 6.0;

  o_color = vec4(1.0 - res, 1.0);
}
