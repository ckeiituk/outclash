import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import monacoEditorPlugin, {
  type IMonacoEditorOpts,
} from "vite-plugin-monaco-editor";
const monacoEditorPluginDefault = (monacoEditorPlugin as any).default as (
  options: IMonacoEditorOpts,
) => any;

const LOW_MEM_BUILD = process.env.LOW_MEM_BUILD === "1";
const DEBUG_BUNDLE = process.env.DEBUG_BUNDLE === "1";

export default defineConfig({
  root: "src",
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    hmr: {
      host: "127.0.0.1",
      port: 3000,
      protocol: "ws",
    },
  },
  plugins: [
    svgr(),
    react(),
    tailwindcss(),
    legacy({
      renderLegacyChunks: false,
      modernTargets: ["edge>=109", "safari>=13"],
      modernPolyfills: true,
      additionalModernPolyfills: [
        "core-js/modules/es.object.has-own.js",
        "core-js/modules/web.structured-clone.js",
        path.resolve("./src/polyfills/matchMedia.js"),
        path.resolve("./src/polyfills/WeakRef.js"),
        path.resolve("./src/polyfills/RegExp.js"),
      ],
    }),
    monacoEditorPluginDefault({
      languageWorkers: ["editorWorkerService", "typescript", "css"],
      customWorkers: [
        {
          label: "yaml",
          entry: "monaco-yaml/yaml.worker",
        },
      ],
      globalAPI: false,
    }),
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2020",
    // Allow switching to a lighter minifier to reduce peak memory usage
    minify: LOW_MEM_BUILD ? "esbuild" : "terser",
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
    sourcemap: DEBUG_BUNDLE,
    cssCodeSplit: true,
    cssMinify: true,
    rollupOptions: {
      treeshake: {
        preset: "recommended",
        moduleSideEffects: (id) => !/\.css$/.test(id),
        tryCatchDeoptimization: false,
      },
      output: {
        compact: true,
        // In low-memory mode, avoid large chunk merging to reduce memory pressure
        ...(LOW_MEM_BUILD ? {} : { experimentalMinChunkSize: 30000 }),
        dynamicImportInCjs: true,
        manualChunks(id) {
          if (LOW_MEM_BUILD) return undefined; // skip custom chunking in low‑mem mode
          if (!id.includes("node_modules")) return undefined;
          // Keep only a dedicated chunk for monaco-editor (heavy, isolated)
          if (id.includes("monaco-editor")) return "monaco-editor";
          // Defer all other vendor chunking to Rollup defaults to avoid order issues
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve("./src"),
      "@root": path.resolve("."),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
  define: {
    OS_PLATFORM: `"${process.platform}"`,
  },
});
