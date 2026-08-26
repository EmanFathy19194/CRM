const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
function showLogin() {
    $("#workspace").setAttribute("hidden", "");
    $("#login-shell").removeAttribute("hidden");
}
function showWorkspace() {
    $("#login-shell").setAttribute("hidden", "");
    $("#workspace").removeAttribute("hidden");
}
async function loadTickets() {
    const response = await fetch("/api/public/portal/tickets", { credentials: "same-origin" });
    if (!response.ok) {
        showLogin();
        return;
    }
    const rows = await response.json();
    showWorkspace();
    if (!rows.length) {
        $("#tickets").innerHTML = "<p>No requests found.</p>";
        return;
    }
    $("#tickets").innerHTML = rows.map((t) => `<article style="padding: 16px; border: 1px solid #ffffff12; border-radius: 11px; background: #172239; margin-bottom: 12px;"><strong>${esc(t.ticketNumber)}</strong> — ${esc(t.subject)}<div style="color: #9ba9bf; font-size: .9rem; margin-top: 6px;">${esc(t.status)} · Updated ${esc(t.updatedAt)}</div><button data-ticket="${esc(t.ticketNumber)}" style="width: auto; margin-top: 10px; padding: 8px 12px; color: #c5d0df; border: 1px solid #536178; background: transparent; box-shadow: none; font-size: .8rem;">View history</button></article>`).join("");
    document.querySelectorAll("[data-ticket]").forEach((button) => {
        button.addEventListener("click", () => {
            const ticket = button.dataset.ticket;
            history.pushState({ ticket }, "", `/portal?ticket=${encodeURIComponent(ticket)}`);
            void loadDetail(ticket);
        });
    });
}
async function loadDetail(ticket) {
    const ticketResponse = await fetch(`/api/public/portal/tickets/${encodeURIComponent(ticket)}`, { credentials: "same-origin" });
    if (!ticketResponse.ok) {
        $("#detail").innerHTML = `<p style="color: #ff9b8a;">Ticket not found.</p>`;
        return;
    }
    const ticketData = await ticketResponse.json();
    const historyResponse = await fetch(`/api/public/portal/tickets/${encodeURIComponent(ticket)}/history`, { credentials: "same-origin" });
    if (!historyResponse.ok) {
        $("#detail").innerHTML = `<p style="color: #ff9b8a;">Unable to load history.</p>`;
        return;
    }
    const history = await historyResponse.json();
    $("#detail").innerHTML = `<article style="padding: 16px; border: 1px solid #ffffff12; border-radius: 11px; background: #172239; margin-top: 18px;"><h2 style="margin: 0 0 10px; font-family: 'Space Grotesk', sans-serif; font-size: 1.4rem; letter-spacing: -.03em;">${esc(ticket)} — ${esc(ticketData.subject)}</h2><p style="color: #9ba9bf; font-size: .9rem; margin: 0 0 18px;">Status: ${esc(ticketData.status)} · Category: ${esc(ticketData.category)} · Created: ${esc(ticketData.createdAt)}${ticketData.dueDate ? ` · Due: ${esc(ticketData.dueDate)}` : ""}${ticketData.isEscalated ? " · Escalated" : ""}</p><div style="padding: 16px; border: 1px solid #ffffff12; border-radius: 12px; background: #101827cc;"><h3 style="margin: 0 0 12px; font-size: 1rem; color: #dbe5f2;">History</h3>${history.map((h) => `<div style="padding: 10px 0; border-top: 1px solid #ffffff12;"><div style="color: #c5d0df;">${esc(h.label)}</div><small style="color: #718198;">${esc(h.createdAt)}</small></div>`).join("")}</div><form id="feedback" style="margin-top: 18px; display: grid; gap: 10px; max-width: 520px;"><label style="margin: 18px 0 8px; color: #dbe5f2; font-size: .86rem; font-weight: 600;">Rating (1–5) <input name="rating" type="number" min="1" max="5" required style="width: 100%; padding: 14px 15px; color: #f7f8f2; border: 1px solid #536178; border-radius: 10px; outline: none; background: #1b263b; font: inherit;" /></label><textarea name="message" maxlength="2000" placeholder="Your feedback" required style="width: 100%; padding: 14px 15px; color: #f7f8f2; border: 1px solid #536178; border-radius: 10px; outline: none; background: #1b263b; font: inherit; min-height: 120px; resize: vertical;"></textarea><button type="submit" style="width: 100%; margin-top: 24px; padding: 14px 15px; color: #202337; border: 0; border-radius: 10px; background: #f4d35e; cursor: pointer; font: inherit; font-weight: 700;">Submit feedback</button><p id="feedback" role="alert" style="min-height: 22px; margin: 14px 0 0; color: #ff9b8a; font-size: .86rem;"></p></form></article>`;
    const feedbackForm = $("#feedback");
    feedbackForm.onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const result = await fetch(`/api/public/portal/tickets/${encodeURIComponent(ticket)}/feedback`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        const message = result.ok ? "Thank you for your feedback." : (await result.json()).error ?? "Unable to submit feedback.";
        const output = $("#feedback");
        output.textContent = message;
        output.style.color = result.ok ? "#a7f3d0" : "#ff9b8a";
        if (result.ok)
            form.reset();
    };
}
$("#customer-login").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch("/api/public/customer-login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
    if (!response.ok) {
        $("#login-error").textContent = (await response.json()).error ?? "Unable to sign in.";
        return;
    }
    const params = new URLSearchParams(location.search);
    const ticket = params.get("ticket");
    if (ticket) {
        history.replaceState({}, "", "/portal");
        await loadDetail(ticket.toUpperCase());
    }
    else {
        void loadTickets();
    }
});
/* Ticket verification is intentionally not part of the password-based customer workspace. */
/*
 $<HTMLFormElement>("#verify-form").addEventListener("submit", async (event: Event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const response = await fetch("/api/public/portal-sessions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
  if (!response.ok) {
    $<HTMLElement>("#verify-error")!.textContent = (await response.json()).error ?? "Unable to verify portal access.";
    return;
  }
  const params = new URLSearchParams(location.search);
  const ticket = params.get("ticket");
  if (ticket) {
    history.replaceState({}, "", "/portal");
    await loadDetail(ticket.toUpperCase());
  } else {
    void loadTickets();
  }
}); */
$("#logout").addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    window.location.assign("/");
});
$("#list-tickets")?.addEventListener("click", () => {
    history.pushState({}, "", "/portal");
    $("#detail").innerHTML = "";
    void loadTickets();
});
window.addEventListener("popstate", async () => {
    const params = new URLSearchParams(location.search);
    const ticket = params.get("ticket");
    if (ticket)
        await loadDetail(ticket.toUpperCase());
    else {
        $("#detail").innerHTML = "";
        void loadTickets();
    }
});
void (async () => {
    const meResponse = await fetch("/api/me", { credentials: "same-origin" });
    if (meResponse.ok) {
        const params = new URLSearchParams(location.search);
        const ticket = params.get("ticket");
        if (ticket)
            await loadDetail(ticket.toUpperCase());
        else
            void loadTickets();
    }
    else {
        showLogin();
    }
})();
export {};
