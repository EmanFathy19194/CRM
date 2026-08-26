import { escapeHtml, renderProtectedShell, route } from "./shared.js";

type Ticket = { id:number; ticketNumber:string; subject:string; customerName:string; customerEmail:string };
type Reminder = { id:number; message:string; remindAt:string };
type Activity = { id:number; kind:string; detail:string; ticketId:number|null; createdAt:string };
type Dashboard = { assignedTickets:Ticket[]; counts:{assigned:number;open:number;pending:number;urgent:number}; reminders:Reminder[]; recentActivity:Activity[] };
const value = (input:unknown) => escapeHtml(String(input ?? ""));
const date = (input:string|null) => input ? value(new Date(input).toLocaleString()) : "No due date";
async function api(url:string, init?:RequestInit) { return fetch(url, { credentials:"same-origin", ...init, headers: { "Content-Type":"application/json", ...(init?.headers ?? {}) } }); }

export async function renderDashboard() {
  renderProtectedShell(`<div id="page-content"><div class="customer-loading"><span class="loading-orb"></span><p>Loading dashboard...</p></div></div>`, "/dashboard");
  const content=document.querySelector<HTMLDivElement>("#page-content")!, response=await api("/api/dashboard");
  if (!response.ok) { content.innerHTML=`<div class="customer-error"><strong>We could not load your dashboard.</strong></div>`; return; }
  const data=await response.json() as Dashboard;
  content.innerHTML=`<div class="customer-heading"><div><span class="eyebrow">Agent workspace</span><h1>Dashboard</h1><p class="form-intro">Your ticket work, reminders, and recent activity.</p></div></div><section class="dashboard-metrics">${[["Assigned",data.counts.assigned],["Open",data.counts.open],["Pending",data.counts.pending],["Urgent",data.counts.urgent]].map(([label,count])=>`<article><strong>${count}</strong><span>${label} tickets</span></article>`).join("")}</section><div class="dashboard-grid"><section class="related-section"><span class="eyebrow">Assigned tickets</span><div>${data.assignedTickets.length ? data.assignedTickets.map(ticket=>`<article><a href="/tickets/${ticket.id}"><strong>${value(ticket.ticketNumber)} · ${value(ticket.subject)}</strong></a><small>${value(ticket.customerName)} · ${value(ticket.customerEmail)}</small></article>`).join("") : "<p>No tickets are assigned to you.</p>"}</div></section><section class="related-section"><span class="eyebrow">Reminders</span><form id="reminder-form"><input name="message" maxlength="500" required placeholder="Reminder" /><input name="remindAt" type="datetime-local" required /><button type="submit">Add reminder</button></form><div>${data.reminders.length ? data.reminders.map(reminder=>`<article><strong>${value(reminder.message)}</strong><small>${date(reminder.remindAt)}</small><button data-reminder-dismiss="${reminder.id}" type="button">Dismiss</button><button data-reminder-delete="${reminder.id}" type="button">Delete</button></article>`).join("") : "<p>No active reminders.</p>"}</div></section><section class="related-section"><span class="eyebrow">Recent activity</span><div>${data.recentActivity.length ? data.recentActivity.map(item=>`<article><strong>${value(item.kind.replaceAll("_"," "))}</strong><p>${value(item.detail)}</p><small>${date(item.createdAt)}${item.ticketId ? ` · <a href="/tickets/${item.ticketId}">View ticket</a>` : ""}</small></article>`).join("") : "<p>No recent activity.</p>"}</div></section></div>`;
  const refresh=()=>void renderDashboard();
  content.querySelectorAll<HTMLAnchorElement>("a[href^='/tickets/']").forEach(link=>link.addEventListener("click",event=>{event.preventDefault(); history.pushState({},"",link.pathname); void route();}));
  content.querySelector<HTMLFormElement>("#reminder-form")!.addEventListener("submit",async event=>{event.preventDefault();const form=event.currentTarget as HTMLFormElement,button=form.querySelector<HTMLButtonElement>("button")!;button.disabled=true;const result=await api("/api/reminders",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});if(result.ok)refresh();else button.disabled=false;});
  const mutate=(selector:string,makeUrl:(button:HTMLButtonElement)=>string,method:string)=>content.querySelectorAll<HTMLButtonElement>(selector).forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;if((await api(makeUrl(button),{method})).ok)refresh();else button.disabled=false;}));
  mutate("[data-reminder-dismiss]",button=>`/api/reminders/${button.dataset.reminderDismiss}/dismiss`,"POST");
  mutate("[data-reminder-delete]",button=>`/api/reminders/${button.dataset.reminderDelete}`,"DELETE");
}
