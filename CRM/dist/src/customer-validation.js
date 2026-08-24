import { customerStatuses, interactionTypes } from "./customer.js";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s().-]{6,19}$/;
const fields = ["firstName", "lastName", "email", "phone", "company", "jobTitle", "status", "address", "notes"];
export function validateText(input, field) {
    const value = typeof input === "string" ? input.trim() : "";
    return value && value.length <= 500 ? { value } : { value, error: value ? `${field} must be 500 characters or fewer.` : `${field} is required.` };
}
export function validateInteraction(input) {
    const type = typeof input.type === "string" && interactionTypes.includes(input.type) ? input.type : undefined;
    const content = typeof input.content === "string" ? input.content.trim() : "";
    const errors = {};
    if (!type)
        errors.type = "Choose a valid interaction type.";
    if (!content)
        errors.content = "Interaction content is required.";
    else if (content.length > 500)
        errors.content = "Interaction content must be 500 characters or fewer.";
    return { type, content, errors };
}
export function validateCustomer(input) {
    const value = Object.fromEntries(fields.map((field) => [field, typeof input[field] === "string" ? input[field].trim() : ""]));
    const errors = {};
    if (!value.firstName)
        errors.firstName = "First name is required.";
    if (!value.lastName)
        errors.lastName = "Last name is required.";
    if (!value.email)
        errors.email = "Email is required.";
    else if (!emailPattern.test(value.email))
        errors.email = "Enter a valid email address.";
    if (value.phone && !phonePattern.test(value.phone))
        errors.phone = "Enter a valid phone number.";
    if (!customerStatuses.includes(value.status))
        errors.status = "Choose a valid status.";
    for (const field of fields) {
        if (value[field].length > 500)
            errors[field] = "This field must be 500 characters or fewer.";
    }
    return { value: { ...value, email: value.email.toLowerCase() }, errors };
}
