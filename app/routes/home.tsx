import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home" },
    { name: "description", content: "Welcome to Text Rendering!" },
  ];
}

export default function Home() {
  return (
    <>
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div>
          <h1 className="text-6xl font-semibold text-black dark:text-white">
            Text Rendering
          </h1>
          <ul className="mt-4 ml-4 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>
              <Link to="/colored-triangle">Colored triangle</Link>
            </li>
            <li>
              <Link to="/colored-cube">Colored cube</Link>
            </li>
            <li>
              <Link to="/path-triangulation">Path triangulation</Link>
            </li>
            <li>
              <Link to="/loop-blinn-quad-test">Loop-blinn quadratic test</Link>
            </li>
            <li>
              <Link to="/loop-blinn-quad">Loop-blinn quadratic</Link>
            </li>
            <li>
              <Link to="/loop-blinn-cubic-test">Loop-blinn cubic test</Link>
            </li>
            <li>
              <Link to="/loop-blinn-cubic">Loop-blinn cubic</Link>
            </li>
            <li>
              <Link to="/loop-blinn-cjk-test">Loop-blinn CJK test</Link>
            </li>
            <li>
              <Link to="/perfect-antialiasing">Perfect antialiasing</Link>
            </li>
            <li>
              <Link to="/loop-blinn-perfect-antialiasing">
                Loop-blinn + perfect antialiasing
              </Link>
            </li>
            <li>
              <Link to="/loop-blinn-triangle-fan-msaa-smaa">
                Loop-blinn + triangle fan + MSAA + SMAA
              </Link>
            </li>
            <li>
              <Link to="/gpu-text-rendering-with-vector-textures">
                GPU text rendering with vector textures
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
