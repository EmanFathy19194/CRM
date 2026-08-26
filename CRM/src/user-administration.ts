import type { TicketPriority } from "./ticket.js";

export const staffRoles = ["admin", "manager", "agent", "customer"] as const;
export type StaffRole = typeof staffRoles[number];
export type StaffUser = { id:number; name:string; email:string; role:StaffRole; isActive:boolean; createdAt:string; updatedAt:string; deactivatedAt:string|null };
export type StaffUserWithPassword = StaffUser & { passwordHash:string };
export type StaffUserInput = { name:string; email:string; role:StaffRole; password:string };
export type StaffUserUpdateInput = { name:string; email:string; role:StaffRole; password:string|null };
export type StaffUserPage = { items:StaffUser[]; page:number; pageSize:number; total:number; totalPages:number };
export type AuditLog = { id:number; actorEmail:string; action:string; targetKind:string; targetId:string|null; detail:string; createdAt:string };
export type AuditLogPage = { items:AuditLog[]; page:number; pageSize:number; total:number; totalPages:number };
export type SystemSettings = { organizationName:string; supportEmail:string; defaultTicketPriority:TicketPriority };
export type ReportRange = { from:string|null; to:string|null };
