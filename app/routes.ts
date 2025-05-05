import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  {
    path: "colored-triangle",
    file: "routes/colored-triangle/index.tsx",
  },
  {
    path: "colored-cube",
    file: "routes/colored-cube/index.tsx",
  },
  {
    path: "path-triangulation",
    file: "routes/path-triangulation/index.tsx",
  },
  {
    path: "loop-blinn-quad-test",
    file: "routes/loop-blinn-quad-test/index.tsx",
  },
  {
    path: "loop-blinn-quad",
    file: "routes/loop-blinn-quad/index.tsx",
  },
  {
    path: "loop-blinn-cubic-test",
    file: "routes/loop-blinn-cubic-test/index.tsx",
  },
  {
    path: "loop-blinn-cubic",
    file: "routes/loop-blinn-cubic/index.tsx",
  },
  {
    path: "loop-blinn-cjk-test",
    file: "routes/loop-blinn-cjk-test/index.tsx",
  },
] satisfies RouteConfig;
