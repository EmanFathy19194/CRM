import { cp, copyFile } from "node:fs/promises";

await copyFile("dist/public/login.js", "public/login.js");
await cp("dist/public/pages", "public/pages", { recursive: true });