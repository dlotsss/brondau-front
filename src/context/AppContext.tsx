import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { UserRole, User } from '../types';
import { useData } from './DataContext';

interface AppContextType {
  currentUser: User | null;
  selectedRestaurantId: string | null;
  login: (role: UserRole, email?: string, password?: string, restaurantId?: string) => Promise<User | null>;
  logout: () => void;
  selectRestaurant: (restaurantId: string) => void;
  deselectRestaurant: () => void;
  addRestaurantToCurrentUser: (restaurantId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authenticateUser } = useData();
  /* Initialize from localStorage */
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('currentUser');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(() => {
    return localStorage.getItem('selectedRestaurantId');
  });

  const login = async (role: UserRole, email?: string, password?: string, restaurantId?: string): Promise<User | null> => {
    if (role === 'GUEST') {
      const guestUser: User = { id: 'guest', email: '', role: 'GUEST', restaurantIds: [] };
      setCurrentUser(guestUser);
      localStorage.setItem('currentUser', JSON.stringify(guestUser));
      return guestUser;
    }

    if (!email || !password) return null;

    const user = await authenticateUser(email, password, role, restaurantId);

    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));

      if (role === 'ADMIN' || role === 'OWNER') {
        const rId = user.restaurantIds.length === 1 ? user.restaurantIds[0] : null;
        setSelectedRestaurantId(rId);
        if (rId) localStorage.setItem('selectedRestaurantId', rId);
        else localStorage.removeItem('selectedRestaurantId');
      }
      return user;
    }

    return null;
  };

  const logout = () => {
    setCurrentUser(null);
    setSelectedRestaurantId(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('selectedRestaurantId');
  };

  const selectRestaurant = useCallback((restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
    localStorage.setItem('selectedRestaurantId', restaurantId);
  }, []);

  const deselectRestaurant = () => {
    setSelectedRestaurantId(null);
  };

  const addRestaurantToCurrentUser = (restaurantId: string) => {
    if (currentUser && currentUser.role === 'OWNER') {
      setCurrentUser(prevUser => prevUser ? {
        ...prevUser,
        restaurantIds: [...prevUser.restaurantIds, restaurantId]
      } : null);
    }
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      selectedRestaurantId,
      login,
      logout,
      selectRestaurant,
      deselectRestaurant,
      addRestaurantToCurrentUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};