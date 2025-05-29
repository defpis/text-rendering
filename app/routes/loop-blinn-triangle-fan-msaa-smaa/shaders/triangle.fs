#version 300 es

precision mediump float;

flat in vec3 v_aa_color;

out vec4 o_color;

void main() { o_color = vec4(v_aa_color, 1.0); }
