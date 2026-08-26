const text = (value) => typeof value === "string" ? value.trim() : "";
function nullableDate(value, required) {
    const input = text(value);
    if (!input && !required)
        return { value: null, error: undefined };
    const parsed = input ? new Date(input) : null;
    return !parsed || Number.isNaN(parsed.getTime()) ? { value: input || null, error: "Enter a valid date and time." } : { value: parsed.toISOString(), error: undefined };
}
export function validateTask(input) {
    const due = nullableDate(input.dueAt, false), value = { title: text(input.title), details: text(input.details) || null, dueAt: due.value };
    const errors = {};
    if (!value.title)
        errors.title = "Task title is required.";
    else if (value.title.length > 200)
        errors.title = "Task title must be 200 characters or fewer.";
    if (value.details && value.details.length > 2000)
        errors.details = "Task details must be 2000 characters or fewer.";
    if (due.error)
        errors.dueAt = due.error;
    return { value, errors };
}
export function validateReminder(input) {
    const due = nullableDate(input.remindAt, true), value = { message: text(input.message), remindAt: due.value ?? "" };
    const errors = {};
    if (!value.message)
        errors.message = "Reminder message is required.";
    else if (value.message.length > 500)
        errors.message = "Reminder message must be 500 characters or fewer.";
    if (due.error)
        errors.remindAt = due.error;
    return { value, errors };
}
export function validateComment(input) {
    const value = { body: text(input.body) }, errors = {};
    if (!value.body)
        errors.body = "Comment is required.";
    else if (value.body.length > 2000)
        errors.body = "Comment must be 2000 characters or fewer.";
    return { value, errors };
}
