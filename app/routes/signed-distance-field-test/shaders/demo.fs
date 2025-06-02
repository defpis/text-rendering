// https://astiopin.github.io/2019/01/04/qbez-parabola.html

// Parabolic segment parameters
mat2 pmat;    // Basis (unscaled)
vec2 xlimits; // Starting and ending points
vec2 vertex;  // Vertex coordinates
float pscale; // Basis scale

void qbezierToParabola(in vec2 p0, in vec2 p1, in vec2 p2) {
  vec2 pc = mix(p0, p2, 0.5f);
  float d = dot(normalize(p0 - p1), normalize(p2 - p1));
  float dmax = 1.0 - 1e-6f;

  // One or two line segments
  if (d >= dmax || d <= -dmax) {
    float prec = 0.000001;
    vec2 xaxis = normalize(p2 - p0);
    float ldir = length(p2 - p0);
    vec2 yaxis = vec2(-xaxis.y, xaxis.x);
    float ylen = ldir * prec;
    float xlen = sqrt(prec);

    vertex = pc + ylen * yaxis;
    xlimits = vec2(-xlen, xlen);
    pscale = 0.5f * ldir / xlen;
    pmat = mat2(xaxis, yaxis);

    return;
  }

  // Parabolic segment

  vec2 yaxis = normalize(pc - p1);
  vec2 xaxis = vec2(yaxis.y, -yaxis.x);

  vec2 p01 = normalize(p1 - p0);
  vec2 p12 = normalize(p2 - p1);
  float cx0 = dot(xaxis, p01);
  float sx0 = dot(yaxis, p01);
  float cx2 = dot(xaxis, p12);
  float sx2 = dot(yaxis, p12);

  float x0 = sx0 / cx0 * 0.5;
  float x2 = sx2 / cx2 * 0.5;
  float y0 = x0 * x0;

  float p02x = dot(p2 - p0, xaxis);
  pscale = p02x / (x2 - x0);
  vertex = p0 - vec2(y0 * pscale) * yaxis - vec2(x0 * pscale) * xaxis;
  pmat = mat2(xaxis, yaxis);

  if (x0 < x2) {
    xlimits = vec2(x0, x2);
  } else {
    xlimits = vec2(x2, x0);
  }
}

vec2 worldToParabolaSpace(in vec2 pos) {
  float is = 1.0 / pscale;
  vec2 dpos = pos - vertex;
  vec2 r0 = dpos * pmat[0];
  vec2 r1 = dpos * pmat[1];
  float v0 = is * (r0.x + r0.y);
  float v1 = is * (r1.x + r1.y);
  return vec2(v0, v1);
}

void nearestPointOnParabola(vec2 ppos, out float res_x, out float res_dist) {
  float p = 0.5 - ppos.y;
  float q = -0.5 * ppos.x;

  // Solving  x^3 + p*x + q = 0

  float sigx = ppos.x > 0.0 ? 1.0 : -1.0;
  float sq = 27.0 * q * q;
  float cp = 4.0 * p * p * p;
  float tp = -p * 0.33333333;

  if (sq >= -cp) {
    // Point below evolute - single root
    float a = pow(0.5 * (abs(q) + sqrt((sq + cp) / 27.0)), 0.33333333);
    float x0 = sigx * (a + tp / a);
    float cx0 = clamp(x0, xlimits.x, xlimits.y);

    res_x = cx0;
    res_dist = length(vec2(cx0, cx0 * cx0) - ppos);
  } else {
    // Point above evolute - three roots

    float a2 = abs(sq / cp);
    float a = sqrt(a2);

    // Exact solution
    // float dacs = 2.0 * cos( acos( a ) / 3.0 );

    // Approximation with cubic
    float dacs =
        a2 * (0.01875324 * a - 0.08179158) + (0.33098754 * a + 1.7320508);

    float rsp = sqrt(abs(tp));
    float x0 = sigx * rsp * dacs;

    // Vietta's method for second root
    float dx = sigx * sqrt(-0.75 * x0 * x0 - p);
    float x1 = -0.5 * x0 - dx;

    // Third root is never the closest
    // float x2 = -0.5 * x0 + dx;

    float cx0 = clamp(x0, xlimits.x, xlimits.y);
    float cx1 = clamp(x1, xlimits.x, xlimits.y);

    vec2 ddir0 = vec2(cx0, cx0 * cx0) - ppos;
    vec2 ddir1 = vec2(cx1, cx1 * cx1) - ppos;
    float sd0 = dot(ddir0, ddir0);
    float sd1 = dot(ddir1, ddir1);

    res_x = sd0 < sd1 ? cx0 : cx1;
    res_dist = sd0 < sd1 ? sqrt(sd0) : sqrt(sd1);
  }
}

float parabolaArclen(float x) {
  float ax = abs(x);
  float sq = sqrt(4.0 * ax * ax + 1.0);
  return sign(x) * (0.25 * log(2.0 * ax + sq) + 0.5 * ax * sq);
}

float cross2d(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 xy = fragCoord.xy;

  // Quadratic Bezier control points
  vec2 p0 = vec2(0.25, 0.5) * iResolution.xy;
  vec2 p1 = iMouse.xy;
  vec2 p2 = vec2(0.75, 0.5) * iResolution.xy;
  bool winding = cross2d(p0 - p1, p2 - p1) > 0.0;

  // Parabola parameters calculation
  // Better be done on the CPU
  qbezierToParabola(p0, p1, p2);
  vec2 par_pos = worldToParabolaSpace(xy);

  float px;    // Nearest point on the parabola
  float pdist; // Distance to it
  nearestPointOnParabola(par_pos, px, pdist);

  // Arc length calculation
  float l0 = parabolaArclen(xlimits.x);
  float l1 = parabolaArclen(xlimits.y);
  float lx = parabolaArclen(px);
  float lt = clamp((lx - l0) / (l1 - l0), 0.0, 1.0);
  lt = winding ? 1.0 - lt : lt;

  // Fast and dirty variable width (incorrect near the evolute)
  float width0 = iResolution.y * 0.2;
  float width1 = width0 * 0.3;
  float width = mix(width0, width1, lt);

  float rd = pdist * pscale;
  float dgrad = rd / width;

  float alpha = clamp(width - rd, -0.5, 0.5) + 0.5;

  vec3 color = vec3(0.5, lt, dgrad);
  vec3 bg = vec3(0.3, 0.3, 0.3);

  fragColor = vec4(mix(bg, color, alpha), 1.0);
}