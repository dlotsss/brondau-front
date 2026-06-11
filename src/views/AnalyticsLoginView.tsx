import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalyticsAuth } from '../context/AnalyticsAuthContext';
import { useData } from '../context/DataContext';

const AnalyticsLoginView: React.FC = () => {
  const { loginAnalytics, analyticsUser } = useAnalyticsAuth();
  const { getAdminRestaurants } = useData();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [restaurants, setRestaurants] = useState<{ id: string, name: string }[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('');
  const [showSelect, setShowSelect] = useState(false);

  useEffect(() => {
    if (analyticsUser) {
      navigate('/analytics/dashboard');
    }
  }, [analyticsUser, navigate]);

  const handleEmailBlur = async () => {
    if (!email) return;
    try {
      const list = await getAdminRestaurants(email, true);
      if (list && list.length > 0) {
        setRestaurants(list);
        setSelectedRestaurantId(list[0].id);
        setShowSelect(true);
        setError('');
      } else {
        setError('Для данного email не найдено доступных заведений');
        setShowSelect(false);
        setRestaurants([]);
      }
    } catch (err) {
      console.error(err);
      setError('Ошибка при проверке email');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    if (!selectedRestaurantId) {
      setError('Пожалуйста, выберите заведение');
      return;
    }

    setLoading(true);
    try {
      const user = await loginAnalytics(email, password, selectedRestaurantId, 'ADMIN');
      if (user) {
        navigate('/analytics/dashboard');
      } else {
        setError('Неверный пароль или доступ ограничен');
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0B0A] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#E07A5F]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#D4A373]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#1A1513] border border-[#2C2623] rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 backdrop-blur-xl animate-fade-in">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#E07A5F] to-[#D4A373] mb-4 shadow-lg shadow-[#E07A5F]/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-[#1A1513]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeD="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">BRONDAU CRM</h1>
          <p className="text-[#A59E9A] text-sm font-medium">Аналитический дашборд заведения</p>
        </div>

        {error && (
          <div className="bg-[#DF5A49]/10 border border-[#DF5A49]/30 text-[#DF5A49] px-4 py-3 rounded-xl text-sm mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          {/* Email input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#A59E9A]">
              Электронная почта
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              placeholder="admin@restaurant.com"
              className="w-full bg-[#120E0C] border border-[#2C2623] text-white px-4 py-3.5 rounded-xl focus:outline-none focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F] transition-all font-medium placeholder-[#57514E]"
              required
            />
          </div>

          {/* Restaurant select */}
          {showSelect && restaurants.length > 0 && (
            <div className="space-y-2 animate-slide-up">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#A59E9A]">
                Выберите заведение
              </label>
              <div className="relative">
                <select
                  value={selectedRestaurantId}
                  onChange={(e) => setSelectedRestaurantId(e.target.value)}
                  className="w-full bg-[#120E0C] border border-[#2C2623] text-white px-4 py-3.5 rounded-xl focus:outline-none focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F] transition-all font-medium appearance-none cursor-pointer"
                  required
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-[#A59E9A]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Password input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#A59E9A]">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#120E0C] border border-[#2C2623] text-white px-4 py-3.5 rounded-xl focus:outline-none focus:border-[#E07A5F] focus:ring-1 focus:ring-[#E07A5F] transition-all font-medium placeholder-[#57514E]"
              required
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-[#E07A5F] to-[#D4A373] text-[#1A1513] font-black uppercase text-sm tracking-wider py-4 rounded-xl shadow-lg hover:shadow-[#E07A5F]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-[#1A1513]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Проверка...</span>
              </>
            ) : (
              <span>Войти в систему</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AnalyticsLoginView;
