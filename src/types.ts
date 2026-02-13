
export type UserRole = 'GUEST' | 'ADMIN' | 'OWNER';

export interface User {
  id: string;
  email: string;
  password?: string; // Not needed for guest
  role: UserRole;
  restaurantIds: string[]; // Which restaurants this user can manage
}

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
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
  floorId?: string;
}

export interface DecoElement {
  id: string;
  type: 'wall' | 'bar' | 'plant' | 'window' | 'arrow' | 'stairs';
  x: number;
  y: number;
  width: number;
  height: number;
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
  tableId: string;
  tableLabel: string;
  dateTime: Date;
  status: BookingStatus;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  declineReason?: string;
  createdAt: Date;
}

export interface Restaurant {
  id: string;
  name: string;
  photoUrl?: string; // Mapped from photo_url
  address?: string;
  workStarts?: string; // HH:MM
  workEnds?: string; // HH:MM
  layout: LayoutElement[];
  bookings: Booking[];
  floors?: Floor[];
}
