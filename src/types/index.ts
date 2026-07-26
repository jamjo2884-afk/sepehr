export type ID = string;

export type Timestamp = string;

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Workspace {
  id: ID;
  name: string;
  slug: string;
}

export interface UserProfile {
  id: ID;
  fullName: string;
  email: string;
  avatarUrl?: string;
  role: string;
}

export interface Notification {
  id: ID;
  title: string;
  description: string;
  read: boolean;
  createdAt: Timestamp;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export type Locale = 'fa-IR';
export type Direction = 'rtl' | 'ltr';
