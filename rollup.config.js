import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import pkg from './package.json';

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.cjs.js",
      format: "cjs",
      exports: 'auto',
      sourcemap: true,
    },
    {
      file: "dist/index.umd.js",
      format: "umd",
      name: pkg.name,
      sourcemap: true,
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
