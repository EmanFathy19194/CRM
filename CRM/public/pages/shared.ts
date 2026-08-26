export const protectedPages: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/customers": "Customers",
  "/tickets": "Tickets",
  "/communications": "Communications",
  "/contacts": "Contacts",
  "/opportunities": "Opportunities",
  "/tasks": "Tasks",
  "/activities": "Activities"
};
type UserRole = "admin" | "agent";
let currentRole: UserRole = "agent";

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}
export function showDialog(options: { title: string; message: string; input?: string; select?: { value: string; label: string; selected?: boolean }[]; confirmLabel?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "app-dialog";
    const input = options.input !== undefined ? `<textarea id="dialog-input" maxlength="500">${escapeHtml(options.input)}</textarea>` : options.select ? `<select id="dialog-input">${options.select.map((option) => `<option value="${escapeHtml(option.value)}"${option.selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>` : "";
    dialog.innerHTML = `<form method="dialog"><div class="dialog-heading"><span class="eyebrow">Northstar CRM</span><button class="dialog-close" value="cancel" aria-label="Close dialog">&times;</button></div><h2>${escapeHtml(options.title)}</h2><p>${escapeHtml(options.message)}</p>${input}<div class="dialog-actions"><button class="cancel-button" value="cancel">Cancel</button><button value="confirm">${escapeHtml(options.confirmLabel ?? "Confirm")}</button></div></form>`;
    document.body.append(dialog);
    const control = dialog.querySelector<HTMLTextAreaElement | HTMLSelectElement>("#dialog-input");
    dialog.addEventListener("close", () => { const result = dialog.returnValue === "confirm" ? control?.value ?? "confirmed" : null; dialog.remove(); resolve(result); });
    dialog.showModal();
    control?.focus();
  });
}

export function renderSidebar(currentPath: string) {
  const visiblePages = currentRole === "admin" ? protectedPages : Object.fromEntries(Object.entries(protectedPages).filter(([path]) => ["/dashboard", "/tickets", "/tasks", "/activities"].includes(path)));
  const links = Object.entries(visiblePages).map(([path, label]) => `<a class="nav-link${path === currentPath ? " active" : ""}" href="${path}"><span class="nav-dot" aria-hidden="true"></span>${label}</a>`).join("");
  return `<aside class="sidebar"><div class="sidebar-brand"><span class="brand-mark" aria-hidden="true"></span><span>Northstar CRM</span></div><div class="sidebar-label">Workspace</div><nav class="crm-nav" aria-label="CRM sections">${links}</nav><div class="sidebar-footer"><span class="signal"><i aria-hidden="true"></i><span>Workspace online</span></span><button class="logout-button" id="logout"><span>Log out</span><span aria-hidden="true">&#8594;</span></button></div></aside>`;
}

export function renderProtectedShell(content: string, currentPath: string) {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.className = "protected-shell";
  app.innerHTML = `<section class="protected-layout">${renderSidebar(currentPath)}<div class="protected-content">${content}</div></section>`;
  document.querySelectorAll<HTMLAnchorElement>(".nav-link").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault(); history.pushState({}, "", link.pathname); void route();
  }));
  document.querySelector<HTMLButtonElement>("#logout")!.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#logout")!;
    button.disabled = true;
    const response = await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    if (response.ok) { history.replaceState({}, "", "/"); await route(); }
    else button.disabled = false;
  });
}

export async function route() {
  const path = window.location.pathname;
  if (path === "/" || !protectedPages[path] && !/^\/(customers|tickets)\/\d+$/.test(path)) {
    const { renderLogin } = await import("./login.js"); renderLogin(); return;
  }
  const authResponse = await fetch("/api/me", { credentials: "same-origin" });
  if (!authResponse.ok) { history.replaceState({}, "", "/"); const { renderLogin } = await import("./login.js"); renderLogin("Please sign in to continue."); return; }
  currentRole = ((await authResponse.json()) as { user: { role: UserRole } }).user.role;
  if (/^\/customers\/\d+$/.test(path)) { const { renderCustomerDetails } = await import("./customer-details.js"); await renderCustomerDetails(Number(path.split("/")[2])); return; }
  if (/^\/tickets\/\d+$/.test(path)) { const { renderTicketDetails } = await import("./ticket-details.js"); await renderTicketDetails(Number(path.split("/")[2])); return; }
  if (path === "/customers") { const { renderCustomers } = await import("./customers.js"); await renderCustomers(); return; }
  if (path === "/tickets") { const { renderTickets } = await import("./tickets.js"); await renderTickets(); return; }
  if (path === "/communications") { const { renderCommunications } = await import("./communications.js"); await renderCommunications(); return; }
  if (path === "/tasks") { const { renderTasks } = await import("./tasks.js"); await renderTasks(); return; }
  const { renderDashboard } = await import("./dashboard.js"); await renderDashboard();
}
