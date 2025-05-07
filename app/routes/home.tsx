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
              <Link to="/colored-triangle">Colored Triangle</Link>
            </li>
            <li>
              <Link to="/colored-cube">Colored Cube</Link>
            </li>
            <li>
              <Link to="/path-triangulation">Path Triangulation</Link>
            </li>
            <li>
              <Link to="/loop-blinn-quad-test">Loop-Blinn Quadratic Test</Link>
            </li>
            <li>
              <Link to="/loop-blinn-quad">Loop-Blinn Quadratic</Link>
            </li>
            <li>
              <Link to="/loop-blinn-cubic-test">Loop-Blinn Cubic Test</Link>
            </li>
            <li>
              <Link to="/loop-blinn-cubic">Loop-Blinn Cubic</Link>
            </li>
            <li>
              <Link to="/loop-blinn-cjk-test">Loop-Blinn CJK Test</Link>
            </li>
            <li>
              <Link to="/perfect-antialiasing">Perfect Antialiasing</Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
