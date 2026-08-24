import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { LoginCredentials, validateLogin } from "./validation.js";

export type PublicUser = { id: string; email: string };

type User = PublicUser & { passwordHash: string };

export class AuthService {
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, { userId: string; expiresAt: number }>();

  async seedUser(email: string, password: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    this.users.set(normalizedEmail, {
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12)
    });
  }

  async login(credentials: LoginCredentials): Promise<{ token: string; user: PublicUser } | null> {
    if (validateLogin(credentials)) return null;
    const user = this.users.get(credentials.email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;

    const token = randomUUID();
    this.sessions.set(token, { userId: user.id, expiresAt: Date.now() + 60 * 60 * 1000 });
    return { token, user: { id: user.id, email: user.email } };
  }

  getUser(token: string | undefined): PublicUser | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    const user = [...this.users.values()].find((candidate) => candidate.id === session.userId);
    return user ? { id: user.id, email: user.email } : null;
  }

  logout(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }
}