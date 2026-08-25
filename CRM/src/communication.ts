export const communicationChannelTypes = ["email", "whatsapp", "live_chat", "sms", "web_form"] as const;
export type CommunicationChannelType = (typeof communicationChannelTypes)[number];
export type CommunicationChannel = { type: CommunicationChannelType; displayName: string; isEnabled: boolean };
export type CustomerCommunication = { id: number; customerId: number; ticketId: number | null; channel: CommunicationChannelType; message: string; sourceReference: string | null; receivedAt: string };
export type CreateCommunicationInput = { customerId: number; ticketId: number | null; channel: CommunicationChannelType; message: string; sourceReference?: string | null };
export type PublicWebRequestInput = { email: string; subject: string; category: string | null; dueDate: string | null; message: string };
export type PublicWebRequestResponse = { ticketNumber: string };
