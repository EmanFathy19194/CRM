import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LoginCredentials, validateLogin } from "./validation.js";

export const userRoles = ["admin", "manager", "agent", "customer"] as const;
export type UserRole = typeof userRoles[number];
export type PublicUser = { id: string; email: string; role: UserRole };

type User = PublicUser & { passwordHash: string };

export class AuthService {
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, { user: PublicUser; expiresAt: number }>();
  private staffStore?: { getForLogin(email:string): { id:number; email:string; role:UserRole; name:string; passwordHash:string } | null; isActive(email:string):boolean; seed(email:string,password:string,role:UserRole):Promise<void> };

  setStaffStore(store: NonNullable<AuthService["staffStore"]>): void { this.staffStore = store; }

  constructor(private readonly sessionPath?: string) {
    if (!sessionPath || !existsSync(sessionPath)) return;
    try {
      const stored = JSON.parse(readFileSync(sessionPath, "utf8")) as Record<string, { user: PublicUser; expiresAt: number }>;
      for (const [token, session] of Object.entries(stored)) {
        if (session.expiresAt > Date.now()) this.sessions.set(token, { ...session, user: { ...session.user, role: session.user.role === "admin" ? "admin" : session.user.role === "customer" ? "customer" : "agent" } });
      }
      this.persistSessions();
    } catch { /* A malformed local session file is treated as an empty session store. */ }
  }

  private persistSessions(): void {
    if (!this.sessionPath) return;
    const active = Object.fromEntries([...this.sessions].filter(([, session]) => session.expiresAt > Date.now()));
    mkdirSync(dirname(this.sessionPath), { recursive: true });
    writeFileSync(this.sessionPath, JSON.stringify(active), "utf8");
  }

  async seedUser(email: string, password: string, role: UserRole = "admin"): Promise<void> {
    if (this.staffStore) { await this.staffStore.seed(email,password,role); return; }
    const normalizedEmail = email.trim().toLowerCase();
    this.users.set(normalizedEmail, {
      id: randomUUID(),
      email: normalizedEmail,
      role,
      passwordHash: await bcrypt.hash(password, 12)
    });
  }

  async customerLogin(email: string, _password: string): Promise<{ token: string; user: PublicUser } | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const stored = this.staffStore?.getForLogin(normalizedEmail);
    const user = stored ? { id:String(stored.id), email:stored.email, role:stored.role, passwordHash:stored.passwordHash } : this.users.get(normalizedEmail);
    if (!user || user.role !== "customer") return null;
    const token = randomUUID();
    this.sessions.set(token, { user: { id: user.id, email: user.email, role: user.role }, expiresAt: Date.now() + 60 * 60 * 1000 });
    this.persistSessions();
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }

  async login(credentials: LoginCredentials): Promise<{ token: string; user: PublicUser } | null> {
    if (validateLogin(credentials)) return null;
    const normalizedEmail = credentials.email.trim().toLowerCase();
    const stored = this.staffStore?.getForLogin(normalizedEmail);
    const user = stored ? { id:String(stored.id), email:stored.email, role:stored.role, passwordHash:stored.passwordHash } : this.users.get(normalizedEmail);
    if (!user || user.role === "customer") return null;
    if (!(await bcrypt.compare(credentials.password, user.passwordHash))) return null;

    const token = randomUUID();
    this.sessions.set(token, { user: { id: user.id, email: user.email, role: user.role }, expiresAt: Date.now() + 60 * 60 * 1000 });
    this.persistSessions();
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }

  getUser(token: string | undefined): PublicUser | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now() || (session.user.role !== "customer" && this.staffStore !== undefined && !this.staffStore.isActive(session.user.email))) {
      this.sessions.delete(token);
      this.persistSessions();
      return null;
    }
    return session.user;
  }

  logout(token: string | undefined): void {
    if (token) { this.sessions.delete(token); this.persistSessions(); }
  }
}
