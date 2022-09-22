import svg from '@poppanator/sveltekit-svg';
import { sveltekit } from '@sveltejs/kit/vite';
import type { PluginOption, UserConfig } from 'vite';

const config: UserConfig = {
	plugins: [sveltekit(), svg({
		includePaths: ["./src/lib/assets/"],
		svgoOptions: {
			multipass: true,
			plugins: [{
				name: "preset-default",
				// by default svgo removes the viewBox which prevents svg icons from scaling
				// not a good idea! https://github.com/svg/svgo/pull/1461
				params: { overrides: { removeViewBox: false } }
			},
				'prefixIds',
			]
			// { name: "removeAttrs", params: { attrs: "(fill|stroke)" } }],
		},
	}) as PluginOption],
	server: {
		port: 25565,
		host: true
	}
};

export default config;


