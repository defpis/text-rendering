import { type RouteConfig, index } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  {
    path: "colored-triangle",
    file: "routes/colored-triangle/index.tsx",
  },
] satisfies RouteConfig;
