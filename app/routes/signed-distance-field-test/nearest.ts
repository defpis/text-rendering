// 1. https://astiopin.github.io/2019/01/04/qbez-parabola.html
// 2. https://www.shadertoy.com/view/tdsGDj

import { mat3, vec3 } from "gl-matrix";
import {
  add,
  dot,
  len,
  lerp2,
  multiply,
  normalize,
  rotate,
  sub,
  type Point,
  type Curve,
} from "./utils";
import { clamp } from "lodash-es";

export function qBezierToParabola(curve: Curve) {
  const { p0, p1, p2 } = curve;

  const c02 = lerp2(p0, p2, 0.5);

  const v01 = sub(p1, p0);
  const v02 = sub(p2, p0);
  const v10 = sub(p0, p1);
  const v12 = sub(p2, p1);

  const cosAngle = dot(normalize(v10), normalize(v12));
  const threshold = 1.0 - 1e-6; // 视为共线的阈值

  let xLimits: [number, number]; // y = x^2 坐标系的 x 轴范围

  let xAxis: Point; // x 轴
  let yAxis: Point; // y 轴

  let scale: number; // 缩放因子
  let translate: Point; // 坐标系原点平移量

  // 仿射变换重新建立 y = x^2 坐标系
  if (cosAngle >= threshold || cosAngle <= -threshold) {
    // 三点共线 cos(theta) 接近 1 或 -1
    xAxis = normalize(v02); // x 轴为 p0 到 p2 的单位向量
    yAxis = rotate(xAxis, Math.PI / 2); // y 轴为 x 轴的逆时针旋转 90 度

    const xRange = 1e-3; // y = x^2 坐标系的 x 轴范围
    xLimits = [-xRange, xRange];

    const l02 = len(v02); // 对应 xLimit 区间的实际长度
    scale = l02 / 2 / xRange; // 缩放因子

    const yOffset = l02 * Math.pow(xRange, 2); // y 轴偏移量需要与 l02 线性相关以保证极其扁平
    translate = add(c02, multiply(yAxis, yOffset)); // 坐标系原点为线段中点沿着 y 轴偏移
  } else {
    // 三点不共线，如文档 1 中图所示
    yAxis = normalize(sub(c02, p1)); // 以 p1 到 p0-p2 中点的向量为 y 轴
    xAxis = rotate(yAxis, -Math.PI / 2); // x 轴为 y 轴的顺时针旋转 90 度

    // tan(α0) = v01 * yAxis / v01 * xAxis
    // tan(α1) = v12 * yAxis / v12 * xAxis

    // x 范围为 [x0, x1]
    const x0 = (dot(v01, yAxis) / dot(v01, xAxis)) * 0.5;
    const x1 = (dot(v12, yAxis) / dot(v12, xAxis)) * 0.5;

    // p0-p2 在 x 轴上的投影长度除以 x 范围即为缩放因子
    scale = dot(v02, xAxis) / (x1 - x0); // s

    // x0 在 y = x^2 坐标系中的坐标为 (x0, x0^2)
    // 原点 + s * (x0, x0^2) = p0
    // 原点 = p0 - s * (x0, x0^2)
    // 原点 = p0 - x0 * s * xAxis - x0^2 * s * yAxis
    translate = sub(
      p0,
      multiply(xAxis, x0 * scale),
      multiply(yAxis, Math.pow(x0, 2) * scale),
    );
    xLimits = x0 < x1 ? [x0, x1] : [x1, x0];
  }

  // 从 y = x^2 坐标系转换到原始坐标系
  // prettier-ignore
  const matrix = mat3.fromValues(
    xAxis.x * scale, xAxis.y * scale, 0,
    yAxis.x * scale, yAxis.y * scale, 0,
        translate.x,     translate.y, 1,
  );

  // 从原始坐标系转换到 y = x^2 坐标系
  // const inverseMatrix = mat3.create();
  // mat3.invert(inverseMatrix, matrix);

  return { matrix, scale, xLimits };
}

export function convertSpace(point: Point, matrix: mat3): Point {
  const p = vec3.fromValues(point.x, point.y, 1);
  vec3.transformMat3(p, p, matrix);
  return { x: p[0] / p[2], y: p[1] / p[2] };
}

export function nearestOnParabola(point: Point, xLimits: [number, number]) {
  // 对于曲线外 S 点和曲线上 P 点，有距离函数：
  // d(x) = |P(x) - S|² = (x - S_x)^2 + (x² - S_y)^2
  // d'(x) = 2(x - S_x) * 1 + 2(x² - S_y) * 2x = 2(x - S_x) + 4x(x² - S_y)
  // 令 d'(x) = 0，有 (x - S_x) + 2x(x² - S_y) = 0
  // 展开有 x³ + (1/2 - S_y)x - (1/2)S_x = 0
  // 对应 x^3 + p*x + q = 0
  // p = 1/2 - S_y
  // q = -1/2 * S_x

  const p = 0.5 - point.y;
  const q = -0.5 * point.x;

  // 判别式 d = q/2 * q/2 + p/3 * p/3 * p/3
  const d = Math.pow(q / 2, 2) + Math.pow(p / 3, 3);

  // 卡丹公式
  // α = cbrt(-q/2 + sqrt(d))
  // β = cbrt(-q/2 - sqrt(d))
  // t = α * β = -p/3
  // x = α + β

  const t = -p / 3;
  const s = -Math.sign(q);

  if (d >= 0) {
    // 位于抛物线的渐屈线外部，有一个实根和两个复根

    // q > 0 => β = -1 * cbrt(|q|/2 + sqrt(d)) => -1 * cbrt(-q/2 - sqrt(d)) => -1 * β
    // q < 0 => b = +1 * cbrt(|q|/2 + sqrt(d)) => +1 * cbrt(-q/2 + sqrt(d)) => +1 * α
    // s = q > 0 ? -1 : 1

    const a = Math.cbrt(Math.abs(q) / 2 + Math.sqrt(d));
    const x = s * (a + t / a);
    const cx = clamp(x, xLimits[0], xLimits[1]);
    const nearest = { x: cx, y: Math.pow(cx, 2) }; // 曲线上最近点
    const distance = len(sub(nearest, point)); // 最近距离
    return { nearest, distance };
  } else {
    // 位于抛物线的渐屈线内部，有三个​​不同的实根​

    // x^3 + p*x + q = 0 令 x = k cos(φ)
    // k³cos³(φ) + pk cos(φ) + q = 0
    // 同除以 k³ (假设 k ≠ 0 ) 得 cos³(φ) + (p/k²)cos(φ) + (q/k³) = 0
    // 将三倍角公式 cos(3φ) = 4cos³(φ) - 3cos(φ) 移位
    // 得到 cos³(φ) - (3/4)cos(φ) - (1/4)cos(3φ) = 0
    // 比较系数：p/k² = -3/4 ｜ q/k³ = -(1/4)cos(3φ)
    // 联立：cos(3φ) = (-q/2) / sqrt(-(p/3)³)
    // 整理：cos(3φ) = sqrt(abs(27 * (q/2)^2 / (4 * (p/3)^3)))
    const cos3a = Math.sqrt(
      Math.abs((27 * Math.pow(q, 2)) / (4 * Math.pow(p, 3))),
    );

    // 三角法求根公式
    // φ = acos(cos(3φ)) / 3.0
    const a = Math.acos(cos3a) / 3.0;
    // xk = 2.0 * sqrt(t) * cos(φ + 120°k); k = 0, 1, 2; φ = acos(cos(3φ)) / 3.0
    const x0 = s * 2.0 * Math.sqrt(t) * Math.cos(a);

    // 韦达定理
    // x^3 + p*x + q = 0
    // => 1. x0 + x1 + x2 = 0（二次项系数）
    //    2. x0x1 + x0x2 + x1x2 = p
    // 令 x2 = -x0 - x1 代入 2 中得
    // x0x1 + x0(-x0 - x1) + (-x0 - x1)(-x0 - x1) = p
    // x1^2 + x0x1 + (x0^2 + p) = 0 使用二次方程求根公式
    // ax^2 + bx + c = 0
    // a = 1 ｜ b = x0 ｜ c = x0^2 + p
    // dx = b^2 - 4ac = x0^2 - 4 * (x0^2 + p) = -3 * x0^2 - 4 * p

    const sd = s * Math.sqrt(-3 * Math.pow(x0, 2) - 4 * p); // 乘以 s 保证获得更接近 x0 的解
    const x1 = (-x0 - sd) / 2;
    // const x2 = (-x0 + sd) / 2;

    const cx0 = clamp(x0, xLimits[0], xLimits[1]);
    const cx1 = clamp(x1, xLimits[0], xLimits[1]);

    const p0 = { x: cx0, y: Math.pow(cx0, 2) };
    const p1 = { x: cx1, y: Math.pow(cx1, 2) };

    const v0 = sub(p0, point);
    const v1 = sub(p1, point);

    const s0 = dot(v0, v0);
    const s1 = dot(v1, v1);

    const nearest = s0 < s1 ? p0 : p1;
    const distance = Math.sqrt(Math.min(s0, s1));

    return { nearest, distance };
  }
}
