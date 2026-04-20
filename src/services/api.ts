import { LayoutElement, Booking, BookingStatus, Restaurant, User, UserRole, Guest } from '../types';

const getBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
    }
    return 'http://localhost:3001/api';
};

export const API_BASE_URL = getBaseUrl();

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Ошибка запроса: ${response.statusText}`);
    }

    return response.json();
}

export const api = {
    restaurants: {
        list: () => request<Restaurant[]>('/restaurants'),
        create: (name: string) => request<Restaurant>('/restaurants', {
            method: 'POST',
            body: JSON.stringify({ name }),
        }),
        updateSettings: (restaurantId: string, data: { 
            layout?: LayoutElement[], 
            floors?: any[], 
            bookingRestriction?: number, 
            ageRestriction?: string,
            photoUrl?: string,
            logoUrl?: string,
            address?: string,
            city?: string,
            adminWorks?: any,
            deposit?: string,
            ageRestrictionKz?: string,
            depositKz?: string
        }) => request<Restaurant>(`/restaurants/${restaurantId}/layout`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        getBookings: (id: string) => request<any[]>((`/restaurants/${id}/bookings`)),
        createBooking: (id: string, data: any) => request<any>(`/restaurants/${id}/bookings`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        getStaffNames: (id: string) => request<string[]>(`/restaurants/${id}/staff-names`),
    },
    auth: {
        owner: (data: any) => request<any>('/auth/owner', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        admin: (data: any) => request<any>('/auth/admin', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        getAdminRestaurants: (email: string) => request<{ id: string, name: string }[]>('/auth/admin/restaurants', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
        getOwnerRestaurants: (email: string) => request<{ id: string, name: string }[]>('/auth/owner/restaurants', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),
    },
    bookings: {
        updateDetails: (id: string, payload: any) => request<any>(`/bookings/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),
        updateStatus: (id: string, status: BookingStatus, declineReason?: string, tableId?: string, tableLabel?: string, duration?: number, tableIds?: string[], tableLabels?: string[], assignedTo?: string) => request<any>(`/bookings/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, declineReason, tableId, tableLabel, duration, tableIds, tableLabels, assignedTo }),
        }),
        cleanupExpired: () => request<{ updated: number, bookings: any[] }>('/bookings/cleanup-expired', {
            method: 'POST',
        }),
    },
    guests: {
        search: (phone: string, restaurantId: string) => request<Guest[]>(`/guests/search?phone=${encodeURIComponent(phone)}&restaurantId=${restaurantId}`),
        getHistory: (phone: string, restaurantId: string) => request<{ stats: any, history: any[] }>(`/guests/${phone}/history?restaurantId=${restaurantId}`),
        update: (phone: string, restaurantId: string, data: { internalComment?: string, name?: string, email?: string }) => request<Guest>(`/guests/${phone}`, {
            method: 'PUT',
            body: JSON.stringify({ ...data, restaurantId }),
        }),
    },
    public: {
        getCancelInfo: (token: string) => request<any>(`/public/bookings/cancel-info/${token}`),
        cancelBooking: (token: string, payload: { reason: string; comment?: string }) => request<any>(`/public/bookings/cancel/${token}`, {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    }
};