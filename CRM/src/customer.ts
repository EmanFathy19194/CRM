export const customerStatuses = ["active", "inactive", "prospect"] as const;
export type CustomerStatus = (typeof customerStatuses)[number];

export type CreateCustomerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  status: CustomerStatus;
  address: string;
  notes: string;
  password?: string;
};

export type Customer = CreateCustomerInput & {
  id: number;
  createdAt: string;
  updatedAt: string;
};
export type CustomerNote = {
  id: number;
  customerId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerAttachment = {
  id: number;
  customerId: number;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

export const interactionTypes = ["call", "email", "message", "meeting", "note"] as const;
export type InteractionType = (typeof interactionTypes)[number];

export type CustomerInteraction = {
  id: number;
  customerId: number;
  type: InteractionType;
  content: string;
  createdAt: string;
};