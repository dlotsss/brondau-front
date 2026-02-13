
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AppProvider, useApp } from './context/AppContext';

import Header from './components/Header';
import LoginView from './views/LoginView';
import RestaurantListView from './views/RestaurantListView';
import UserView from './views/UserView';
import AdminView from './views/AdminView';
import ConstructorView from './views/ConstructorView';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { currentUser } = useApp();
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

const RestaurantWrapper: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { currentUser, selectRestaurant } = useApp();

    useEffect(() => {
        if (id) {
            selectRestaurant(id);
        }
    }, [id, selectRestaurant]);

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    let ViewComponent;
    switch (currentUser.role) {
        case 'ADMIN':
            ViewComponent = AdminView;
            break;
        case 'OWNER':
            ViewComponent = ConstructorView;
            break;
        case 'GUEST':
        default:
            ViewComponent = UserView;
            break;
    }

    return (
        <div className="min-h-screen bg-brand-secondary">
            <Header />
            <main className="p-4 md:p-8">
                <ViewComponent />
            </main>
        </div>
    );
};


const AppContent: React.FC = () => {
    const { currentUser } = useApp();
    return (
        <Routes>
            <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <LoginView />} />
            <Route path="/" element={<ProtectedRoute><RestaurantListView /></ProtectedRoute>} />
            <Route path="/restaurant/:id" element={<ProtectedRoute><RestaurantWrapper /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

const App: React.FC = () => {
    return (
        <DataProvider>
            <AppProvider>
                <HashRouter>
                    <AppContent />
                </HashRouter>
            </AppProvider>
        </DataProvider>
    );
};

export default App;
