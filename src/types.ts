
export type UserRole = 'GUEST' | 'ADMIN' | 'OWNER';

export interface User {
  id: string;
  email: string;
  password?: string; // Not needed for guest
  role: UserRole;
  restaurantIds: string[]; // Which restaurants this user can manage
}

export interface Guest {
  phone: string;
  name: string;
  email?: string;
  internalComment?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  OCCUPIED = 'OCCUPIED', // For walk-ins or manual assignment
  COMPLETED = 'COMPLETED'
}
export interface TableElement {
  id: string;
  type: 'table';
  x: number;
  y: number;
  seats: number;
  shape: 'circle' | 'square';
  label: string;
  width: number;
  height: number;
  rotation?: number;
  floorId?: string;
}

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string; // The text content
  fontSize?: number;
  rotation?: number;
  floorId?: string;
}

export interface DecoElement {
  id: string;
  type: 'wall' | 'bar' | 'plant' | 'window' | 'arrow' | 'stairs';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  floorId?: string;
}

export type LayoutElement = TableElement | DecoElement | TextElement;

export interface Floor {
  id: string;
  name: string;
}

export interface Booking {
  id: string;
  restaurantId: string;
  tableId?: string | null;
  tableLabel?: string | null;
  dateTime: Date;
  status: BookingStatus;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestCount: number;
  guestComment?: string;
  timezoneOffset?: number;
  declineReason?: string;
  cancelReason?: string;
  cancelComment?: string;
  cancelledBy?: 'guest' | 'admin' | 'system';
  cancelledAt?: Date;
  createdAt: Date;
}

export type PublicCancelBookingInfo = {
  bookingId: string;
  restaurantName: string;
  guestName: string;
  guestCount: number;
  dateTime: string;
  tableLabel?: string;
  status: BookingStatus;
  canCancel: boolean;
};

export interface Restaurant {
  id: string;
  name: string;
  with_map?: boolean; // If false, guests book without selecting a table
  photoUrl?: string; // Mapped from photo_url
  address?: string;
  workStarts?: string; // HH:MM
  workEnds?: string; // HH:MM
  layout: LayoutElement[];
  bookings: Booking[];
  floors?: Floor[];
  schedule?: Record<number, { start: string; end: string }>;
}
