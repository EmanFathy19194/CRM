import { escapeHtml, renderProtectedShell } from "./shared.js";

const typeOptions = [
  { value: "faq", label: "FAQ" },
  { value: "help", label: "Help" },
  { value: "solution", label: "Solution" },
  { value: "guide", label: "Guide" }
];

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" }
];
const categoryOptions = ["Access", "Account", "Billing", "Communication", "Support", "Technical", "Other"];

function esc(value: unknown): string {
  return escapeHtml(String(value ?? ""));
}

async function loadList(page = 1): Promise<void> {
  const search = $<HTMLInputElement>("#search")!.value.trim();
  const type = $<HTMLSelectElement>("#filter-type")!.value;
  const category = $<HTMLSelectElement>("#filter-category")!.value;
  const status = $<HTMLSelectElement>("#filter-status")!.value;
  const params = new URLSearchParams({ page: String(page), pageSize: "10", search, type, category, status });
  const response = await fetch(`/api/articles?${params}`, { credentials: "same-origin" });
  if (!response.ok) {
    $<HTMLElement>("#list-error")!.textContent = (await response.json()).error ?? "Unable to load articles.";
    return;
  }
  const body = await response.json();
  renderList(body);
}

function renderList(body: { items: Array<{ id: number; type: string; category: string; title: string; status: string; updatedAt: string }>; page: number; pageSize: number; total: number; totalPages: number }): void {
  const container = $<HTMLElement>("#list-results")!;
  if (!body.items.length) {
    container.innerHTML = "<p>No articles found.</p>";
  } else {
    container.innerHTML = body.items.map((item) => `<article class="article-row"><div><strong>${esc(item.title)}</strong><br><small>${esc(item.type)} · ${esc(item.category)} · ${esc(item.status)}</small></div><div class="article-actions"><button data-edit="${item.id}">Edit</button><button data-publish="${item.id}">${item.status === "published" ? "Unpublish" : "Publish"}</button><button data-delete="${item.id}">Delete</button></div></article>`).join("");
    container.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((button) => button.addEventListener("click", () => void edit(Number(button.dataset.edit))));
    container.querySelectorAll<HTMLButtonElement>("[data-publish]").forEach((button) => button.addEventListener("click", () => void publish(Number(button.dataset.publish), button)));
    container.querySelectorAll<HTMLButtonElement>("[data-delete]").forEach((button) => button.addEventListener("click", () => void remove(Number(button.dataset.delete))));
  }
  $<HTMLElement>("#pagination")!.innerHTML = `<span>Page ${body.page} of ${body.totalPages} (${body.total} total)</span><button ${body.page <= 1 ? "disabled" : ""} data-page="${body.page - 1}">Previous</button><button ${body.page >= body.totalPages ? "disabled" : ""} data-page="${body.page + 1}">Next</button>`;
  $<HTMLElement>("#pagination")!.querySelectorAll<HTMLButtonElement>("button[data-page]").forEach((button) => button.addEventListener("click", () => void loadList(Number(button.dataset.page))));
}

async function publish(id: number, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  const current = button.textContent === "Unpublish" ? "draft" : "published";
  const response = await fetch(`/api/articles/${id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: current === "published" ? "draft" : "published" }) });
  if (response.ok) void loadList();
  else $<HTMLElement>("#form-error")!.textContent = (await response.json()).error ?? "Unable to update article.";
  button.disabled = false;
}

async function remove(id: number): Promise<void> {
  if (!confirm("Delete this article?")) return;
  const response = await fetch(`/api/articles/${id}`, { method: "DELETE", credentials: "same-origin" });
  if (response.ok) void loadList();
  else $<HTMLElement>("#form-error")!.textContent = (await response.json()).error ?? "Unable to delete article.";
}

async function edit(id: number | null = null): Promise<void> {
  $<HTMLElement>("#form-error")!.textContent = "";
  $<HTMLElement>("#form-success")!.textContent = "";
  if (id !== null) {
    const response = await fetch(`/api/articles/${id}`, { credentials: "same-origin" });
    if (!response.ok) { $<HTMLElement>("#form-error")!.textContent = "Article not found."; return; }
    const article = await response.json();
    $<HTMLInputElement>("#article-id")!.value = String(article.id);
    $<HTMLSelectElement>("#editor-type")!.value = article.type;
    const categorySelect = $<HTMLSelectElement>("#editor-category")!;
    if (![...categorySelect.options].some((option) => option.value === article.category)) categorySelect.add(new Option(article.category, article.category));
    categorySelect.value = article.category;
    $<HTMLInputElement>("#editor-title-input")!.value = article.title;
    $<HTMLInputElement>("#editor-summary")!.value = article.summary;
    $<HTMLTextAreaElement>("#editor-body")!.value = article.body;
    $<HTMLSelectElement>("#editor-status")!.value = article.status;
    $<HTMLButtonElement>("#submit")!.textContent = "Save changes";
  } else {
    $<HTMLInputElement>("#article-id")!.value = "";
    $<HTMLSelectElement>("#editor-type")!.value = "faq";
    $<HTMLSelectElement>("#editor-category")!.value = "";
    $<HTMLInputElement>("#editor-title-input")!.value = "";
    $<HTMLInputElement>("#editor-summary")!.value = "";
    $<HTMLTextAreaElement>("#editor-body")!.value = "";
    $<HTMLSelectElement>("#editor-status")!.value = "draft";
    $<HTMLButtonElement>("#submit")!.textContent = "Create article";
  }
  $<HTMLElement>("#editor")!.removeAttribute("hidden");
  $<HTMLElement>("#editor")!.scrollIntoView({ behavior: "smooth" });
}

async function submit(event: Event): Promise<void> {
  event.preventDefault();
  const button = $<HTMLButtonElement>("#submit")!;
  button.disabled = true;
  $<HTMLElement>("#form-error")!.textContent = "";
  $<HTMLElement>("#form-success")!.textContent = "";
  const id = $<HTMLInputElement>("#article-id")!.value;
  const payload = {
    type: $<HTMLSelectElement>("#editor-type")!.value,
    category: $<HTMLSelectElement>("#editor-category")!.value,
    title: $<HTMLInputElement>("#editor-title-input")!.value.trim(),
    summary: $<HTMLInputElement>("#editor-summary")!.value.trim(),
    body: $<HTMLTextAreaElement>("#editor-body")!.value.trim(),
    status: $<HTMLSelectElement>("#editor-status")!.value
  };
  const method = id ? "PATCH" : "POST";
  const url = id ? `/api/articles/${id}` : "/api/articles";
  const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (response.ok) {
    $<HTMLElement>("#form-success")!.textContent = id ? "Article updated." : "Article created.";
    $<HTMLFormElement>("#editor-form")!.reset();
    $<HTMLInputElement>("#article-id")!.value = "";
    $<HTMLElement>("#editor")!.setAttribute("hidden", "");
    void loadList();
  } else {
    const body = await response.json();
    $<HTMLElement>("#form-error")!.textContent = body.errors ? Object.values(body.errors).join(" ") : body.error ?? "Unable to save article.";
  }
  button.disabled = false;
}

function $<T extends Element>(selector: string): T {
  return document.querySelector<T>(selector)!;
}

export async function renderKnowledgeBase(): Promise<void> {
  renderProtectedShell(`<div class="knowledge-base-admin"><div class="content-header"><h1>Knowledge Base</h1><button id="create" class="add-customer-button"><span>+</span> New article</button></div><div class="customer-toolbar"><div class="search-field"><input id="search" placeholder="Search articles…" /><select id="filter-type"><option value="">All types</option>${typeOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></div><div class="status-filter"><input id="filter-category" placeholder="Category" /><select id="filter-status"><option value="">All statuses</option>${statusOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></div></div><div id="list-error" role="alert" class="form-error"></div><div id="list-results" aria-live="polite">Loading…</div><div id="pagination" class="pagination"></div><div id="editor" hidden class="article-form"><h2 id="editor-title">New article</h2><form id="editor-form"><input type="hidden" id="article-id" /><div class="article-fields"><label>Type <select id="editor-type">${typeOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label><label>Category <input id="editor-category" maxlength="100" required /></label><label>Title <input id="editor-title-input" maxlength="200" required /></label><label>Status <select id="editor-status">${statusOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label></div><label>Summary <textarea id="editor-summary" maxlength="500" required></textarea></label><label>Body <textarea id="editor-body" maxlength="10000" required></textarea></label><div id="form-error" role="alert"></div><div id="form-success" class="form-success"></div><button type="submit" id="submit">Create article</button><button type="button" id="cancel">Cancel</button></form></div></div>`, "/admin/knowledge-base");
  const categoryFilter = $<HTMLInputElement>("#filter-category");
  const categorySelect = document.createElement("select");
  categorySelect.id = "filter-category";
  categorySelect.innerHTML = `<option value="">All categories</option>${categoryOptions.map((category) => `<option value="${category}">${category}</option>`).join("")}`;
  categoryFilter.replaceWith(categorySelect);
  const editorCategory = $<HTMLInputElement>("#editor-category");
  const editorSelect = document.createElement("select");
  editorSelect.id = "editor-category";
  editorSelect.required = true;
  editorSelect.innerHTML = `<option value="">Choose category</option>${categoryOptions.map((category) => `<option value="${category}">${category}</option>`).join("")}`;
  editorCategory.replaceWith(editorSelect);
  $<HTMLButtonElement>("#create")!.addEventListener("click", () => void edit());
  $<HTMLFormElement>("#editor-form")!.addEventListener("submit", submit);
  $<HTMLButtonElement>("#cancel")!.addEventListener("click", () => { $<HTMLElement>("#editor")!.setAttribute("hidden", ""); });
  $<HTMLInputElement>("#search")?.addEventListener("input", () => void loadList(1));
  $<HTMLSelectElement>("#filter-type")?.addEventListener("change", () => void loadList(1));
  $<HTMLSelectElement>("#filter-category")?.addEventListener("change", () => void loadList(1));
  $<HTMLSelectElement>("#filter-status")?.addEventListener("change", () => void loadList(1));
  await loadList();
}
