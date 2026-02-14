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
  addBooking: (restaurantId: string, bookingData: Omit<Booking, 'id' | 'restaurantId' | 'tableLabel' | 'status' | 'createdAt' | 'declineReason'>) => Promise<void>;
  updateBookingStatus: (restaurantId: string, bookingId: string, status: BookingStatus, reason?: string) => Promise<void>;
  updateLayout: (restaurantId: string, newLayout: LayoutElement[], floors?: any[]) => Promise<void>;
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
              photoUrl: restaurant.photo_url,
              address: restaurant.address,
              workStarts: restaurant.work_starts,
              workEnds: restaurant.work_ends,
              layout: restaurant.layout || [],
              floors: restaurant.floors || [],
              bookings: bookings.map((b: any) => ({
                id: b.id,
                restaurantId: b.restaurant_id,
                tableId: b.table_id,
                tableLabel: b.table_label,
                guestName: b.guest_name,
                guestPhone: b.guest_phone,
                guestCount: b.guest_count,
                status: b.status,
                declineReason: b.decline_reason,
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
              guestCount: b.guest_count,
              status: b.status,
              declineReason: b.decline_reason,
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
        bookings: []
      };

      setRestaurants(prev => [...prev, restaurant]);
      return restaurant;
    } catch (error) {
      console.error('Failed to add restaurant', error);
      return null;
    }
  }, []);

  const updateLayout = useCallback(async (restaurantId: string, newLayout: LayoutElement[], floors?: any[]) => {
    try {
      await api.restaurants.updateLayout(restaurantId, newLayout, floors);

      setRestaurants(prev => prev.map(r =>
        r.id === restaurantId ? { ...r, layout: newLayout, ...(floors ? { floors } : {}) } : r
      ));
    } catch (error) {
      console.error('Failed to update layout', error);
    }
  }, []);

  const addBooking = useCallback(async (
    restaurantId: string,
    bookingData: Omit<Booking, 'id' | 'restaurantId' | 'tableLabel' | 'status' | 'createdAt' | 'declineReason'>
  ) => {
    const tableLabel = restaurants.find(r => r.id === restaurantId)
      ?.layout.find(el => el.id === bookingData.tableId && el.type === 'table')
      // @ts-ignore
      ?.label || '';

    const b = await api.restaurants.createBooking(restaurantId, {
      ...bookingData,
      dateTime: bookingData.dateTime.toISOString(),
      timezoneOffset: (bookingData as any).timezoneOffset,
      tableLabel,
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
            guestCount: b.guest_count,
            status: b.status,
            declineReason: b.decline_reason,
            dateTime: new Date(b.date_time),
            createdAt: new Date(b.created_at)
          }]
        }
        : r
    ));
  }, [restaurants]);

  const updateBookingStatus = useCallback(async (
    restaurantId: string,
    bookingId: string,
    status: BookingStatus,
    reason?: string
  ) => {
    await api.bookings.updateStatus(bookingId, status, reason);

    setRestaurants(prev => prev.map(r => {
      if (r.id === restaurantId) {
        return {
          ...r,
          bookings: r.bookings.map(b =>
            b.id === bookingId
              ? { ...b, status, declineReason: status === BookingStatus.DECLINED ? reason : undefined }
              : b
          )
        };
      }
      return r;
    }));
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