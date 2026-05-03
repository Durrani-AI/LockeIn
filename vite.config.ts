import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
	const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
	const envDefine = Object.fromEntries(
		Object.entries(loadedEnv).map(([key, value]) => [
			`import.meta.env.${key}`,
			JSON.stringify(value),
		]),
	);

	return {
		define: envDefine,
		resolve: {
			alias: {
				"@": `${process.cwd()}/src`,
			},
			dedupe: [
				"react",
				"react-dom",
				"react/jsx-runtime",
				"react/jsx-dev-runtime",
				"@tanstack/react-query",
				"@tanstack/query-core",
			],
		},
		plugins: [
			tailwindcss(),
			tsConfigPaths({ projects: ["./tsconfig.json"] }),
			tanstackStart(),
			nitro({ preset: "vercel" }),
			react(),
		],
		server: {
			host: "::",
			port: 8080,
			allowedHosts: true,
			proxy: {
				"/api/v1": {
					target: "http://127.0.0.1:8000",
					changeOrigin: true,
					secure: false,
				},
			},
		},
	};
});
