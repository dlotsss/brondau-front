import { LayoutElement, Booking, BookingStatus, Restaurant, User, UserRole, Guest, Dish } from '../types';

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
        if (response.status === 403 || response.status === 503) {
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                window.location.reload();
                await new Promise(() => {}); // pause execution
            }
        }
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
            depositKz?: string,
            menu?: boolean
        }) => request<Restaurant>(`/restaurants/${restaurantId}/layout`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        getBookings: (id: string, date?: string) => request<any[]>((date ? `/restaurants/${id}/bookings?date=${date}` : `/restaurants/${id}/bookings`)),
        getBookingsRange: (id: string, from: string, to: string) => request<any[]>(`/restaurants/${id}/bookings-range?from=${from}&to=${to}`),
        createBooking: (id: string, data: any) => request<any>(`/restaurants/${id}/bookings`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        getStaffNames: (id: string) => request<string[]>(`/restaurants/${id}/staff-names`),
    },
    menu: {
        list: (restaurantId: string) => request<Dish[]>(`/restaurants/${restaurantId}/menu`),
        create: (restaurantId: string, data: Omit<Dish, 'id' | 'restaurantId'>) => request<Dish>(`/restaurants/${restaurantId}/menu`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
        update: (dishId: string, data: Partial<Omit<Dish, 'id' | 'restaurantId'>>) => request<Dish>(`/menu/${dishId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
        delete: (dishId: string) => request<{ message: string, dish: Dish }>(`/menu/${dishId}`, {
            method: 'DELETE',
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
        getAdminRestaurants: (email: string, forAnalytics?: boolean) => request<{ id: string, name: string }[]>('/auth/admin/restaurants', {
            method: 'POST',
            body: JSON.stringify({ email, forAnalytics }),
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
    },
    leads: {
        create: (payload: { name: string; phone: string; venue: string; promo?: string }) => request<any>('/leads', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    },
    referalLeads: {
        create: (payload: { name: string; specialty: string; email: string; phone: string }) => request<{ success: boolean; promoCode: string }>('/referal-leads', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    }
};