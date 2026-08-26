import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { validateLogin } from "./validation.js";
export const userRoles = ["admin", "manager", "agent", "customer"];
export class AuthService {
    sessionPath;
    users = new Map();
    sessions = new Map();
    staffStore;
    setStaffStore(store) { this.staffStore = store; }
    constructor(sessionPath) {
        this.sessionPath = sessionPath;
        if (!sessionPath || !existsSync(sessionPath))
            return;
        try {
            const stored = JSON.parse(readFileSync(sessionPath, "utf8"));
            for (const [token, session] of Object.entries(stored)) {
                if (session.expiresAt > Date.now())
                    this.sessions.set(token, { ...session, user: { ...session.user, role: session.user.role === "admin" ? "admin" : session.user.role === "customer" ? "customer" : "agent" } });
            }
            this.persistSessions();
        }
        catch { /* A malformed local session file is treated as an empty session store. */ }
    }
    persistSessions() {
        if (!this.sessionPath)
            return;
        const active = Object.fromEntries([...this.sessions].filter(([, session]) => session.expiresAt > Date.now()));
        mkdirSync(dirname(this.sessionPath), { recursive: true });
        writeFileSync(this.sessionPath, JSON.stringify(active), "utf8");
    }
    async seedUser(email, password, role = "admin") {
        if (this.staffStore) {
            await this.staffStore.seed(email, password, role);
            return;
        }
        const normalizedEmail = email.trim().toLowerCase();
        this.users.set(normalizedEmail, {
            id: randomUUID(),
            email: normalizedEmail,
            role,
            passwordHash: await bcrypt.hash(password, 12)
        });
    }
    async customerLogin(email, _password) {
        const normalizedEmail = email.trim().toLowerCase();
        const stored = this.staffStore?.getForLogin(normalizedEmail);
        const user = stored ? { id: String(stored.id), email: stored.email, role: stored.role, passwordHash: stored.passwordHash } : this.users.get(normalizedEmail);
        if (!user || user.role !== "customer")
            return null;
        const token = randomUUID();
        this.sessions.set(token, { user: { id: user.id, email: user.email, role: user.role }, expiresAt: Date.now() + 60 * 60 * 1000 });
        this.persistSessions();
        return { token, user: { id: user.id, email: user.email, role: user.role } };
    }
    async login(credentials) {
        if (validateLogin(credentials))
            return null;
        const normalizedEmail = credentials.email.trim().toLowerCase();
        const stored = this.staffStore?.getForLogin(normalizedEmail);
        const user = stored ? { id: String(stored.id), email: stored.email, role: stored.role, passwordHash: stored.passwordHash } : this.users.get(normalizedEmail);
        if (!user || user.role === "customer")
            return null;
        if (!(await bcrypt.compare(credentials.password, user.passwordHash)))
            return null;
        const token = randomUUID();
        this.sessions.set(token, { user: { id: user.id, email: user.email, role: user.role }, expiresAt: Date.now() + 60 * 60 * 1000 });
        this.persistSessions();
        return { token, user: { id: user.id, email: user.email, role: user.role } };
    }
    getUser(token) {
        if (!token)
            return null;
        const session = this.sessions.get(token);
        if (!session || session.expiresAt <= Date.now() || (session.user.role !== "customer" && this.staffStore !== undefined && !this.staffStore.isActive(session.user.email))) {
            this.sessions.delete(token);
            this.persistSessions();
            return null;
        }
        return session.user;
    }
    logout(token) {
        if (token) {
            this.sessions.delete(token);
            this.persistSessions();
        }
    }
}
