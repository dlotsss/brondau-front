import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Booking, BookingStatus } from '../types';

interface FutureBookingsManagerProps {
    restaurantId: string;
}

const FutureBookingsManager: React.FC<FutureBookingsManagerProps> = ({ restaurantId }) => {
    const { getRestaurant, updateBookingStatus } = useData();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    
    const restaurant = getRestaurant(restaurantId);
    
    const filteredBookings = useMemo(() => {
        if (!restaurant) return [];
        
        return restaurant.bookings
            .filter(b => {
                if (b.status !== BookingStatus.CONFIRMED) return false;
                if (!selectedDate) return true;
                
                const bookingDate = new Date(b.dateTime).toISOString().split('T')[0];
                return bookingDate === selectedDate;
            })
            .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    }, [restaurant, selectedDate]);

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (!restaurant) return null;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-primary p-4 rounded-xl border border-brand-accent/30 shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-white">Будущие бронирования</h2>
                    <p className="text-sm text-gray-400">Список всех подтвержденных броней на выбранную дату</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-sm text-gray-300 font-medium whitespace-nowrap">Выбрать дату:</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-brand-accent text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-brand-blue outline-none transition-all w-full"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBookings.length > 0 ? (
                    filteredBookings.map(booking => {
                        const isPast = new Date(booking.dateTime) < new Date();
                        return (
                            <div key={booking.id} className={`flex flex-col justify-between gap-4 p-4 rounded-xl border transition-all hover:shadow-xl ${isPast ? 'bg-brand-red/5 border-brand-red/20' : 'bg-brand-primary border-brand-accent/50'} group`}>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-lg text-white group-hover:text-brand-blue transition-colors">
                                                {booking.guestName}
                                            </h4>
                                            <p className="text-brand-blue font-mono font-medium">{booking.guestPhone}</p>
                                        </div>
                                        <div className="bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-xs font-bold border border-brand-blue/20">
                                            {booking.guestCount} гостей
                                        </div>
                                    </div>

                                    <div className="space-y-1 bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-400">Столик:</span>
                                            <span className="text-white font-bold">
                                                {booking.tableLabels?.length ? booking.tableLabels.join(', ') : (booking.tableLabel || 'Не назначен')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-400">Время:</span>
                                            <span className="text-white font-bold">{formatDate(booking.dateTime)}</span>
                                        </div>
                                    </div>

                                    {booking.guestComment && (
                                        <div className="bg-brand-accent/30 p-2 rounded border border-white/5 italic text-xs text-gray-300">
                                            "{booking.guestComment}"
                                        </div>
                                    )}

                                    {isPast && (
                                        <div className="py-1 px-2 bg-brand-red text-white text-[10px] font-bold rounded inline-block animate-pulse uppercase">
                                            Опоздание
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-white/5">
                                    <button
                                        onClick={() => updateBookingStatus(booking.id, BookingStatus.OCCUPIED)}
                                        className="flex-1 bg-brand-green text-white py-2.5 rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg"
                                    >
                                        Пришли
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Отменить это бронирование?')) {
                                                updateBookingStatus(booking.id, BookingStatus.DECLINED, "Отменено администратором");
                                            }
                                        }}
                                        className="px-4 py-2.5 bg-brand-red/10 text-brand-red border border-brand-red/30 rounded-lg text-sm font-bold hover:bg-brand-red hover:text-white transition-all"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 text-center bg-brand-primary rounded-2xl border border-dashed border-brand-accent/30 opacity-50">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-400">На этот день бронирований не найдено</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FutureBookingsManager;
