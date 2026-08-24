import { renderProtectedShell } from "./shared.js";
export function renderDashboard(title) {
    renderProtectedShell(`<div class="content-header"><span class="eyebrow">Workspace online</span><span class="route-chip">Protected area</span></div><h1>${title}</h1><p class="form-intro">This protected CRM area is ready for business data.</p>`, window.location.pathname);
}
