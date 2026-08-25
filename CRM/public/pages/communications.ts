import { escapeHtml, renderProtectedShell } from "./shared.js";

type Channel = { type: string; displayName: string; isEnabled: boolean };
type Customer = { id: number; firstName: string; lastName: string; email: string };
type Communication = { id: number; customerId: number; ticketId: number | null; channel: string; message: string; sourceReference: string | null; receivedAt: string };

export async function renderCommunications() {
  renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading communications...</p></div></div>`, "/communications");
  const content = document.querySelector<HTMLDivElement>("#page-content")!;
  const [channelsResponse, customersResponse, communicationsResponse] = await Promise.all([
    fetch("/api/communication-channels", { credentials: "same-origin" }),
    fetch("/api/customers?pageSize=50", { credentials: "same-origin" }),
    fetch("/api/communications", { credentials: "same-origin" })
  ]);
  if (!channelsResponse.ok) { content.innerHTML = `<div class="customer-error"><strong>We could not load communication channels.</strong></div>`; return; }
  const channels = await channelsResponse.json() as Channel[];
  const customers = customersResponse.ok ? (await customersResponse.json() as { items: Customer[] }).items : [];
  let communications = communicationsResponse.ok ? await communicationsResponse.json() as Communication[] : [];
  const customerName = (id: number) => { const customer = customers.find((item) => item.id === id); return customer ? `${customer.firstName} ${customer.lastName}` : `Customer #${id}`; };

  content.innerHTML = `
    <div class="customer-heading"><div><span class="eyebrow">Support workspace</span><h1>Communications</h1><p class="form-intro">Configure channels and record incoming customer messages.</p></div></div>
    <section class="channel-grid" aria-label="Communication channels">
      ${channels.map((channel) => `<article class="channel-card"><div><strong>${escapeHtml(channel.displayName)}</strong><small>${escapeHtml(channel.type)}</small></div><button data-channel="${escapeHtml(channel.type)}" data-enabled="${channel.isEnabled}" type="button">${channel.isEnabled ? "Disable" : "Enable"}</button></article>`).join("")}
    </section>
    <form class="ticket-form" id="communication-form">
      <div class="customer-fields">
        <label>Customer *<select name="customerId" required><option value="">Choose customer</option>${customers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)} — ${escapeHtml(customer.email)}</option>`).join("")}</select></label>
        <label>Channel *<select name="channel" required><option value="">Choose channel</option>${channels.filter((channel) => channel.isEnabled && channel.type !== "web_form").map((channel) => `<option value="${escapeHtml(channel.type)}">${escapeHtml(channel.displayName)}</option>`).join("")}</select></label>
        <label>Ticket id <input name="ticketId" type="number" min="1" placeholder="Optional existing ticket id" /></label>
        <label>Source reference <input name="sourceReference" maxlength="200" placeholder="Optional reference" /></label>
        <label class="wide-field">Incoming message *<textarea name="message" maxlength="2000" required></textarea></label>
      </div>
      <p id="communication-error" role="alert"></p>
      <div class="form-actions"><button type="submit">Record communication</button></div>
    </form>
    <div class="ticket-filters" aria-label="Communication filters">
      <label>Customer filter<select id="filter-customer"><option value="">All customers</option>${customers.map((customer) => `<option value="${customer.id}">${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}</option>`).join("")}</select></label>
      <label>Channel filter<select id="filter-channel"><option value="">All channels</option>${channels.map((channel) => `<option value="${escapeHtml(channel.type)}">${escapeHtml(channel.displayName)}</option>`).join("")}</select></label>
    </div>
    <div class="communication-list" id="communication-list"></div>`;

  const list = document.querySelector<HTMLDivElement>("#communication-list")!;
  const renderList = () => {
    const customerId = Number((document.querySelector<HTMLSelectElement>("#filter-customer")!).value);
    const channel = (document.querySelector<HTMLSelectElement>("#filter-channel")!).value;
    const rows = communications.filter((item) => (!customerId || item.customerId === customerId) && (!channel || item.channel === channel));
    list.innerHTML = rows.length ? rows.map((item) => `
      <article class="communication-row">
        <header><strong>${escapeHtml(customerName(item.customerId))}</strong><time>${escapeHtml(new Date(item.receivedAt).toLocaleString())}</time></header>
        <small>${escapeHtml(item.channel)}${item.ticketId !== null ? ` · <a href="/tickets/${item.ticketId}">#${item.ticketId}</a>` : ""}${item.sourceReference ? ` · ref ${escapeHtml(item.sourceReference)}` : ""}</small>
        <p>${escapeHtml(item.message)}</p>
      </article>`).join("") : `<div class="empty-customers"><strong>No communications yet.</strong><span>Recorded incoming messages will appear here.</span></div>`;
    list.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); history.pushState({}, "", link.getAttribute("href")); void import("./shared.js").then((shared) => shared.route()); }));
  };
  renderList();
  document.querySelector<HTMLSelectElement>("#filter-customer")!.addEventListener("change", renderList);
  document.querySelector<HTMLSelectElement>("#filter-channel")!.addEventListener("change", renderList);

  document.querySelectorAll<HTMLButtonElement>("[data-channel]").forEach((button) => button.addEventListener("click", async () => {
    button.disabled = true;
    const response = await fetch(`/api/communication-channels/${button.dataset.channel}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: button.dataset.enabled !== "true" }) });
    if (response.ok) await renderCommunications(); else button.disabled = false;
  }));

  document.querySelector<HTMLFormElement>("#communication-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement, button = form.querySelector<HTMLButtonElement>("button[type=submit]")!, error = form.querySelector<HTMLElement>("#communication-error")!;
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (!payload.ticketId) delete payload.ticketId;
    const response = await fetch("/api/communications", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { error.textContent = Object.values(body.errors ?? {}).join(" ") || body.error || "Unable to record communication."; button.disabled = false; return; }
    form.reset(); error.textContent = "Communication recorded."; button.disabled = false;
    const refreshed = await fetch("/api/communications", { credentials: "same-origin" });
    if (refreshed.ok) { communications = await refreshed.json() as Communication[]; renderList(); }
  });
}
