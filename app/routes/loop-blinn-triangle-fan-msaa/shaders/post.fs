#version 300 es

precision mediump float;

in vec2 v_coord;

uniform sampler2D u_texture;

out vec4 o_color;

void main() {
  uvec3 a = uvec3(texture(u_texture, v_coord).xyz * 255.0);
  uvec3 b = uvec3(texture(u_texture, v_coord + vec2(dFdx(v_coord.x), 0.0)).xyz *
                  255.0);

  vec3 aa = vec3((a & 1u) + ((a & 16u) >> 4));
  vec2 bb = vec2((b & 1u) + ((b & 16u) >> 4));

  vec3 res = vec3(aa.r + aa.g + aa.b, // [r] [g] b  r   g  [b]
                  bb.y + aa.r + aa.g, // [r]  g  b  r  [g] [b]
                  bb.x + bb.y + aa.r  //  r   g  b [r] [g] [b]
                  ) /
             6.0;

  o_color = vec4(1.0 - res, 1.0);
}
