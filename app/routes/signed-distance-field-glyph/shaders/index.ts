import sdfVert from "./sdf.vs?raw";
import sdfFrag from "./sdf.fs?raw";
import postVert from "./post.vs?raw";
import postFrag from "./post.fs?raw";
import basicVert from "./basic.vs?raw";
import basicFrag from "./basic.fs?raw";

export const sdfShader = { vs: sdfVert, fs: sdfFrag };
export const postShader = { vs: postVert, fs: postFrag };
export const basicShader = { vs: basicVert, fs: basicFrag };
