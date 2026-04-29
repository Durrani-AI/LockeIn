import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
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
			...(command === "build"
				? [
						cloudflare({
							viteEnvironment: { name: "ssr" },
						}),
					]
				: []),
			tanstackStart(),
			react(),
		],
		server: {
			host: "::",
			port: 8080,
		},
	};
});
