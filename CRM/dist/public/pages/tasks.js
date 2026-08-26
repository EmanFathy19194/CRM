import { escapeHtml, renderProtectedShell, showDialog } from "./shared.js";
const value = (input) => escapeHtml(String(input ?? ""));
const date = (input) => input ? value(new Date(input).toLocaleString()) : "No due date";
async function api(url, init) { return fetch(url, { credentials: "same-origin", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } }); }
export async function renderTasks() {
    renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading tasks...</p></div></div>`, "/tasks");
    const content = document.querySelector("#page-content");
    const response = await api("/api/tasks");
    if (!response.ok) {
        content.innerHTML = `<div class="customer-error"><strong>We could not load your tasks.</strong></div>`;
        return;
    }
    const tasks = await response.json();
    content.innerHTML = `<div class="customer-heading"><div><span class="eyebrow">Agent workspace</span><h1>Tasks</h1><p class="form-intro">Create and manage your private work items.</p></div></div><section class="related-section"><form id="task-form"><label>Title<input name="title" maxlength="200" required placeholder="Task title" /></label><label>Details<textarea name="details" maxlength="2000" placeholder="Optional details"></textarea></label><label>Due date<input name="dueAt" type="datetime-local" /></label><p id="task-error" role="alert"></p><button type="submit">Add task</button></form></section><section class="related-section"><span class="eyebrow">Your tasks</span><div>${tasks.length ? tasks.map(task => `<article class="${task.isCompleted ? "is-complete" : ""}"><strong>${value(task.title)}</strong><small>${date(task.dueAt)}</small>${task.details ? `<p>${value(task.details)}</p>` : ""}<button data-task-edit="${task.id}" type="button">Edit</button><button data-task-complete="${task.id}" type="button" ${task.isCompleted ? "disabled" : ""}>${task.isCompleted ? "Completed" : "Complete"}</button><button data-task-delete="${task.id}" type="button">Delete</button></article>`).join("") : "<p>No tasks yet.</p>"}</div></section>`;
    const refresh = () => void renderTasks();
    const form = content.querySelector("#task-form");
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button"), error = form.querySelector("#task-error");
        button.disabled = true;
        error.textContent = "";
        const result = await api("/api/tasks", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        if (result.ok)
            refresh();
        else {
            const body = await result.json().catch(() => ({}));
            error.textContent = Object.values(body.errors ?? {}).join(" ") || body.error || "Unable to add task.";
            button.disabled = false;
        }
    });
    const mutate = (selector, url, method) => content.querySelectorAll(selector).forEach(button => button.addEventListener("click", async () => { button.disabled = true; if ((await api(url(button), { method })).ok)
        refresh();
    else
        button.disabled = false; }));
    mutate("[data-task-complete]", button => `/api/tasks/${button.dataset.taskComplete}/complete`, "POST");
    mutate("[data-task-delete]", button => `/api/tasks/${button.dataset.taskDelete}`, "DELETE");
    content.querySelectorAll("[data-task-edit]").forEach(button => button.addEventListener("click", async () => {
        const task = tasks.find(item => item.id === Number(button.dataset.taskEdit));
        if (!task)
            return;
        const title = await showDialog({ title: "Edit task", message: "Update the task title.", input: task.title, confirmLabel: "Save task" });
        if (title === null)
            return;
        button.disabled = true;
        if ((await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ title, details: task.details ?? "", dueAt: task.dueAt ?? "" }) })).ok)
            refresh();
        else
            button.disabled = false;
    }));
}
