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
function esc(value) {
    return escapeHtml(String(value ?? ""));
}
async function loadList(page = 1) {
    const search = $("#search").value.trim();
    const type = $("#filter-type").value;
    const category = $("#filter-category").value;
    const status = $("#filter-status").value;
    const params = new URLSearchParams({ page: String(page), pageSize: "10", search, type, category, status });
    const response = await fetch(`/api/articles?${params}`, { credentials: "same-origin" });
    if (!response.ok) {
        $("#list-error").textContent = (await response.json()).error ?? "Unable to load articles.";
        return;
    }
    const body = await response.json();
    renderList(body);
}
function renderList(body) {
    const container = $("#list-results");
    if (!body.items.length) {
        container.innerHTML = "<p>No articles found.</p>";
    }
    else {
        container.innerHTML = body.items.map((item) => `<article class="article-row"><div><strong>${esc(item.title)}</strong><br><small>${esc(item.type)} · ${esc(item.category)} · ${esc(item.status)}</small></div><div class="article-actions"><button data-edit="${item.id}">Edit</button><button data-publish="${item.id}">${item.status === "published" ? "Unpublish" : "Publish"}</button><button data-delete="${item.id}">Delete</button></div></article>`).join("");
        container.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => void edit(Number(button.dataset.edit))));
        container.querySelectorAll("[data-publish]").forEach((button) => button.addEventListener("click", () => void publish(Number(button.dataset.publish), button)));
        container.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => void remove(Number(button.dataset.delete))));
    }
    $("#pagination").innerHTML = `<span>Page ${body.page} of ${body.totalPages} (${body.total} total)</span><button ${body.page <= 1 ? "disabled" : ""} data-page="${body.page - 1}">Previous</button><button ${body.page >= body.totalPages ? "disabled" : ""} data-page="${body.page + 1}">Next</button>`;
    $("#pagination").querySelectorAll("button[data-page]").forEach((button) => button.addEventListener("click", () => void loadList(Number(button.dataset.page))));
}
async function publish(id, button) {
    button.disabled = true;
    const current = button.textContent === "Unpublish" ? "draft" : "published";
    const response = await fetch(`/api/articles/${id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: current === "published" ? "draft" : "published" }) });
    if (response.ok)
        void loadList();
    else
        $("#form-error").textContent = (await response.json()).error ?? "Unable to update article.";
    button.disabled = false;
}
async function remove(id) {
    if (!confirm("Delete this article?"))
        return;
    const response = await fetch(`/api/articles/${id}`, { method: "DELETE", credentials: "same-origin" });
    if (response.ok)
        void loadList();
    else
        $("#form-error").textContent = (await response.json()).error ?? "Unable to delete article.";
}
async function edit(id = null) {
    $("#form-error").textContent = "";
    $("#form-success").textContent = "";
    if (id !== null) {
        const response = await fetch(`/api/articles/${id}`, { credentials: "same-origin" });
        if (!response.ok) {
            $("#form-error").textContent = "Article not found.";
            return;
        }
        const article = await response.json();
        $("#article-id").value = String(article.id);
        $("#editor-type").value = article.type;
        const categorySelect = $("#editor-category");
        if (![...categorySelect.options].some((option) => option.value === article.category))
            categorySelect.add(new Option(article.category, article.category));
        categorySelect.value = article.category;
        $("#editor-title-input").value = article.title;
        $("#editor-summary").value = article.summary;
        $("#editor-body").value = article.body;
        $("#editor-status").value = article.status;
        $("#submit").textContent = "Save changes";
    }
    else {
        $("#article-id").value = "";
        $("#editor-type").value = "faq";
        $("#editor-category").value = "";
        $("#editor-title-input").value = "";
        $("#editor-summary").value = "";
        $("#editor-body").value = "";
        $("#editor-status").value = "draft";
        $("#submit").textContent = "Create article";
    }
    $("#editor").removeAttribute("hidden");
    $("#editor").scrollIntoView({ behavior: "smooth" });
}
async function submit(event) {
    event.preventDefault();
    const button = $("#submit");
    button.disabled = true;
    $("#form-error").textContent = "";
    $("#form-success").textContent = "";
    const id = $("#article-id").value;
    const payload = {
        type: $("#editor-type").value,
        category: $("#editor-category").value,
        title: $("#editor-title-input").value.trim(),
        summary: $("#editor-summary").value.trim(),
        body: $("#editor-body").value.trim(),
        status: $("#editor-status").value
    };
    const method = id ? "PATCH" : "POST";
    const url = id ? `/api/articles/${id}` : "/api/articles";
    const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.ok) {
        $("#form-success").textContent = id ? "Article updated." : "Article created.";
        $("#editor-form").reset();
        $("#article-id").value = "";
        $("#editor").setAttribute("hidden", "");
        void loadList();
    }
    else {
        const body = await response.json();
        $("#form-error").textContent = body.errors ? Object.values(body.errors).join(" ") : body.error ?? "Unable to save article.";
    }
    button.disabled = false;
}
function $(selector) {
    return document.querySelector(selector);
}
export async function renderKnowledgeBase() {
    renderProtectedShell(`<div class="knowledge-base-admin"><div class="content-header"><h1>Knowledge Base</h1><button id="create" class="add-customer-button"><span>+</span> New article</button></div><div class="customer-toolbar"><div class="search-field"><input id="search" placeholder="Search articles…" /><select id="filter-type"><option value="">All types</option>${typeOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></div><div class="status-filter"><input id="filter-category" placeholder="Category" /><select id="filter-status"><option value="">All statuses</option>${statusOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></div></div><div id="list-error" role="alert" class="form-error"></div><div id="list-results" aria-live="polite">Loading…</div><div id="pagination" class="pagination"></div><div id="editor" hidden class="article-form"><h2 id="editor-title">New article</h2><form id="editor-form"><input type="hidden" id="article-id" /><div class="article-fields"><label>Type <select id="editor-type">${typeOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label><label>Category <input id="editor-category" maxlength="100" required /></label><label>Title <input id="editor-title-input" maxlength="200" required /></label><label>Status <select id="editor-status">${statusOptions.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}</select></label></div><label>Summary <textarea id="editor-summary" maxlength="500" required></textarea></label><label>Body <textarea id="editor-body" maxlength="10000" required></textarea></label><div id="form-error" role="alert"></div><div id="form-success" class="form-success"></div><button type="submit" id="submit">Create article</button><button type="button" id="cancel">Cancel</button></form></div></div>`, "/admin/knowledge-base");
    const categoryFilter = $("#filter-category");
    const categorySelect = document.createElement("select");
    categorySelect.id = "filter-category";
    categorySelect.innerHTML = `<option value="">All categories</option>${categoryOptions.map((category) => `<option value="${category}">${category}</option>`).join("")}`;
    categoryFilter.replaceWith(categorySelect);
    const editorCategory = $("#editor-category");
    const editorSelect = document.createElement("select");
    editorSelect.id = "editor-category";
    editorSelect.required = true;
    editorSelect.innerHTML = `<option value="">Choose category</option>${categoryOptions.map((category) => `<option value="${category}">${category}</option>`).join("")}`;
    editorCategory.replaceWith(editorSelect);
    $("#create").addEventListener("click", () => void edit());
    $("#editor-form").addEventListener("submit", submit);
    $("#cancel").addEventListener("click", () => { $("#editor").setAttribute("hidden", ""); });
    $("#search")?.addEventListener("input", () => void loadList(1));
    $("#filter-type")?.addEventListener("change", () => void loadList(1));
    $("#filter-category")?.addEventListener("change", () => void loadList(1));
    $("#filter-status")?.addEventListener("change", () => void loadList(1));
    await loadList();
}
