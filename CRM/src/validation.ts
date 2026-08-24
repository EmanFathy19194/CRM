export type LoginCredentials = {
  email: string;
  password: string;
};

export function validateLogin(credentials: Partial<LoginCredentials>): string | null {
  if (!credentials.email?.trim()) return "Email is required.";
  if (!credentials.password) return "Password is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email.trim())) {
    return "Enter a valid email address.";
  }
  return null;
}