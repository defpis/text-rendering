import curveVert from "./curve.vs?raw";
import curveFrag from "./curve.fs?raw";

import triangleVert from "./triangle.vs?raw";
import triangleFrag from "./triangle.fs?raw";

import postVert from "./post.vs?raw";
import postFrag from "./post.fs?raw";

export const curveShader = { vs: curveVert, fs: curveFrag };
export const triangleShader = { vs: triangleVert, fs: triangleFrag };
export const postShader = { vs: postVert, fs: postFrag };
