import cubicVert from "./cubic.vs?raw";
import cubicFrag from "./cubic.fs?raw";

import triangleVert from "./triangle.vs?raw";
import triangleFrag from "./triangle.fs?raw";

export const cubicShader = { vs: cubicVert, fs: cubicFrag };
export const triangleShader = { vs: triangleVert, fs: triangleFrag };
