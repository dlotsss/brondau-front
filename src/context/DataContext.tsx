import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { LayoutElement, Booking, BookingStatus, Restaurant, User, UserRole } from '../types';
import { api } from '../services/api';

interface DataContextType {
  restaurants: Restaurant[];
  getRestaurant: (id: string) => Restaurant | undefined;
  authenticateUser: (email: string, password: string, role: UserRole, restaurantId?: string) => Promise<User | undefined>;
  getAdminRestaurants: (email: string) => Promise<{ id: string, name: string }[]>;
  getOwnerRestaurants: (email: string) => Promise<{ id: string, name: string }[]>;
  addRestaurant: (name: string) => Promise<Restaurant | null>;
  addBooking: (
    restaurantId: string,
    bookingData: Omit<Booking, 'id' | 'restaurantId' | 'status' | 'createdAt' | 'declineReason'> & {
      isAdmin?: boolean;
      timezoneOffset?: number;
    }
  ) => Promise<void>;
  updateBookingStatus: (bookingId: string, status: BookingStatus, reason?: string, tableId?: string, tableLabel?: string, duration?: number) => Promise<void>;
  updateLayout: (restaurantId: string, newLayout: LayoutElement[], floors?: any[]) => Promise<void>;
  updateRestaurantSettings: (restaurantId: string, updates: { layout?: LayoutElement[], floors?: any[], bookingRestriction?: number }) => Promise<void>;
  loadRestaurants: () => Promise<void>;
  loadBookings: (restaurantId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);



export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  const loadRestaurants = useCallback(async () => {
    try {
      const data = await api.restaurants.list();

      const restaurantsWithBookings = await Promise.all(
        data.map(async (restaurant: any) => {
          try {
            const bookings = await api.restaurants.getBookings(restaurant.id);

            return {
              id: restaurant.id,
              name: restaurant.name,
              with_map: restaurant.with_map,
              photoUrl: restaurant.photo_url,
              address: restaurant.address,
              workStarts: restaurant.work_starts,
              workEnds: restaurant.work_ends,
              schedule: restaurant.schedule,
              bookingRestriction: restaurant.booking_restriction,
              layout: restaurant.layout || [],
              floors: restaurant.floors || [],
              bookings: bookings.map((b: any) => ({
                id: b.id,
                restaurantId: b.restaurant_id,
                tableId: b.table_id,
                tableLabel: b.table_label,
                guestName: b.guest_name,
                guestPhone: b.guest_phone,
                guestEmail: b.guest_email,
                guestCount: b.guest_count,
                status: b.status,
                declineReason: b.decline_reason,
                cancelReason: b.cancel_reason,
                cancelComment: b.cancel_comment,
                cancelledBy: b.cancelled_by,
                cancelledAt: b.cancelled_at ? new Date(b.cancelled_at) : undefined,
                guestComment: b.guest_comment,
                duration: b.duration,
                dateTime: new Date(b.date_time),
                createdAt: new Date(b.created_at)
              }))
            };
          } catch (e) {
            console.error(`Failed to load bookings for restaurant ${restaurant.id}`, e);
            // Return restaurant without bookings if fetching bookings fails, or handle differently
            return {
              id: restaurant.id,
              name: restaurant.name,
              layout: restaurant.layout || [],
              workStarts: restaurant.work_starts,
              workEnds: restaurant.work_ends,
              schedule: restaurant.schedule,
              bookingRestriction: restaurant.booking_restriction,
              floors: restaurant.floors || [],
              bookings: []
            };
          }
        })
      );

      setRestaurants(restaurantsWithBookings);
    } catch (error) {
      console.error('Failed to load restaurants:', error);
    }
  }, []);

  const loadBookings = useCallback(async (restaurantId: string) => {
    try {
      const bookings = await api.restaurants.getBookings(restaurantId);

      setRestaurants(prev => prev.map(r =>
        r.id === restaurantId
          ? {
            ...r,
            bookings: bookings.map((b: any) => ({
              id: b.id,
              restaurantId: b.restaurant_id,
              tableId: b.table_id,
              tableLabel: b.table_label,
              guestName: b.guest_name,
              guestPhone: b.guest_phone,
              guestEmail: b.guest_email,
              guestCount: b.guest_count,
              status: b.status,
              declineReason: b.decline_reason,
              cancelReason: b.cancel_reason,
              cancelComment: b.cancel_comment,
              cancelledBy: b.cancelled_by,
              cancelledAt: b.cancelled_at ? new Date(b.cancelled_at) : undefined,
              guestComment: b.guest_comment,
              duration: b.duration,
              dateTime: new Date(b.date_time),
              createdAt: new Date(b.created_at)
            }))
          }
          : r
      ));
    } catch (error) {
      console.error('Failed to load bookings:', error);
    }
  }, []);

  const getAdminRestaurants = useCallback(async (email: string) => {
    try {
      return await api.auth.getAdminRestaurants(email);
    } catch (error) {
      console.error('Failed to get admin restaurants:', error);
      return [];
    }
  }, []);

  const getOwnerRestaurants = useCallback(async (email: string) => {
    try {
      return await api.auth.getOwnerRestaurants(email);
    } catch (error) {
      console.error('Failed to get owner restaurants:', error);
      return [];
    }
  }, []);

  const authenticateUser = useCallback(async (
    email: string,
    password: string,
    role: UserRole,
    restaurantId?: string
  ): Promise<User | undefined> => {
    try {
      let userData;
      if (role === 'OWNER') {
        userData = await api.auth.owner({ email, password, restaurantId });
      } else {
        userData = await api.auth.admin({ email, password, restaurantId });
      }

      const finalUser: User = {
        id: userData.id,
        email: userData.email,
        role: userData.role as UserRole,
        restaurantIds: userData.restaurantId ? (userData.restaurantId === 'all' ? [] : [userData.restaurantId]) : []
      };

      if (userData.restaurantId === 'all') {
        try {
          const allRestaurants = await api.restaurants.list();
          finalUser.restaurantIds = allRestaurants.map(r => r.id);
        } catch (e) {
          console.error('Failed to fetch restaurants for owner', e);
        }
      }

      return finalUser;
    } catch (error) {
      console.error('Authentication failed:', error);
      return undefined;
    }
  }, []);

  const getRestaurant = useCallback((id: string) => {
    return restaurants.find(r => r.id === id);
  }, [restaurants]);

  const addRestaurant = useCallback(async (name: string): Promise<Restaurant | null> => {
    try {
      const newRestaurant = await api.restaurants.create(name);

      const restaurant: Restaurant = {
        id: newRestaurant.id,
        name: newRestaurant.name,
        layout: newRestaurant.layout || [],
        workStarts: (newRestaurant as any).work_starts,
        workEnds: (newRestaurant as any).work_ends,
        schedule: newRestaurant.schedule,
        bookings: []
      };

      setRestaurants(prev => [...prev, restaurant]);
      return restaurant;
    } catch (error) {
      console.error('Failed to add restaurant', error);
      return null;
    }
  }, []);

  const updateRestaurantSettings = useCallback(async (restaurantId: string, updates: { layout?: LayoutElement[], floors?: any[], bookingRestriction?: number }) => {
    try {
      const updatedRestaurant = await api.restaurants.updateSettings(restaurantId, updates);
      setRestaurants(prev => prev.map(r => r.id === restaurantId ? {
        ...r,
        layout: updatedRestaurant.layout,
        floors: updatedRestaurant.floors || [],
        bookingRestriction: (updatedRestaurant as any).booking_restriction
      } : r));
    } catch (error) {
      console.error('Failed to update restaurant settings:', error);
    }
  }, []);

  const updateLayout = useCallback(async (restaurantId: string, newLayout: LayoutElement[], floors?: any[]) => {
    return updateRestaurantSettings(restaurantId, { layout: newLayout, floors });
  }, [updateRestaurantSettings]);

  const addBooking = useCallback(async (
    restaurantId: string,
    bookingData: Omit<Booking, 'id' | 'restaurantId' | 'status' | 'createdAt' | 'declineReason'> & {
      isAdmin?: boolean;
      timezoneOffset?: number;
    }
  ) => {
    const b = await api.restaurants.createBooking(restaurantId, {
      ...bookingData,
      dateTime: bookingData.dateTime.toISOString(),
      timezoneOffset: bookingData.timezoneOffset,
      tableId: bookingData.tableId || null,
      tableLabel: bookingData.tableLabel || null,
      isAdmin: bookingData.isAdmin || false,
    });

    setRestaurants(prev => prev.map(r =>
      r.id === restaurantId
        ? {
          ...r,
          bookings: [...r.bookings, {
            id: b.id,
            restaurantId: b.restaurant_id,
            tableId: b.table_id,
            tableLabel: b.table_label,
            guestName: b.guest_name,
            guestPhone: b.guest_phone,
            guestEmail: b.guest_email,
            guestCount: b.guest_count,
            status: b.status,
            declineReason: b.decline_reason,
            cancelReason: b.cancel_reason,
            cancelComment: b.cancel_comment,
            cancelledBy: b.cancelled_by,
            cancelledAt: b.cancelled_at ? new Date(b.cancelled_at) : undefined,
            guestComment: b.guest_comment,
            dateTime: new Date(b.date_time),
            createdAt: new Date(b.created_at)
          }]
        }
        : r
    ));
  }, [restaurants]);

  const updateBookingStatus = useCallback(async (bookingId: string, status: BookingStatus, declineReason?: string, tableId?: string, tableLabel?: string, duration?: number) => {
    try {
      const updatedBooking = await api.bookings.updateStatus(bookingId, status, declineReason, tableId, tableLabel, duration);
      setRestaurants(prev => prev.map(r => ({
        ...r,
        bookings: r.bookings.map(b => b.id === bookingId ? {
          ...b,
          status: updatedBooking.status,
          declineReason: updatedBooking.decline_reason,
          tableId: updatedBooking.table_id,
          tableLabel: updatedBooking.table_label,
          duration: updatedBooking.duration
        } : b)
      })));
    } catch (error) {
      console.error('Failed to update booking status:', error);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    const interval = setInterval(async () => {
      await api.bookings.cleanupExpired();

      for (const r of restaurants) {
        await loadBookings(r.id);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [restaurants, loadBookings]);

  return (
    <DataContext.Provider value={{
      restaurants,
      getRestaurant,
      authenticateUser,
      getAdminRestaurants,
      getOwnerRestaurants,
      addRestaurant,
      addBooking,
      updateBookingStatus,
      updateLayout,
      updateRestaurantSettings,
      loadRestaurants,
      loadBookings
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};