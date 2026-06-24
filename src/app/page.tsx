"use client";

import dynamic from "next/dynamic";

// Load the Firebase-backed UI client-only. Firebase's SDK calls `new Function`
// at module-eval time, which the Cloudflare Workers runtime forbids — so this
// subtree must never be rendered (or imported) during SSR.
const AppShell = dynamic(() => import("./app-shell"), {
	ssr: false,
	loading: () => (
		<main className="min-h-screen grid place-items-center font-sans text-sm text-gray-500">
			Cargando…
		</main>
	),
});

export default function Home() {
	return <AppShell />;
}
