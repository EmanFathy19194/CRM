import { communicationChannelTypes } from "./communication.js";
function mapChannel(row) {
    return { type: String(row.type), displayName: String(row.display_name), isEnabled: Boolean(Number(row.is_enabled)) };
}
function mapCommunication(row) {
    return { id: Number(row.id), customerId: Number(row.customer_id), ticketId: row.ticket_id === null ? null : Number(row.ticket_id), channel: String(row.channel_type), message: String(row.message), sourceReference: row.source_reference === null ? null : String(row.source_reference), receivedAt: String(row.received_at) };
}
export class CommunicationRepository {
    database;
    constructor(database) {
        this.database = database;
    }
    listChannels() {
        return this.database.prepare("SELECT type, display_name, is_enabled FROM communication_channels ORDER BY CASE type WHEN 'email' THEN 1 WHEN 'whatsapp' THEN 2 WHEN 'live_chat' THEN 3 WHEN 'sms' THEN 4 WHEN 'web_form' THEN 5 END").all().map(mapChannel);
    }
    getChannel(type) {
        const row = this.database.prepare("SELECT type, display_name, is_enabled FROM communication_channels WHERE type = ?").get(type);
        return row ? mapChannel(row) : null;
    }
    setChannelEnabled(type, enabled) {
        this.database.prepare("UPDATE communication_channels SET is_enabled = ? WHERE type = ?").run(enabled ? 1 : 0, type);
        return this.getChannel(type);
    }
    // Compatibility aliases keep the focused repository vocabulary clear at call sites.
    channel(type) { return this.getChannel(type); }
    setEnabled(type, enabled) { return this.setChannelEnabled(type, enabled); }
    createCommunication(input) {
        const now = new Date().toISOString();
        const result = this.database.prepare("INSERT INTO customer_communications (customer_id, ticket_id, channel_type, message, source_reference, received_at) VALUES (?, ?, ?, ?, ?, ?)").run(input.customerId, input.ticketId, input.channel, input.message, input.sourceReference ?? null, now);
        return this.get(Number(result.lastInsertRowid));
    }
    create(input) { return this.createCommunication(input); }
    get(id) {
        const row = this.database.prepare("SELECT * FROM customer_communications WHERE id = ?").get(id);
        return row ? mapCommunication(row) : null;
    }
    list(customerId, ticketId, channel) {
        const conditions = [], params = [];
        if (customerId !== undefined) {
            conditions.push("customer_id = ?");
            params.push(customerId);
        }
        if (ticketId !== undefined) {
            conditions.push("ticket_id = ?");
            params.push(ticketId);
        }
        if (channel) {
            conditions.push("channel_type = ?");
            params.push(channel);
        }
        const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
        return this.database.prepare(`SELECT * FROM customer_communications${where} ORDER BY received_at DESC, id DESC`).all(...params).map(mapCommunication);
    }
    listCustomerCommunications(customerId) { return this.list(customerId); }
    listTicketCommunications(ticketId) { return this.list(undefined, ticketId); }
}
export { communicationChannelTypes };
