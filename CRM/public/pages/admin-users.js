import { escapeHtml, renderProtectedShell, showDialog } from "./shared.js";
export async function renderAdminUsers() {
    renderProtectedShell("", "/admin/users");
    const content = document.querySelector(".protected-content");
    content.innerHTML = `<div class="content-header"><h1>Users</h1><button id="create-user" class="add-customer-button"><span>+</span> New user</button></div><div id="user-error" role="alert"></div><div id="user-list" class="user-list">Loading…</div><dialog id="user-dialog" class="app-dialog"><form method="dialog" id="user-dialog-form"><div class="dialog-heading"><span class="eyebrow">Northstar CRM</span><button class="dialog-close" value="cancel" aria-label="Close">&times;</button></div><h2 id="dialog-title">New user</h2><p id="dialog-message" class="form-intro"></p><div class="user-form-grid"><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Role<select name="role"><option value="admin">Admin</option><option value="manager">Manager</option><option value="agent">Agent</option><option value="customer">Customer</option></select></label><label>Password<input name="password" type="password" /></label></div><p id="dialog-error" role="alert"></p><div class="dialog-actions"><button class="cancel-button" value="cancel">Cancel</button><button value="confirm" id="dialog-confirm">Create user</button></div></form></dialog>`;
    const dialog = content.querySelector("#user-dialog");
    const form = content.querySelector("#user-dialog-form");
    const title = content.querySelector("#dialog-title");
    const confirmBtn = content.querySelector("#dialog-confirm");
    const messageEl = content.querySelector("#dialog-message");
    const errorEl = content.querySelector("#dialog-error");
    let editingId = null;
    async function load() {
        const response = await fetch("/api/admin/users", { credentials: "same-origin" });
        if (!response.ok) {
            content.querySelector("#user-list").innerHTML = "<p>Unable to load users.</p>";
            return;
        }
        const data = await response.json();
        const list = content.querySelector("#user-list");
        if (!data.items.length) {
            list.innerHTML = "<p>No users found.</p>";
            return;
        }
        list.innerHTML = data.items.map((u) => `<article class="user-row"><div><strong>${escapeHtml(u.name)}</strong><span>${escapeHtml(u.email)}</span><small>${escapeHtml(u.role)} · ${u.isActive ? "Active" : "Inactive"} · ${new Date(u.createdAt).toLocaleDateString()}</small></div><div class="user-actions"><button data-view="${u.id}">View</button><button data-edit="${u.id}">Edit</button><button data-delete="${u.id}" class="danger">Delete</button></div></article>`).join("");
        list.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => void view(Number(btn.dataset.view))));
        list.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => void edit(Number(btn.dataset.edit))));
        list.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => void remove(Number(btn.dataset.delete))));
    }
    async function view(id) {
        const response = await fetch(`/api/admin/users/${id}`, { credentials: "same-origin" });
        if (!response.ok) {
            alert("User not found.");
            return;
        }
        const user = await response.json();
        const result = await showDialog({ title: user.name, message: `${user.email}\nRole: ${user.role}\nStatus: ${user.isActive ? "Active" : "Inactive"}\nPassword: ********\nCreated: ${new Date(user.createdAt).toLocaleString()}\nUpdated: ${new Date(user.updatedAt).toLocaleString()}${user.deactivatedAt ? "\nDeactivated: " + new Date(user.deactivatedAt).toLocaleString() : ""}`, confirmLabel: "Close" });
        if (result === "confirmed")
            dialog.close();
    }
    async function edit(id = null) {
        editingId = id;
        errorEl.textContent = "";
        if (id !== null) {
            const response = await fetch(`/api/admin/users/${id}`, { credentials: "same-origin" });
            if (!response.ok) {
                errorEl.textContent = "User not found.";
                return;
            }
            const user = await response.json();
            title.textContent = "Edit user";
            confirmBtn.textContent = "Save changes";
            messageEl.textContent = `Editing ${user.name}`;
            form.querySelector("input[name=name]").value = user.name;
            form.querySelector("input[name=email]").value = user.email;
            form.querySelector("select[name=role]").value = user.role;
            form.querySelector("input[name=password]").value = "";
            form.querySelector("input[name=password]").placeholder = "Leave blank to keep current password";
        }
        else {
            editingId = null;
            title.textContent = "New user";
            confirmBtn.textContent = "Create user";
            messageEl.textContent = "";
            form.reset();
            form.querySelector("input[name=password]").placeholder = "";
        }
        dialog.showModal();
    }
    async function remove(id) {
        const confirmed = await showDialog({ title: "Delete user", message: "This action cannot be undone. Are you sure you want to delete this user?", confirmLabel: "Delete" });
        if (confirmed !== "confirmed")
            return;
        const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "same-origin" });
        if (response.ok)
            void load();
        else
            alert("Unable to delete user.");
    }
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            name: String(formData.get("name") ?? ""),
            email: String(formData.get("email") ?? ""),
            role: String(formData.get("role") ?? "agent"),
            password: String(formData.get("password") ?? "")
        };
        const method = editingId ? "PATCH" : "POST";
        const url = editingId ? `/api/admin/users/${editingId}` : "/api/admin/users";
        const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (response.ok) {
            dialog.close();
            void load();
        }
        else {
            const body = await response.json();
            errorEl.textContent = body.errors ? Object.values(body.errors).join(" ") : body.error ?? "Unable to save user.";
        }
    });
    dialog.addEventListener("close", () => { editingId = null; errorEl.textContent = ""; });
    content.querySelector("#create-user").addEventListener("click", () => void edit(null));
    await load();
}
