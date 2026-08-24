import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { validateLogin } from "./validation.js";
export class AuthService {
    users = new Map();
    sessions = new Map();
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
        this.sessions.set(token, { userId: user.id, expiresAt: Date.now() + 60 * 60 * 1000 });
        return { token, user: { id: user.id, email: user.email } };
    }
    getUser(token) {
        if (!token)
            return null;
        const session = this.sessions.get(token);
        if (!session || session.expiresAt <= Date.now()) {
            this.sessions.delete(token);
            return null;
        }
        const user = [...this.users.values()].find((candidate) => candidate.id === session.userId);
        return user ? { id: user.id, email: user.email } : null;
    }
    logout(token) {
        if (token)
            this.sessions.delete(token);
    }
}
