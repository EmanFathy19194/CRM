const root = document.querySelector("#results");
const searchInput = document.querySelector("#search");
const typeSelect = document.querySelector("#type");
const categorySelect = document.querySelector("#category");
const categories = ["Access", "Account", "Billing", "Communication", "Support", "Technical", "Other"];
categorySelect.innerHTML += categories.map((category) => `<option value="${category}">${category}</option>`).join("");
function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
function syncQueryParams() {
    const params = new URLSearchParams();
    const search = searchInput.value.trim();
    const type = typeSelect.value;
    const category = categorySelect.value;
    if (search)
        params.set("search", search);
    if (type)
        params.set("type", type);
    if (category)
        params.set("category", category);
    const match = location.pathname.match(/^\/knowledge-base\/(\d+)$/);
    if (match)
        params.set("article", match[1]);
    return params;
}
function updateUrl(params) {
    const query = params.toString();
    const path = query ? `/knowledge-base?${query}` : "/knowledge-base";
    history.replaceState({}, "", path);
}
async function load() {
    const params = syncQueryParams();
    const query = params.toString();
    const path = query ? `/api/public/articles?${query}` : "/api/public/articles";
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) {
        root.innerHTML = `<p>Unable to load articles.</p>`;
        return;
    }
    const body = await response.json();
    if (body.items.length) {
        root.innerHTML = body.items.map((a) => `<article><small>${esc(a.type)} · ${esc(a.category)}</small><h2><a href="/knowledge-base/${a.id}">${esc(a.title)}</a></h2><p>${esc(a.summary)}</p></article>`).join("");
    }
    else {
        root.innerHTML = `<p>No published articles found.</p>`;
    }
}
let debounceTimer;
async function detail() {
    const match = location.pathname.match(/^\/knowledge-base\/(\d+)$/);
    if (!match)
        return void load();
    const response = await fetch(`/api/public/articles/${match[1]}`, { credentials: "same-origin" });
    if (!response.ok) {
        root.innerHTML = `<p>Article not found.</p>`;
        return;
    }
    const a = await response.json();
    if (a.status !== "published") {
        root.innerHTML = `<p>Article not found.</p>`;
        return;
    }
    root.innerHTML = `<p><a href="/knowledge-base">← All articles</a></p><article><small>${esc(a.type)} · ${esc(a.category)}</small><h1>${esc(a.title)}</h1><p>${esc(a.summary)}</p><div>${esc(a.body).replace(/\n/g, "<br>")}</div></article>`;
}
function onFilterChange() {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
        const params = syncQueryParams();
        params.delete("article");
        updateUrl(params);
        void load();
    }, 300);
}
document.querySelector("#go").addEventListener("click", () => { const params = syncQueryParams(); params.delete("article"); updateUrl(params); void load(); });
searchInput.addEventListener("input", onFilterChange);
typeSelect.addEventListener("change", onFilterChange);
categorySelect.addEventListener("change", onFilterChange);
window.addEventListener("popstate", () => { void detail(); });
void detail();
export {};
