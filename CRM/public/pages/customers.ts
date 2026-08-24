import { escapeHtml, renderProtectedShell, showDialog } from "./shared.js";

let searchTerm = "";
let statusFilter = "";
let pageNumber = 1;
type Customer = { id: number; firstName: string; lastName: string; email: string; phone: string; company: string; jobTitle: string; status: string; address: string; notes: string; createdAt: string; updatedAt: string };
const fields = ["firstName", "lastName", "email", "phone", "company", "jobTitle", "status", "address", "notes"];

export async function renderCustomers(page = pageNumber, search = searchTerm, status = statusFilter) {
  pageNumber = page; searchTerm = search; statusFilter = status;
  renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading customer directory...</p></div></div>`, "/customers");
  const content = document.querySelector<HTMLDivElement>("#page-content")!;
  const query = new URLSearchParams({ page: String(page), pageSize: "8", search, ...(status ? { status } : {}) });
  const response = await fetch(`/api/customers?${query}`, { credentials: "same-origin" });
  if (!response.ok) { content.innerHTML = `<div class="customer-error" role="alert"><strong>We could not load customers.</strong><button id="retry-customers" type="button">Try again</button></div>`; document.querySelector("#retry-customers")!.addEventListener("click", () => void renderCustomers()); return; }
  const result = await response.json() as { items: Customer[]; page: number; total: number; totalPages: number };
  content.innerHTML = `<div class="customer-heading"><div><span class="eyebrow">Customer directory</span><h1>Customers</h1><p class="form-intro">Keep every important relationship close.</p></div><button class="add-customer-button" id="show-customer-form"><span>+</span> Add customer</button></div><div class="customer-toolbar"><label class="search-field" for="customer-search">Search customers<input id="customer-search" type="search" value="${escapeHtml(search)}" placeholder="Name, email, phone, company" /></label><label class="status-filter" for="customer-status">Status<select id="customer-status"><option value="">All statuses</option><option value="active" ${status === "active" ? "selected" : ""}>Active</option><option value="prospect" ${status === "prospect" ? "selected" : ""}>Prospect</option><option value="inactive" ${status === "inactive" ? "selected" : ""}>Inactive</option></select></label><span class="result-count">${result.total} customer${result.total === 1 ? "" : "s"}</span></div><div id="customer-feedback" role="status"></div><form class="customer-form" id="customer-form" hidden><div class="customer-fields"><label>First name *<input name="firstName" required /></label><label>Last name *<input name="lastName" required /></label><label>Email *<input name="email" type="email" required /></label><label>Phone<input name="phone" /></label><label>Company<input name="company" /></label><label>Job title<input name="jobTitle" /></label><label>Address<input name="address" /></label><label>Status *<select name="status" required><option value="">Choose status</option><option value="active">Active</option><option value="prospect">Prospect</option><option value="inactive">Inactive</option></select></label><label class="wide-field">Profile notes<textarea name="notes"></textarea></label></div><p role="alert" id="customer-error"></p><div class="form-actions"><button class="cancel-button" id="cancel-customer-form" type="button">Cancel</button><button type="submit">Save customer</button></div></form><div class="customer-list">${result.items.length ? result.items.map((customer) => `<article class="customer-row"><div class="customer-avatar">${escapeHtml(customer.firstName[0] ?? "?")}${escapeHtml(customer.lastName[0] ?? "")}</div><div class="customer-main"><strong>${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}</strong><span>${escapeHtml(customer.email)}</span></div><span class="customer-phone">${escapeHtml(customer.phone || "-")}</span><span class="customer-company">${escapeHtml(customer.company || "-")}</span><span class="status-badge ${escapeHtml(customer.status)}">${escapeHtml(customer.status)}</span><time datetime="${escapeHtml(customer.createdAt)}">${new Date(customer.createdAt).toLocaleDateString()}</time><div class="customer-actions"><button type="button" data-action="view" data-id="${customer.id}">View</button><button type="button" data-action="edit" data-id="${customer.id}">Edit</button><button type="button" data-action="status" data-id="${customer.id}">Status</button></div></article>`).join("") : `<div class="empty-customers"><strong>No customers found.</strong><span>Try another search or add a new customer.</span></div>`}</div><div class="pagination" aria-label="Customer list pagination"><button type="button" id="previous-page" ${result.page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${result.page} of ${result.totalPages}</span><button type="button" id="next-page" ${result.page >= result.totalPages ? "disabled" : ""}>Next</button></div>`;
  document.querySelector<HTMLInputElement>("#customer-search")!.addEventListener("input", (event) => { const value = (event.target as HTMLInputElement).value; window.setTimeout(() => void renderCustomers(1, value, statusFilter), 250); });
  document.querySelector<HTMLSelectElement>("#customer-status")!.addEventListener("change", (event) => void renderCustomers(1, searchTerm, (event.target as HTMLSelectElement).value));
  document.querySelector<HTMLButtonElement>("#previous-page")!.addEventListener("click", () => void renderCustomers(result.page - 1));
  document.querySelector<HTMLButtonElement>("#next-page")!.addEventListener("click", () => void renderCustomers(result.page + 1));
  document.querySelector<HTMLButtonElement>("#show-customer-form")!.addEventListener("click", () => { const form = document.querySelector<HTMLFormElement>("#customer-form")!; form.reset(); delete form.dataset.customerId; form.hidden = false; });
  document.querySelector<HTMLButtonElement>("#cancel-customer-form")!.addEventListener("click", () => { document.querySelector<HTMLFormElement>("#customer-form")!.hidden = true; });
  document.querySelector<HTMLFormElement>("#customer-form")!.addEventListener("submit", submitCustomer);
  document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => button.addEventListener("click", () => void handleAction(button, button.dataset.action!, Number(button.dataset.id))));
}

async function handleAction(button: HTMLButtonElement, action: string, id: number) {
  if (action === "view") { history.pushState({}, "", `/customers/${id}`); const { renderCustomerDetails } = await import("./customer-details.js"); await renderCustomerDetails(id); return; }
  button.disabled = true;
  const customerResponse = await fetch(`/api/customers/${id}`, { credentials: "same-origin" });
  if (!customerResponse.ok) { button.disabled = false; return; }
  const customer = await customerResponse.json() as Customer;
  if (action === "edit") { const form = document.querySelector<HTMLFormElement>("#customer-form")!; form.hidden = false; form.dataset.customerId = String(id); for (const fieldName of fields) { const field = form.elements.namedItem(fieldName) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null; if (field) field.value = String(customer[fieldName as keyof Customer] ?? ""); } form.scrollIntoView({ behavior: "smooth", block: "start" }); button.disabled = false; return; }
  const status = await showDialog({ title: "Change customer status", message: `Choose a status for ${customer.firstName} ${customer.lastName}.`, select: [{ value: "active", label: "Active", selected: customer.status === "active" }, { value: "prospect", label: "Prospect", selected: customer.status === "prospect" }, { value: "inactive", label: "Inactive", selected: customer.status === "inactive" }], confirmLabel: "Save status" });
  if (status === null) { button.disabled = false; return; }
  const response = await fetch(`/api/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ ...customer, status }) });
  if (response.ok) await renderCustomers(pageNumber, searchTerm, statusFilter); else button.disabled = false;
}

async function submitCustomer(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const error = form.querySelector<HTMLElement>("#customer-error")!;
  button.disabled = true;
  const input = Object.fromEntries(fields.map((field) => [field, (form.elements.namedItem(field) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value]));
  const id = form.dataset.customerId;
  const response = await fetch(id ? `/api/customers/${id}` : "/api/customers", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(input) });
  const result = await response.json();
  if (!response.ok) { error.textContent = Object.values(result.errors ?? {}).join(" ") || result.error || "Unable to save customer."; button.disabled = false; return; }
  await renderCustomers(1, "", "");
  document.querySelector<HTMLElement>("#customer-feedback")!.textContent = id ? "Customer updated successfully." : "Customer added successfully.";
}
