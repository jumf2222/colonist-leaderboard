// app.config.ts
import { defineConfig } from "@solidjs/start/config";
var app_config_default = defineConfig({
  server: {
    port: 25565
  },
  ssr: false
});
export {
  app_config_default as default
};
