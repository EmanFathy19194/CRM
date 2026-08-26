import { cp, copyFile } from "node:fs/promises";

await copyFile("dist/public/login.js", "public/login.js");
await copyFile("dist/public/support-request.js", "public/support-request.js");
await copyFile("dist/public/knowledge-base.js", "public/knowledge-base.js");
await copyFile("dist/public/portal.js", "public/portal.js");
await cp("dist/public/pages", "public/pages", { recursive: true });
