const form = document.querySelector<HTMLFormElement>("#request-form")!;
const feedback = document.querySelector<HTMLElement>("#feedback")!;
const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  feedback.classList.remove("success");
  try {
    const response = await fetch("/api/public/web-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
    const body = await response.json().catch(() => ({}));
    if (response.ok && typeof body.ticketNumber === "string") {
      feedback.textContent = `Your support reference is "${body.ticketNumber}".`;
      feedback.classList.add("success");
      form.reset();
    } else {
      const errors = Object.values(body.errors ?? {}).join(" ");
      feedback.textContent = escapeHtml(errors || body.error || "Unable to submit request.");
    }
  } catch {
    feedback.textContent = "Unable to submit request.";
  } finally {
    button.disabled = false;
  }
});
