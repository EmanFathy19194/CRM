import { route } from "./pages/shared.js";
void route();
window.addEventListener("popstate", () => void route());
