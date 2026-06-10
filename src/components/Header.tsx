import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { useTranslation } from '../context/I18nContext';

const Header: React.FC = () => {
    const { currentUser, selectedRestaurantId, logout, deselectRestaurant } = useApp();
    const { getRestaurant } = useData();
    const { t, language, setLanguage } = useTranslation();
    const navigate = useNavigate();
    const restaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;
    const isStaffUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER';

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleChangeRestaurant = () => {
        deselectRestaurant();
        navigate('/');
    };

    return (
        <header className="bg-[#121212] border-b border-[#2A2A2A] py-3 px-4 md:px-8 flex justify-between items-center z-50 sticky top-0">
            <div className="flex items-center">
                <h1 className="text-lg md:text-xl font-black text-[#FAF9F6] tracking-wide flex items-center cursor-pointer" onClick={() => navigate('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#E07A5F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    BRONDAU
                </h1>
                
                {restaurant && (
                    <div className="hidden md:flex items-center ml-8">
                        <span className="w-px h-5 bg-[#333333]"></span>
                        <div className="ml-6 flex items-baseline gap-2">
                            <span className="text-xs uppercase tracking-widest text-[#8A8A8A] font-semibold">
                                {t('app.currentRestaurant')}
                            </span>
                            <strong className="text-[#FAF9F6] font-bold tracking-wide">
                                {restaurant.name}
                            </strong>
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex items-center space-x-3 md:space-x-4">
                {isStaffUser && (
                    <span className="text-[#A3A3A3] text-sm hidden sm:block font-medium">
                        {currentUser.email}
                    </span>
                )}

                <button
                    onClick={() => setLanguage(language === 'ru' ? 'kz' : 'ru')}
                    className="flex items-center px-3 py-1.5 text-xs font-bold bg-transparent border border-[#4A4A4A] text-[#FAF9F6] rounded-md hover:border-[#E07A5F] hover:text-[#E07A5F] transition-all duration-300 uppercase tracking-widest"
                    title="Change language"
                >
                    {language}
                </button>

                {restaurant && (
                    <button
                        onClick={handleChangeRestaurant}
                        className="flex items-center px-3 py-1.5 text-xs md:text-sm font-semibold bg-transparent border border-[#4A4A4A] text-[#FAF9F6] rounded-md hover:border-[#E07A5F] hover:text-[#E07A5F] transition-all duration-300"
                        title="Change restaurant"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0v-4m0 4h5m0 0v-4m0 4H8m2-8l4-4 4 4m0 0l-4 4-4-4z" />
                        </svg>
                        <span className="ml-2 hidden lg:inline">{t('app.changeRestaurant')}</span>
                    </button>
                )}

                {isStaffUser ? (
                    <button
                        onClick={handleLogout}
                        className="flex items-center px-3 py-1.5 text-xs md:text-sm font-semibold bg-transparent border border-[#4A4A4A] text-[#FAF9F6] rounded-md hover:border-red-400 hover:text-red-400 transition-all duration-300"
                        title="Logout"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="ml-2 hidden sm:inline">{t('app.logout')}</span>
                    </button>
                ) : (
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center px-3 py-1.5 text-xs md:text-sm font-semibold bg-transparent border border-[#4A4A4A] text-[#FAF9F6] rounded-md hover:border-[#E07A5F] hover:text-[#E07A5F] transition-all duration-300"
                        title="Guest entrance"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        <span className="ml-2 hidden sm:inline">{t('login.loginAsGuest')}</span>
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
