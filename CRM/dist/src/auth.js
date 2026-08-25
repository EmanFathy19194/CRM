import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { validateLogin } from "./validation.js";
export class AuthService {
    sessionPath;
    users = new Map();
    sessions = new Map();
    constructor(sessionPath) {
        this.sessionPath = sessionPath;
        if (!sessionPath || !existsSync(sessionPath))
            return;
        try {
            const stored = JSON.parse(readFileSync(sessionPath, "utf8"));
            for (const [token, session] of Object.entries(stored))
                if (session.expiresAt > Date.now())
                    this.sessions.set(token, session);
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
    async seedUser(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        this.users.set(normalizedEmail, {
            id: randomUUID(),
            email: normalizedEmail,
            passwordHash: await bcrypt.hash(password, 12)
        });
    }
    async login(credentials) {
        if (validateLogin(credentials))
            return null;
        const user = this.users.get(credentials.email.trim().toLowerCase());
        if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash)))
            return null;
        const token = randomUUID();
        this.sessions.set(token, { user: { id: user.id, email: user.email }, expiresAt: Date.now() + 60 * 60 * 1000 });
        this.persistSessions();
        return { token, user: { id: user.id, email: user.email } };
    }
    getUser(token) {
        if (!token)
            return null;
        const session = this.sessions.get(token);
        if (!session || session.expiresAt <= Date.now()) {
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
