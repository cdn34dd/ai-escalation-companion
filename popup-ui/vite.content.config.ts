import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    outDir: "./dist",
    emptyOutDir: false, // don't delete popup build
    lib: {
      entry: resolve(__dirname, "src/content.ts"),
      name: "content",
      formats: ["iife"], // classic script, no import/export
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        // Ensure everything ends up in this one file
        inlineDynamicImports: true,
      },
    },
  },
});
