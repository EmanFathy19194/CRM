import { escapeHtml, renderProtectedShell } from "./shared.js";
const value = (input) => escapeHtml(String(input ?? ""));
const api = (url, init) => fetch(url, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
const conditions = (item) => `${value(item.priority ?? "Any priority")} · ${value(item.category ?? "Any category")}`;
export async function renderAutomation() {
    renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading automation...</p></div></div>`, "/automation");
    const content = document.querySelector("#page-content"), [slaResponse, ruleResponse] = await Promise.all([api("/api/sla-rules"), api("/api/automation-rules")]);
    if (!slaResponse.ok || !ruleResponse.ok) {
        content.innerHTML = "<div class=\"customer-error\"><strong>Administrator access is required.</strong></div>";
        return;
    }
    const slas = await slaResponse.json(), rules = await ruleResponse.json();
    content.innerHTML = `<div class="customer-heading"><div><span class="eyebrow">Administration</span><h1>Automation</h1><p class="form-intro">Configure ticket targets and automatic actions.</p></div></div><section class="related-section rule-section"><span class="eyebrow">SLA rules</span><form id="sla-form" class="rule-form"><label>Priority<select name="priority"><option value="">Any priority</option><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></label><label>Category<input name="category" maxlength="100" placeholder="Any category" /></label><label>Response minutes *<input name="responseTargetMinutes" type="number" min="1" required /></label><label>Resolution minutes *<input name="resolutionTargetMinutes" type="number" min="1" required /></label><p id="sla-error" role="alert"></p><button type="submit">Add SLA rule</button></form><div class="rule-table">${slas.length ? slas.map(item => `<article><strong>${conditions(item)}</strong><small>Response ${item.responseTargetMinutes} min · Resolution ${item.resolutionTargetMinutes} min</small><button data-sla-delete="${item.id}" type="button">Delete</button></article>`).join("") : "<p>No SLA rules configured.</p>"}</div></section><section class="related-section rule-section"><span class="eyebrow">Automation rules</span><form id="automation-form" class="rule-form"><label>Priority<select name="priority"><option value="">Any priority</option><option>low</option><option>medium</option><option>high</option><option>urgent</option></select></label><label>Category<input name="category" maxlength="100" placeholder="Any category" /></label><label>Action<select name="action" id="automation-action"><option value="assign">Assign</option><option value="escalate">Escalate</option></select></label><label id="assignee-field">Assign to email *<input name="assignedAgent" type="email" required /></label><p id="automation-error" role="alert"></p><button type="submit">Add automation rule</button></form><div class="rule-table">${rules.length ? rules.map(item => `<article><strong>${value(item.action)} · ${conditions(item)}</strong><small>${value(item.assignedAgent ?? "Escalate matching ticket")}</small><button data-rule-delete="${item.id}" type="button">Delete</button></article>`).join("") : "<p>No automation rules configured.</p>"}</div></section>`;
    const categoryValues = ["Access", "Account", "Billing", "Communication", "Support", "Technical", "Other"];
    content.querySelectorAll('input[name="category"]').forEach((input) => {
        const select = document.createElement("select");
        select.name = "category";
        select.innerHTML = `<option value="">Any category</option>${categoryValues.map((category) => `<option value="${value(category)}">${value(category)}</option>`).join("")}`;
        input.replaceWith(select);
    });
    const submit = (selector, url, errorSelector) => content.querySelector(selector).addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button"), error = content.querySelector(errorSelector); button.disabled = true; error.textContent = ""; const response = await api(url, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }); if (response.ok)
        return void renderAutomation(); const body = await response.json().catch(() => ({})); error.textContent = Object.values(body.errors ?? {}).join(" ") || body.error || "Unable to save rule."; button.disabled = false; });
    submit("#sla-form", "/api/sla-rules", "#sla-error");
    submit("#automation-form", "/api/automation-rules", "#automation-error");
    const action = content.querySelector("#automation-action"), assignee = content.querySelector("#assignee-field"), assigneeInput = assignee.querySelector("input");
    action.addEventListener("change", () => { const assigning = action.value === "assign"; assignee.hidden = !assigning; assigneeInput.required = assigning; if (!assigning)
        assigneeInput.value = ""; });
    const remove = (selector, url, key) => content.querySelectorAll(selector).forEach(button => button.addEventListener("click", async () => { if (!window.confirm("Delete this rule? Existing ticket deadlines will remain unchanged."))
        return; button.disabled = true; if ((await api(url(button.dataset[key] ?? ""), { method: "DELETE" })).ok)
        void renderAutomation();
    else
        button.disabled = false; }));
    remove("[data-sla-delete]", id => `/api/sla-rules/${id}`, "slaDelete");
    remove("[data-rule-delete]", id => `/api/automation-rules/${id}`, "ruleDelete");
}
