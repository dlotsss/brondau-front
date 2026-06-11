import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalyticsAuth } from '../context/AnalyticsAuthContext';
import { useData } from '../context/DataContext';
import { api } from '../services/api';
import { Booking } from '../types';
import { calculateMetrics, AnalyticsMetrics } from '../utils/analyticsCalc';

type PeriodType = 'today' | 'week' | 'month' | '90days';

const AnalyticsDashboardView: React.FC = () => {
  const { analyticsUser, logoutAnalytics } = useAnalyticsAuth();
  const { getRestaurant, loadRestaurants, restaurants, isLoading: dataLoading } = useData();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodType>('week');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!analyticsUser) {
      navigate('/analytics');
    }
  }, [analyticsUser, navigate]);

  // Load restaurants if not loaded
  useEffect(() => {
    if (restaurants.length === 0 && !dataLoading) {
      loadRestaurants();
    }
  }, [restaurants, dataLoading, loadRestaurants]);

  // Selected restaurant details
  const restaurant = useMemo(() => {
    if (!analyticsUser?.restaurantId) return null;
    return getRestaurant(analyticsUser.restaurantId);
  }, [analyticsUser, getRestaurant, restaurants]);

  // Helper to format date to database timestamp string (YYYY-MM-DD HH:mm:ss)
  const formatToDbTimestamp = (date: Date) => {
    const pad = (num: number) => String(num).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  };

  // Calculate start/end dates for API requests
  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    } else if (period === '90days') {
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
    }

    // For Guest CRM, fetch 90 extra days before the start date
    const historyStart = new Date(start);
    historyStart.setDate(historyStart.getDate() - 90);
    historyStart.setHours(0, 0, 0, 0);

    // Calculate days count in active period
    const msDiff = end.getTime() - start.getTime();
    const daysCount = Math.max(1, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));

    return {
      start,
      end,
      historyStart,
      daysCount
    };
  }, [period]);

  // Fetch bookings data
  useEffect(() => {
    if (!analyticsUser?.restaurantId) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const fromStr = formatToDbTimestamp(dateRange.historyStart);
        const toStr = formatToDbTimestamp(dateRange.end);
        
        const data = await api.restaurants.getBookingsRange(
          analyticsUser.restaurantId,
          fromStr,
          toStr
        );

        // Map database fields to camelCase Booking interface
        const mappedBookings: Booking[] = data.map((b: any) => ({
          id: b.id,
          restaurantId: b.restaurant_id,
          tableId: b.table_id,
          tableLabel: b.table_label,
          tableIds: b.tableIds || (b.table_id ? [b.table_id] : []),
          tableLabels: b.tableLabels || (b.table_label ? [b.table_label] : []),
          guestName: b.guest_name,
          guestPhone: b.guest_phone,
          guestEmail: b.guest_email,
          guestCount: Number(b.guest_count),
          status: b.status,
          declineReason: b.decline_reason,
          cancelReason: b.cancel_reason,
          cancelComment: b.cancel_comment,
          cancelledBy: b.cancelled_by,
          cancelledAt: b.cancelled_at ? new Date(b.cancelled_at) : undefined,
          guestComment: b.guest_comment,
          duration: Number(b.duration || 120),
          assignedTo: b.assigned_to,
          dateTime: new Date(b.date_time),
          deadlineAt: b.deadline_at ? new Date(b.deadline_at) : undefined,
          createdAt: new Date(b.created_at),
          updatedAt: b.updated_at ? new Date(b.updated_at) : undefined
        }));

        setBookings(mappedBookings);
      } catch (err: any) {
        console.error(err);
        setError('Не удалось загрузить данные аналитики. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [analyticsUser, dateRange]);

  // Split bookings into current active and historical ones
  const splitBookings = useMemo(() => {
    const active: Booking[] = [];
    const historical: Booking[] = [];

    bookings.forEach((b) => {
      if (b.dateTime >= dateRange.start) {
        active.push(b);
      } else {
        historical.push(b);
      }
    });

    return { active, historical };
  }, [bookings, dateRange]);

  // Calculate metrics
  const metrics = useMemo<AnalyticsMetrics | null>(() => {
    if (!restaurant) return null;
    return calculateMetrics(
      splitBookings.active,
      splitBookings.historical,
      restaurant.layout || [],
      dateRange.daysCount
    );
  }, [restaurant, splitBookings, dateRange]);

  const handleLogout = () => {
    logoutAnalytics();
    navigate('/analytics');
  };

  const periodLabels = {
    today: 'Сегодня',
    week: '7 дней',
    month: '30 дней',
    '90days': '90 дней'
  };

  if (!analyticsUser) return null;

  return (
    <div className="min-h-screen bg-[#0C0B0A] text-white font-sans selection:bg-[#E07A5F]/30 pb-12 custom-scrollbar">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#120E0C]/85 backdrop-blur-md border-b border-[#2C2623] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E07A5F] to-[#D4A373] flex items-center justify-center shadow-lg shadow-[#E07A5F]/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#1A1513]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeD="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white uppercase leading-none">
              {analyticsUser.restaurantName}
            </h1>
            <p className="text-[#A59E9A] text-xs font-semibold mt-1">
              Администратор: <span className="text-[#D4A373]">{analyticsUser.managerName || analyticsUser.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Period selector */}
          <div className="flex bg-[#1A1513] border border-[#2C2623] p-1 rounded-xl">
            {(['today', 'week', 'month', '90days'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                  period === p
                    ? 'bg-[#E07A5F] text-[#1A1513] shadow-md shadow-[#E07A5F]/10'
                    : 'text-[#A59E9A] hover:text-white'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2.5 rounded-xl border border-[#2C2623] bg-[#1A1513] text-[#A59E9A] hover:text-[#E07A5F] hover:border-[#E07A5F]/30 transition-all shadow-md"
            title="Выйти из CRM"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        {error && (
          <div className="bg-[#DF5A49]/10 border border-[#DF5A49]/30 text-[#DF5A49] px-6 py-4 rounded-2xl mb-8 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {loading || dataLoading ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-[#2C2623]" />
              <div className="absolute inset-0 rounded-full border-4 border-t-[#E07A5F] animate-spin" />
            </div>
            <p className="text-[#A59E9A] text-sm font-bold uppercase tracking-widest animate-pulse">Загрузка аналитики...</p>
          </div>
        ) : metrics ? (
          <div className="space-y-8">
            
            {/* BLOCK 1: Bookings & Occupancy */}
            <section className="bg-[#1A1513] border border-[#2C2623] rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 rounded-xl bg-[#E07A5F]/10 text-[#E07A5F]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider">Загрузка и Бронирования</h2>
                  <p className="text-[#A59E9A] text-xs font-semibold">Показатели посещаемости и плотности посадки</p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                  <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Брони всего</p>
                  <p className="text-3xl font-black text-white">{metrics.totalBookings}</p>
                </div>
                
                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                  <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Посажено гостей</p>
                  <p className="text-3xl font-black text-white">{metrics.totalSeatedGuests}</p>
                </div>

                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                  <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Заполняемость</p>
                  <p className="text-3xl font-black text-[#D4A373]">{metrics.occupancyRate.toFixed(1)}%</p>
                </div>

                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                  <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Уровень No-Show</p>
                  <p className={`text-3xl font-black ${metrics.noShowRate > 10 ? 'text-[#DF5A49]' : 'text-[#81B29A]'}`}>
                    {metrics.noShowRate.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl col-span-2 md:col-span-1">
                  <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Уровень отмен</p>
                  <p className="text-3xl font-black text-white">{metrics.cancellationRate.toFixed(1)}%</p>
                </div>
              </div>

              {/* CSS Bar Chart for Occupancy */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#A59E9A] mb-6">Средняя загрузка по часам (%)</h3>
                <div className="bg-[#120E0C] border border-[#2C2623] rounded-2xl p-6">
                  <div className="h-48 flex items-end justify-between gap-2 border-b border-[#2C2623] pb-2 relative">
                    {/* Y-axis gridlines */}
                    <div className="absolute left-0 right-0 top-0 border-t border-[#2C2623]/30 pointer-events-none" />
                    <div className="absolute left-0 right-0 top-1/4 border-t border-[#2C2623]/30 pointer-events-none" />
                    <div className="absolute left-0 right-0 top-1/2 border-t border-[#2C2623]/30 pointer-events-none" />
                    <div className="absolute left-0 right-0 top-3/4 border-t border-[#2C2623]/30 pointer-events-none" />

                    {metrics.hourlyOccupancy.map((item) => {
                      const maxRate = Math.max(...metrics.hourlyOccupancy.map(h => h.rate)) || 1;
                      const heightPct = (item.rate / maxRate) * 100;
                      return (
                        <div key={item.hour} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                          {/* Tooltip */}
                          <div className="absolute z-10 bottom-full mb-2 bg-[#E07A5F] text-[#1A1513] font-black text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            {item.rate.toFixed(1)}%
                          </div>
                          
                          {/* Bar */}
                          <div 
                            className="w-full max-w-[24px] rounded-t-md bg-gradient-to-t from-[#E07A5F]/60 to-[#E07A5F] group-hover:from-[#E07A5F] group-hover:to-[#D4A373] transition-all"
                            style={{ height: `${Math.max(4, heightPct)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* X-axis labels */}
                  <div className="flex justify-between mt-3 text-[10px] font-bold text-[#A59E9A] px-1.5">
                    {metrics.hourlyOccupancy.map((item) => (
                      <span key={item.hour} className="flex-1 text-center max-w-[24px]">
                        {item.hour}:00
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Grid for Block 2 & 3 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* BLOCK 2: Guest CRM & Loyalty */}
              <section className="bg-[#1A1513] border border-[#2C2623] rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-xl bg-[#D4A373]/10 text-[#D4A373]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider">Гостевой Анализ & CRM</h2>
                      <p className="text-[#A59E9A] text-xs font-semibold">Удержание клиентов и соотношение новых/повторных</p>
                    </div>
                  </div>

                  {/* Top row: 4 KPI cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-[#120E0C] border border-[#2C2623] p-4 rounded-2xl">
                      <p className="text-[#A59E9A] text-[9px] font-black uppercase tracking-wider mb-2">Уникальных гостей</p>
                      <p className="text-2xl font-black text-white">{metrics.uniqueGuestsCount}</p>
                      <p className="text-[#A59E9A] text-[10px] mt-1">за период</p>
                    </div>

                    <div className="bg-[#120E0C] border border-[#2C2623] p-4 rounded-2xl">
                      <p className="text-[#A59E9A] text-[9px] font-black uppercase tracking-wider mb-2">Новые гости</p>
                      <p className="text-2xl font-black text-white">{metrics.newGuestsCount}</p>
                      <p className="text-[#A59E9A] text-[10px] mt-1">({metrics.newGuestPercentage.toFixed(0)}%) впервые</p>
                    </div>

                    <div className="bg-[#120E0C] border border-[#2C2623] p-4 rounded-2xl">
                      <p className="text-[#A59E9A] text-[9px] font-black uppercase tracking-wider mb-2">Возвратные</p>
                      <p className="text-2xl font-black text-[#D4A373]">{metrics.returningGuestsCount}</p>
                      <p className="text-[#A59E9A] text-[10px] mt-1">({metrics.retentionRate.toFixed(0)}%) были раньше</p>
                    </div>

                    <div className="bg-[#120E0C] border border-[#2C2623] p-4 rounded-2xl">
                      <p className="text-[#A59E9A] text-[9px] font-black uppercase tracking-wider mb-2">Повторили в периоде</p>
                      <p className="text-2xl font-black text-[#81B29A]">{metrics.repeatWithinPeriod}</p>
                      <p className="text-[#A59E9A] text-[10px] mt-1">2+ визита подряд</p>
                    </div>
                  </div>

                  {/* Loyalty Ratio Bar */}
                  <div className="bg-[#120E0C] border border-[#2C2623] rounded-2xl p-6 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A]">Соотношение гостей (vs. история −90 дней)</h3>
                      <span className="text-[#E07A5F] text-xs font-black">{metrics.retentionRate.toFixed(1)}% Retention</span>
                    </div>
                    <div className="h-6 w-full bg-[#2C2623] rounded-full overflow-hidden flex">
                      <div 
                        className="bg-[#E07A5F] h-full transition-all duration-700 relative"
                        style={{ width: `${metrics.newGuestPercentage}%` }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#1A1513]">
                          {metrics.newGuestPercentage > 15 && `${metrics.newGuestPercentage.toFixed(0)}% Новые`}
                        </div>
                      </div>
                      <div 
                        className="bg-[#D4A373] h-full transition-all duration-700 relative"
                        style={{ width: `${metrics.retentionRate}%` }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[#1A1513]">
                          {metrics.retentionRate > 15 && `${metrics.retentionRate.toFixed(0)}% Возвратные`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-[10px] font-bold text-[#A59E9A]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E07A5F]" />
                        <span>Новые (нет истории за 90 дней до периода)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#D4A373]" />
                        <span>Возвратные (были раньше)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-[#A59E9A] italic border-t border-[#2C2623]/50 pt-4 mt-4">
                  * Идентификация гостей — по телефону (нормализация ±7/8). «Возвратные» — гости из текущего периода, чей телефон встречался в базе за 90 дней ДО начала периода. «Повторили в периоде» — гости с 2+ бронями внутри выбранного диапазона.
                </div>
              </section>

              {/* BLOCK 3: Operational Efficiency */}
              <section className="bg-[#1A1513] border border-[#2C2623] rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2.5 rounded-xl bg-[#81B29A]/10 text-[#81B29A]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider">Эффективность Операций</h2>
                      <p className="text-[#A59E9A] text-xs font-semibold">Оборачиваемость столов и пиковая загрузка кухни</p>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                      <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Оборачиваемость столов</p>
                      <p className="text-3xl font-black text-white">{metrics.tableTurnoverRate.toFixed(2)}</p>
                      <p className="text-[#A59E9A] text-[10px] mt-1">броней на стол в день</p>
                    </div>

                    <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                      <p className="text-[#A59E9A] text-[10px] font-black uppercase tracking-wider mb-2">Пиковый час</p>
                      <p className="text-2xl font-black text-[#81B29A] mt-1">{metrics.peakHour}</p>
                      <p className="text-[#A59E9A] text-[10px] mt-1">максимум входящих</p>
                    </div>
                  </div>

                  {/* CSS Bar Chart for Booking Counts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A] mb-4">Бронирования по часам (шт.)</h3>
                    <div className="bg-[#120E0C] border border-[#2C2623] rounded-2xl p-4">
                      <div className="h-28 flex items-end justify-between gap-1.5 border-b border-[#2C2623] pb-1 relative">
                        {metrics.hourlyBookingCounts.map((item) => {
                          const maxCount = Math.max(...metrics.hourlyBookingCounts.map(h => h.count)) || 1;
                          const heightPct = (item.count / maxCount) * 100;
                          return (
                            <div key={item.hour} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                              {/* Tooltip */}
                              <div className="absolute z-10 bottom-full mb-1.5 bg-[#81B29A] text-[#1A1513] font-black text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                {item.count} бр.
                              </div>
                              
                              {/* Bar */}
                              <div 
                                className="w-full max-w-[20px] rounded-t-sm bg-[#81B29A]/50 group-hover:bg-[#81B29A] transition-all"
                                style={{ height: `${Math.max(5, heightPct)}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* X-axis labels */}
                      <div className="flex justify-between mt-2 text-[9px] font-bold text-[#A59E9A] px-1">
                        {metrics.hourlyBookingCounts.map((item) => (
                          <span key={item.hour} className="flex-1 text-center max-w-[20px]">
                            {item.hour}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-[#A59E9A] mt-6 flex justify-between items-center border-t border-[#2C2623]/50 pt-4">
                  <span>Общая вместимость зала: {restaurant?.layout.filter(el => el.type === 'table').length || 0} столов</span>
                </div>
              </section>

            </div>

            {/* NEW GRID: Additional Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* BLOCK 4: Guest Behavior (Lead Time & Company Sizes) */}
              <section className="bg-[#1A1513] border border-[#2C2623] rounded-3xl p-6 md:p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 rounded-xl bg-[#E07A5F]/10 text-[#E07A5F]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-wider">Поведение гостей</h2>
                    <p className="text-[#A59E9A] text-xs font-semibold">Глубина броней (Lead Time) и размер компаний</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Lead Time */}
                  <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A]">Глубина бронирования</h3>
                      <span className="text-[#E07A5F] text-xs font-black">
                        Средняя: {metrics.avgLeadTimeHours < 24 
                          ? `${metrics.avgLeadTimeHours.toFixed(1)} ч.` 
                          : `${(metrics.avgLeadTimeHours / 24).toFixed(1)} дн.`}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {metrics.leadTimeDistribution.map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-white font-medium">{item.label}</span>
                            <span className="text-[#A59E9A] font-bold">{item.count} бр. ({item.percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 w-full bg-[#2C2623] rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-[#E07A5F] to-[#D4A373] h-full rounded-full transition-all duration-500" 
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Group Size */}
                  <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A] mb-4">Размер компании (распределение)</h3>
                    <div className="space-y-3">
                      {metrics.companySizeDistribution.map((item) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-white font-medium">{item.label}</span>
                            <span className="text-[#A59E9A] font-bold">{item.count} бр. ({item.percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="h-2 w-full bg-[#2C2623] rounded-full overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-[#81B29A] to-[#E07A5F] h-full rounded-full transition-all duration-500" 
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* BLOCK 5: Top Guests (Loyalty Rating) */}
              <section className="bg-[#1A1513] border border-[#2C2623] rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-[#D4A373]/10 text-[#D4A373]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-wider">Рейтинг Лояльности (Топ-15)</h2>
                      <p className="text-[#A59E9A] text-xs font-semibold">Гости с наибольшим количеством бронирований</p>
                    </div>
                  </div>

                  <div className="bg-[#120E0C] border border-[#2C2623] rounded-2xl overflow-hidden">
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                      {metrics.topGuests.length === 0 ? (
                        <div className="p-8 text-center text-[#A59E9A] text-sm">Нет данных о гостях</div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#2C2623] bg-[#1A1513]/50 text-[#A59E9A] text-[10px] font-black uppercase tracking-wider sticky top-0">
                              <th className="py-3 px-4 w-12 text-center">#</th>
                              <th className="py-3 px-4">Имя</th>
                              <th className="py-3 px-4">Телефон</th>
                              <th className="py-3 px-4 text-center">Брони</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2C2623]/40 text-xs">
                            {metrics.topGuests.map((guest, idx) => (
                              <tr key={guest.phone} className="hover:bg-[#1C1715]/40 transition-colors">
                                <td className="py-2.5 px-4 text-center font-black text-[#D4A373]">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-white truncate max-w-[120px]" title={guest.name}>
                                  {guest.name}
                                </td>
                                <td className="py-2.5 px-4 text-[#A59E9A] font-mono">
                                  {guest.phone}
                                </td>
                                <td className="py-2.5 px-4 text-center font-black text-[#81B29A]">
                                  {guest.count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-[#A59E9A] italic mt-4 pt-3 border-t border-[#2C2623]/30">
                  * Рейтинг составляется по числу бронирований за весь выбранный период.
                </div>
              </section>

            </div>

            {/* BLOCK 6: Staff and Cancellations */}
            <section className="bg-[#1A1513] border border-[#2C2623] rounded-3xl p-6 md:p-8 shadow-2xl">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2.5 rounded-xl bg-[#81B29A]/10 text-[#81B29A]">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider">Персонал и Отмены</h2>
                  <p className="text-[#A59E9A] text-xs font-semibold">Анализ причин отмен, распределение нагрузки и план/факт времени</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Cancellation Reasons */}
                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A] mb-4">Причины отмен / отклонений</h3>
                  {metrics.cancellationReasons.length === 0 ? (
                    <div className="text-center text-[#A59E9A] text-xs py-4">Нет отмененных броней за период</div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar">
                      {metrics.cancellationReasons.map((item) => (
                        <div key={item.reason}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white font-medium truncate max-w-[180px]" title={item.reason}>{item.reason}</span>
                            <span className="text-[#A59E9A] font-bold shrink-0">{item.count} ({item.percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#2C2623] rounded-full overflow-hidden">
                            <div 
                              className="bg-[#DF5A49] h-full rounded-full transition-all duration-500" 
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Admin Workload */}
                <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A] mb-4">Нагрузка на администраторов</h3>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {metrics.adminWorkload.map((item) => (
                      <div key={item.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white font-medium truncate max-w-[180px]" title={item.name}>{item.name}</span>
                          <span className="text-[#A59E9A] font-bold shrink-0">{item.count} бр. ({item.percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#2C2623] rounded-full overflow-hidden">
                          <div 
                            className="bg-[#81B29A] h-full rounded-full transition-all duration-500" 
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Plan/Fact Seating Duration */}
              <div className="bg-[#120E0C] border border-[#2C2623] p-5 rounded-2xl">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#A59E9A] mb-4">План / Факт времени посадки</h3>

                {metrics.avgActualDuration === 0 ? (
                  <div className="text-center text-[#A59E9A] text-xs py-4">Нет завершенных визитов для расчета фактического времени</div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-[#1C1715] p-3 rounded-xl border border-[#2C2623]/50">
                        <span className="text-[10px] text-[#A59E9A] font-black uppercase tracking-wider block mb-1">Запланировано</span>
                        <span className="text-xl font-black text-white">{(metrics.avgPlanDuration / 60).toFixed(1)} ч.</span>
                        <span className="text-[10px] text-[#A59E9A] block mt-0.5">({metrics.avgPlanDuration.toFixed(0)} мин)</span>
                      </div>
                      <div className="bg-[#1C1715] p-3 rounded-xl border border-[#2C2623]/50">
                        <span className="text-[10px] text-[#A59E9A] font-black uppercase tracking-wider block mb-1">Фактически</span>
                        <span className="text-xl font-black text-[#81B29A]">{(metrics.avgActualDuration / 60).toFixed(1)} ч.</span>
                        <span className="text-[10px] text-[#A59E9A] block mt-0.5">({metrics.avgActualDuration.toFixed(0)} мин)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-col sm:flex-row justify-between text-xs mb-2 gap-1 font-bold text-[#A59E9A]">
                        <span>Использование стола: {((metrics.avgActualDuration / metrics.avgPlanDuration) * 100).toFixed(0)}% от запланированного времени</span>
                        <span className={metrics.avgActualDuration > metrics.avgPlanDuration ? "text-[#DF5A49]" : "text-[#81B29A]"}>
                          {metrics.avgActualDuration > metrics.avgPlanDuration 
                            ? `В среднем пересидели на +${(metrics.avgActualDuration - metrics.avgPlanDuration).toFixed(0)} мин`
                            : `В среднем освободили на ${(metrics.avgPlanDuration - metrics.avgActualDuration).toFixed(0)} мин раньше`}
                        </span>
                      </div>
                      <div className="h-4 w-full bg-[#2C2623] rounded-full overflow-hidden flex p-0.5">
                        <div 
                          className="bg-[#E07A5F] h-full rounded-l-full transition-all" 
                          style={{ width: `${Math.min(100, (metrics.avgPlanDuration / Math.max(metrics.avgPlanDuration, metrics.avgActualDuration)) * 100)}%` }}
                        />
                        <div 
                          className={`h-full rounded-r-full transition-all ${metrics.avgActualDuration > metrics.avgPlanDuration ? 'bg-[#DF5A49]' : 'bg-[#81B29A]'}`}
                          style={{ width: `${Math.min(100, (Math.abs(metrics.avgActualDuration - metrics.avgPlanDuration) / Math.max(metrics.avgPlanDuration, metrics.avgActualDuration)) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[9px] font-bold text-[#A59E9A]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#E07A5F]" />
                          <span>Запланированное время</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#81B29A]" />
                          <span>Раньше срока (факт &lt; план)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#DF5A49]" />
                          <span>Превышение лимита (факт &gt; план)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

          </div>
        ) : (
          <div className="min-h-[400px] flex flex-col items-center justify-center">
            <p className="text-[#A59E9A] font-bold uppercase tracking-wider">Не удалось рассчитать метрики</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AnalyticsDashboardView;
