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
    path: "loop-blinn-quad",
    file: "routes/loop-blinn-quad/index.tsx",
  },
] satisfies RouteConfig;
