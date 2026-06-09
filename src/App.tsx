
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AppProvider, useApp } from './context/AppContext';

import { I18nProvider } from './context/I18nContext';

import Header from './components/Header';
import LoginView from './views/LoginView';
import RestaurantListView from './views/RestaurantListView';
import UserView from './views/UserView';
import AdminView from './views/AdminView';
import ConstructorView from './views/ConstructorView';
import BookingCancellationView from './views/BookingCancellationView';

const RestaurantWrapper: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { currentUser, selectRestaurant } = useApp();

    useEffect(() => {
        if (id) {
            selectRestaurant(id);
        }
    }, [id, selectRestaurant]);

    let ViewComponent;
    switch (currentUser?.role) {
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


import LandingView from './views/LandingView';
import ReferalLandingView from './views/ReferalLandingView';

const LegacyHashRedirect: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const hashPath = window.location.hash;
        if (!hashPath.startsWith('#/')) return;

        const nextPath = hashPath === '#/login' ? '/' : hashPath.slice(1);
        navigate(nextPath, { replace: true });
    }, [navigate]);

    return null;
};

const AppContent: React.FC = () => {
    const { currentUser } = useApp();
    return (
        <>
        <LegacyHashRedirect />
        <Routes>
            <Route path="/landing" element={<LandingView />} />
            <Route path="/referal-landing" element={<ReferalLandingView />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/login-rest" element={currentUser && currentUser.role !== 'GUEST' ? <Navigate to="/" replace /> : <LoginView />} />
            <Route path="/cancel-booking/:token" element={<BookingCancellationView />} />
            <Route path="/" element={<RestaurantListView />} />
            <Route path="/restaurant/:id" element={<RestaurantWrapper />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </>
    );
};

const App: React.FC = () => {
    return (
        <I18nProvider>
            <DataProvider>
                <AppProvider>
                    <BrowserRouter>
                        <AppContent />
                    </BrowserRouter>
                </AppProvider>
            </DataProvider>
        </I18nProvider>
    );
};

export default App;
