import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { useTranslation } from '../context/I18nContext';
import { UserRole } from '../types';

const LoginView: React.FC = () => {
  const { login } = useApp();
  const { getAdminRestaurants, getOwnerRestaurants } = useData();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();

  const [loginType, setLoginType] = useState<UserRole>('ADMIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [adminRestaurants, setAdminRestaurants] = useState<{ id: string, name: string }[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState('');
  const [showRestaurantSelect, setShowRestaurantSelect] = useState(false);

  useEffect(() => {
    setShowRestaurantSelect(false);
    setSelectedRestaurant('');
    setAdminRestaurants([]);
    setError('');
  }, [loginType, email]);

  const handleEmailCheck = async () => {
    if (!email) return;

    if (loginType === 'ADMIN') {
      const restaurants = await getAdminRestaurants(email);
      if (restaurants.length > 0) {
        setAdminRestaurants(restaurants);
        setShowRestaurantSelect(true);
        setSelectedRestaurant(restaurants[0].id);
      } else {
        setError(t('login.noAdminRestaurants'));
      }
    } else if (loginType === 'OWNER') {
      const restaurants = await getOwnerRestaurants(email);
      if (restaurants.length > 0) {
        setAdminRestaurants(restaurants); // Reusing the state for simplicity
        setShowRestaurantSelect(true);
        setSelectedRestaurant(restaurants[0].id);
      } else {
        setError(t('login.noOwnerAccess'));
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if ((loginType === 'ADMIN' || loginType === 'OWNER') && !selectedRestaurant) {
      setError(t('login.selectRestaurantError'));
      return;
    }

    const user = await login(loginType, email, password, selectedRestaurant);
    if (user) {
      navigate('/');
    } else {
      setError(t('login.invalidCredentials'));
    }
  };

  const roleLabels: Record<Exclude<UserRole, 'GUEST'>, string> = {
    ADMIN: t('login.roleAdmin'),
    OWNER: t('login.roleOwner')
  };

  return (
    <div className="min-h-screen bg-brand-secondary flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => setLanguage(language === 'ru' ? 'kz' : 'ru')}
          className="flex items-center px-3 py-2 text-sm font-bold bg-brand-accent text-white rounded-md hover:bg-brand-blue transition-colors duration-200 uppercase shadow-md border border-brand-primary"
          title="Change Language"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          {language}
        </button>
      </div>

      <div className="bg-brand-accent p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-3xl font-bold text-white text-center mb-2">{t('login.welcome')}</h1>
        <p className="text-center mb-6" style={{ color: '#f5efe6' }}>{t('login.chooseRole')}</p>

        <div className="flex gap-2 mb-6 rounded-md bg-brand-primary p-1">
          {(['ADMIN', 'OWNER'] as Exclude<UserRole, 'GUEST'>[]).map(role => (
            <button
              key={role}
              onClick={() => setLoginType(role)}
              className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${loginType === role
                ? 'bg-brand-blue text-white shadow'
                : 'hover:bg-brand-secondary'
                }`}
              style={{ color: loginType !== role ? '#f5efe6' : undefined }}
            >
              {roleLabels[role]}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            {error && <div className="bg-brand-red/20 text-brand-red p-3 rounded-md text-sm">{error}</div>}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#f5efe6' }}>{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailCheck}
                className="w-full bg-brand-primary p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                required
              />
            </div>

            {(loginType === 'ADMIN' || loginType === 'OWNER') && showRestaurantSelect && adminRestaurants.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#f5efe6' }}>{t('login.selectRestaurant')}</label>
                <select
                  value={selectedRestaurant}
                  onChange={(e) => setSelectedRestaurant(e.target.value)}
                  className="w-full bg-brand-primary p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-blue appearance-none"
                  required
                >
                  {adminRestaurants.map(restaurant => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#f5efe6' }}>{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-primary p-3 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-brand-blue text-white font-semibold py-3 rounded-md transition" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d5b483'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              {loginType === 'ADMIN' ? t('login.loginAsAdmin') : loginType === 'OWNER' ? t('login.loginAsOwner') : t('login.loginAsGuest')}
            </button>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
