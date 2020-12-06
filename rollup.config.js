import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";

export default {
  input: "./dist/index.js",
  output: [
    {
      format: "cjs",
      exports: "auto",
      file: "dist/index.cjs.js",
      sourcemap: true,
    },
    {
      format: "umd",
      file: "dist/index.umd.js",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({
      browser: true,
    }),
    commonjs(),
    terser(),
  ],
};
