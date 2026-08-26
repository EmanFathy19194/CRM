import { route } from "./shared.js";

export function renderLogin(message = "") {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.className = "login-shell";
  app.innerHTML = `<section class="brand-panel"><div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>Northstar CRM</span></div><div class="brand-copy"><span class="eyebrow">Your work, in focus</span><h2>Make every relationship count.</h2><p>A calmer way to keep your customer universe moving forward.</p></div><div class="signal"><i aria-hidden="true"></i><span>Workspace online</span></div></section><section class="form-panel"><div class="form-wrap"><h1>Welcome back</h1><p class="form-intro">Sign in to pick up where you left off.</p><form id="login-form" novalidate><label for="email">Email address</label><input id="email" name="email" type="email" autocomplete="username" placeholder="you@company.com" required /><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required /><p role="alert" id="error">${message}</p><button type="submit"><span>Log in</span><span aria-hidden="true">&#8594;</span></button></form><div class="divider">or</div><button id="customer-portal" class="secondary" type="button"><span>Login as Customer</span></button><p class="fine-print">Private workspace · Secure sign in</p></div></section>`;
  document.querySelector("#customer-portal")?.remove();
  document.querySelector(".divider")?.remove();
  document.querySelector<HTMLFormElement>("#login-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form).entries()) as { email?: string; password?: string };
    if (!data.email?.trim()) return renderLogin("Email is required.");
    if (!data.password) return renderLogin("Password is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return renderLogin("Enter a valid email address.");
    const button = form.querySelector<HTMLButtonElement>("button")!; button.disabled = true; button.textContent = "Signing in...";
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(data) });
    if (!response.ok) return renderLogin((await response.json()).error ?? "Unable to sign in.");
    const result = await response.json() as { user: { role: string } };
    if (result.user.role === "customer") { window.location.assign("/portal"); return; }
    history.pushState({}, "", "/dashboard"); await route();
  });
}
