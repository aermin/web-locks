import { terser } from "rollup-plugin-terser";

import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

import pkg from "./package.json";

export default {
  input: "src/index.ts",
  output: [
    {
      file: pkg.main,
      format: "cjs",
      exports: "auto",
      // sourcemap: true,
    },
    { file: pkg.module, format: "es" },
    {
      file: pkg.browser,
      format: "umd",
      name: pkg.name,
      // sourcemap: true,
    },
  ],
  plugins: [
    commonjs(),
    typescript({ module: "ESNext" }),
    resolve({
      browser: true,
    }),
    json(),
    terser(),
  ],
};
