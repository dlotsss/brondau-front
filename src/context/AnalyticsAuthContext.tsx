import React, { createContext, useState, useContext, ReactNode } from 'react';
import { useData } from './DataContext';

export interface AnalyticsUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'OWNER';
  restaurantId: string;
  restaurantName: string;
  managerName?: string;
}

interface AnalyticsAuthContextType {
  analyticsUser: AnalyticsUser | null;
  loginAnalytics: (email: string, password: string, restaurantId: string, role?: 'ADMIN' | 'OWNER') => Promise<AnalyticsUser | null>;
  logoutAnalytics: () => void;
}

const AnalyticsAuthContext = createContext<AnalyticsAuthContextType | undefined>(undefined);

export const AnalyticsAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticateUser, getRestaurant } = useData();

  const [analyticsUser, setAnalyticsUser] = useState<AnalyticsUser | null>(() => {
    const storedUser = localStorage.getItem('analyticsUser');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const loginAnalytics = async (
    email: string,
    password: string,
    restaurantId: string,
    role: 'ADMIN' | 'OWNER' = 'ADMIN'
  ): Promise<AnalyticsUser | null> => {
    if (!email || !password || !restaurantId) return null;

    const user = await authenticateUser(email, password, role, restaurantId, true);

    if (user) {
      const restaurant = getRestaurant(restaurantId);
      const restaurantName = restaurant ? restaurant.name : 'Ресторан';

      const anaUser: AnalyticsUser = {
        id: user.id,
        email: user.email,
        role: role,
        restaurantId: restaurantId,
        restaurantName: restaurantName,
        managerName: user.managerName
      };

      setAnalyticsUser(anaUser);
      localStorage.setItem('analyticsUser', JSON.stringify(anaUser));
      return anaUser;
    }

    return null;
  };

  const logoutAnalytics = () => {
    setAnalyticsUser(null);
    localStorage.removeItem('analyticsUser');
  };

  return (
    <AnalyticsAuthContext.Provider value={{ analyticsUser, loginAnalytics, logoutAnalytics }}>
      {children}
    </AnalyticsAuthContext.Provider>
  );
};

export const useAnalyticsAuth = (): AnalyticsAuthContextType => {
  const context = useContext(AnalyticsAuthContext);
  if (!context) {
    throw new Error('useAnalyticsAuth must be used within an AnalyticsAuthProvider');
  }
  return context;
};
