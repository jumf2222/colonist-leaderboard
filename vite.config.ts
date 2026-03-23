import { defineConfig } from "vite";
import { solidStart } from "./solid-start-v2/packages/start/src/config";
import { nitroV2Plugin } from "./solid-start-v2/packages/start-nitro-v2-vite-plugin/src";

export default defineConfig({
  plugins: [solidStart({ ssr: false }), nitroV2Plugin()],
  server: {
    port: 25565,
  },
  resolve: {
    dedupe: ["solid-js", "@solidjs/web", "@solidjs/router"],
    alias: {
      "@solidjs/start": "./solid-start-v2/packages/start/src",
    },
  },
});
