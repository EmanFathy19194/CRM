import { escapeHtml, renderProtectedShell, route } from "./shared.js";
const statuses = ["new", "open", "in_progress", "pending", "resolved", "closed"], priorities = ["low", "medium", "high", "urgent"];
const value = (input) => escapeHtml(String(input ?? "Not provided"));
const selectOptions = (items, selected) => items.map((item) => `<option value="${item}"${item === selected ? " selected" : ""}>${value(item.replace("_", " "))}</option>`).join("");
export async function renderTicketDetails(id) {
    renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading ticket...</p></div></div>`, window.location.pathname);
    const content = document.querySelector("#page-content"), [ticketResponse, historyResponse] = await Promise.all([fetch(`/api/tickets/${id}`, { credentials: "same-origin" }), fetch(`/api/tickets/${id}/history`, { credentials: "same-origin" })]);
    if (!ticketResponse.ok) {
        content.innerHTML = `<div class="customer-error"><strong>Ticket not found.</strong><button id="back-tickets" type="button">Back to tickets</button></div>`;
        document.querySelector("#back-tickets").addEventListener("click", () => { history.pushState({}, "", "/tickets"); void route(); });
        return;
    }
    const ticket = await ticketResponse.json(), historyRows = historyResponse.ok ? await historyResponse.json() : [];
    const communicationsResponse = await fetch(`/api/tickets/${id}/communications`, { credentials: "same-origin" });
    const communications = communicationsResponse.ok ? await communicationsResponse.json() : [];
    const communicationRows = communications.length ? communications.map((item) => `<article><strong>${value(item.channel)}</strong><p>${value(item.message)}</p><small>${value(new Date(item.receivedAt).toLocaleString())}</small></article>`).join("") : "<p>No communications yet.</p>";
    content.innerHTML = `<button type="button" class="back-link" id="back-tickets">Back to tickets</button><div class="detail-heading"><div><span class="eyebrow">${value(ticket.ticketNumber)}</span><h1>${value(ticket.subject)}</h1><p class="form-intro">${value(ticket.customerName)} — ${value(ticket.customerEmail)}</p></div><span class="ticket-badge ${value(ticket.priority)}">${value(ticket.priority)}</span></div><div id="ticket-feedback" role="status"></div><form class="ticket-form" id="ticket-edit-form"><div class="customer-fields"><label>Customer<input value="${value(ticket.customerName)}" disabled /></label><label>Subject *<input name="subject" maxlength="200" value="${value(ticket.subject)}" required /></label><label>Category *<input name="category" maxlength="100" value="${value(ticket.category)}" required /></label><label>Priority *<select name="priority">${selectOptions(priorities, ticket.priority)}</select></label><label>Assigned agent *<input name="assignedAgent" maxlength="200" value="${value(ticket.assignedAgent)}" required /></label><label>Status *<select name="status">${selectOptions(statuses, ticket.status)}</select></label><label>Due date<input name="dueDate" type="date" value="${value(ticket.dueDate ?? "")}" /></label><label class="wide-field">Description *<textarea name="description" maxlength="2000" required>${value(ticket.description)}</textarea></label></div><p role="alert" id="ticket-error"></p><div class="form-actions"><button type="submit">Save changes</button><button type="button" class="cancel-button" id="escalate-ticket" ${ticket.isEscalated ? "disabled" : ""}>${ticket.isEscalated ? "Escalated" : "Escalate"}</button></div></form><section class="ticket-history"><span class="eyebrow">History</span>${historyRows.length ? historyRows.map((entry) => `<article><strong>${value(entry.action.replaceAll("_", " "))}</strong><span>${entry.oldValue !== null || entry.newValue !== null ? `${value(entry.oldValue)} → ${value(entry.newValue)}` : "Ticket updated"}</span><small>${value(entry.changedBy)} · ${value(new Date(entry.createdAt).toLocaleString())}</small></article>`).join("") : "<p>No history yet.</p>"}</section><section class="ticket-history"><span class="eyebrow">Communications</span>${communicationRows}</section>`;
    document.querySelector("#back-tickets").addEventListener("click", () => { history.pushState({}, "", "/tickets"); void route(); });
    document.querySelector("#ticket-edit-form").addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button[type=submit]"), error = form.querySelector("#ticket-error"); button.disabled = true; const response = await fetch(`/api/tickets/${id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(new FormData(form).entries()), customerId: ticket.customerId }) }); const body = await response.json(); if (!response.ok) {
        error.textContent = Object.values(body.errors ?? {}).join(" ") || body.error || "Unable to update ticket.";
        button.disabled = false;
        return;
    } await renderTicketDetails(id); });
    document.querySelector("#escalate-ticket").addEventListener("click", async (event) => { const button = event.currentTarget; button.disabled = true; const response = await fetch(`/api/tickets/${id}/escalate`, { method: "POST", credentials: "same-origin" }); if (response.ok)
        await renderTicketDetails(id);
    else {
        button.disabled = false;
        document.querySelector("#ticket-error").textContent = "Unable to escalate ticket.";
    } });
}
