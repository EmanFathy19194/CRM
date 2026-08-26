import { escapeHtml, renderProtectedShell, route } from "./shared.js";
const value = (input) => escapeHtml(String(input ?? ""));
const date = (input) => input ? value(new Date(input).toLocaleString()) : "No due date";
const api = (url, init) => fetch(url, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
export async function renderDashboard() {
    renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading dashboard...</p></div></div>`, "/dashboard");
    const content = document.querySelector("#page-content"), response = await api("/api/dashboard");
    if (!response.ok) {
        content.innerHTML = `<div class="customer-error"><strong>We could not load your dashboard.</strong></div>`;
        return;
    }
    const data = await response.json();
    const ticketLink = (ticket) => `<article><a href="/tickets/${ticket.id}"><strong>${value(ticket.ticketNumber)} · ${value(ticket.subject)}</strong></a><small>${value(ticket.customerName)} · ${value(ticket.customerEmail)}</small></article>`;
    content.innerHTML = `<div class="customer-heading"><div><span class="eyebrow">Agent workspace</span><h1>Dashboard</h1><p class="form-intro">Your ticket work, SLA alerts, reminders, and recent activity.</p></div></div><section class="dashboard-metrics">${[["Assigned", data.counts.assigned], ["Open", data.counts.open], ["Pending", data.counts.pending], ["Urgent", data.counts.urgent]].map(([label, count]) => `<article><strong>${count}</strong><span>${label} tickets</span></article>`).join("")}</section><div class="dashboard-grid"><section class="related-section notifications"><span class="eyebrow">SLA alerts</span>${data.notifications.length ? data.notifications.map(item => `<article><a href="/tickets/${item.ticketId}"><strong>${value(item.message)}</strong></a><small>${date(item.createdAt)}</small><button data-notification-dismiss="${item.id}" type="button">Dismiss</button></article>`).join("") : "<p>No active SLA alerts.</p>"}</section><section class="related-section"><span class="eyebrow">Assigned tickets</span>${data.assignedTickets.length ? data.assignedTickets.map(ticketLink).join("") : "<p>No tickets are assigned to you.</p>"}</section><section class="related-section"><span class="eyebrow">Reminders</span><form id="reminder-form"><input name="message" maxlength="500" required placeholder="Reminder" /><input name="remindAt" type="datetime-local" required /><button type="submit">Add reminder</button></form>${data.reminders.length ? data.reminders.map(item => `<article><strong>${value(item.message)}</strong><small>${date(item.remindAt)}</small><button data-reminder-dismiss="${item.id}" type="button">Dismiss</button><button data-reminder-delete="${item.id}" type="button">Delete</button></article>`).join("") : "<p>No active reminders.</p>"}</section><section class="related-section"><span class="eyebrow">Recent activity</span>${data.recentActivity.length ? data.recentActivity.map(item => `<article><strong>${value(item.kind.replaceAll("_", " "))}</strong><p>${value(item.detail)}</p><small>${date(item.createdAt)}${item.ticketId ? ` · <a href="/tickets/${item.ticketId}">View ticket</a>` : ""}</small></article>`).join("") : "<p>No recent activity.</p>"}</section></div>`;
    const refresh = () => void renderDashboard();
    content.querySelectorAll("a[href^='/tickets/']").forEach(link => link.addEventListener("click", event => { event.preventDefault(); history.pushState({}, "", link.pathname); void route(); }));
    content.querySelector("#reminder-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button"); button.disabled = true; if ((await api("/api/reminders", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) })).ok)
        refresh();
    else
        button.disabled = false; });
    const mutate = (selector, url, method) => content.querySelectorAll(selector).forEach(button => button.addEventListener("click", async () => { button.disabled = true; if ((await api(url(button), { method })).ok)
        refresh();
    else
        button.disabled = false; }));
    mutate("[data-reminder-dismiss]", button => `/api/reminders/${button.dataset.reminderDismiss}/dismiss`, "POST");
    mutate("[data-reminder-delete]", button => `/api/reminders/${button.dataset.reminderDelete}`, "DELETE");
    mutate("[data-notification-dismiss]", button => `/api/notifications/${button.dataset.notificationDismiss}/dismiss`, "POST");
}
