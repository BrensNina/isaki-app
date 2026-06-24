// Removes the .open-next build output before an OpenNext build.
// On Windows the directory is often still locked by a lingering workerd/file
// handle, which makes OpenNext's own rmSync fail with EPERM. Cleaning it in a
// separate step (with retries) before the build sidesteps that.
import { rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".open-next");

if (!existsSync(target)) process.exit(0);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

for (let attempt = 1; attempt <= 5; attempt++) {
	try {
		rmSync(target, { recursive: true, force: true });
		if (!existsSync(target)) process.exit(0);
	} catch (err) {
		if (attempt === 5) {
			console.error(`Could not remove .open-next after ${attempt} attempts.`);
			console.error("Close any running 'npm run preview' (workerd) process and retry.");
			throw err;
		}
	}
	sleep(500);
}
