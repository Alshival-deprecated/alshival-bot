import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
if (!process.argv[2]) throw new Error("Usage: node portal/build.mjs OUTPUT.js");
await build({
  absWorkingDir: fileURLToPath(new URL("../", import.meta.url)),
  entryPoints: ["portal/entry.tsx"],
  outfile: resolve(process.argv[2]),
  bundle: true, minify: true, platform: "browser", format: "iife", target: "es2020",
  jsx: "automatic", loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "linked",
});
