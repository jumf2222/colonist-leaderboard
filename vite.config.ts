import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import { defineConfig } from "vite-plus";

export default defineConfig({
    staged: {
        "*": "vp check --fix",
    },
    fmt: {
        tabWidth: 4,
    },
    lint: { options: { typeAware: true, typeCheck: true } },
    plugins: [solidStart({ ssr: false }), nitro()],
    server: {
        port: 25565,
    },
});
