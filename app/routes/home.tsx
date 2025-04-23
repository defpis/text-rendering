import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home" },
    { name: "description", content: "Welcome to Text Render!" },
  ];
}

export default function Home() {
  return (
    <>
      <div className="flex flex-col justify-center items-center min-h-screen">
        <div>
          <h1 className="text-6xl font-semibold text-black dark:text-white">
            Text Render
          </h1>
          <ul className="mt-4 ml-4 list-disc list-inside text-gray-600 dark:text-gray-400">
            <li>
              <Link to="/colored-triangle">Colored Triangle</Link>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
