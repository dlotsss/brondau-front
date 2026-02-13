import { LayoutElement, Booking, BookingStatus, Restaurant, User, UserRole } from '../types';

const getBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
    }
    return 'http://localhost:3001/api';
};

const API_BASE_URL = getBaseUrl();

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
        updateLayout: (restaurantId: string, newLayout: LayoutElement[], floors?: any[]) => request<void>(`/restaurants/${restaurantId}/layout`, {
            method: 'PUT',
            body: JSON.stringify({ layout: newLayout, floors }),
        }),
        getBookings: (id: string) => request<any[]>((`/restaurants/${id}/bookings`)),
        createBooking: (id: string, data: any) => request<any>(`/restaurants/${id}/bookings`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
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
        updateStatus: (id: string, status: BookingStatus, declineReason?: string) => request<any>(`/bookings/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, declineReason }),
        }),
        cleanupExpired: () => request<{ updated: number, bookings: any[] }>('/bookings/cleanup-expired', {
            method: 'POST',
        }),
    }
};