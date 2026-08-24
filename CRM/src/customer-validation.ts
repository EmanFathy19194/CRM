import { customerStatuses, CreateCustomerInput, interactionTypes, InteractionType } from "./customer.js";

export type CustomerValidationResult = { value: CreateCustomerInput; errors: Record<string, string> };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s().-]{6,19}$/;
const fields = ["firstName", "lastName", "email", "phone", "company", "jobTitle", "status", "address", "notes"] as const;

export function validateText(input: unknown, field: string): { value: string; error?: string } {
  const value = typeof input === "string" ? input.trim() : "";
  return value && value.length <= 500 ? { value } : { value, error: value ? `${field} must be 500 characters or fewer.` : `${field} is required.` };
}

export function validateInteraction(input: Record<string, unknown>): { type?: InteractionType; content: string; errors: Record<string, string> } {
  const type = typeof input.type === "string" && interactionTypes.includes(input.type as InteractionType) ? input.type as InteractionType : undefined;
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const errors: Record<string, string> = {};
  if (!type) errors.type = "Choose a valid interaction type.";
  if (!content) errors.content = "Interaction content is required.";
  else if (content.length > 500) errors.content = "Interaction content must be 500 characters or fewer.";
  return { type, content, errors };
}

export function validateCustomer(input: Partial<Record<(typeof fields)[number], unknown>>): CustomerValidationResult {
  const value = Object.fromEntries(fields.map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""])) as CreateCustomerInput;
  const errors: Record<string, string> = {};
  if (!value.firstName) errors.firstName = "First name is required.";
  if (!value.lastName) errors.lastName = "Last name is required.";
  if (!value.email) errors.email = "Email is required.";
  else if (!emailPattern.test(value.email)) errors.email = "Enter a valid email address.";
  if (value.phone && !phonePattern.test(value.phone)) errors.phone = "Enter a valid phone number.";
  if (!customerStatuses.includes(value.status)) errors.status = "Choose a valid status.";
  for (const field of fields) {
    if (value[field].length > 500) errors[field] = "This field must be 500 characters or fewer.";
  }
  return { value: { ...value, email: value.email.toLowerCase() }, errors };
}