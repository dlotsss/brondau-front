import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useTranslation } from '../context/I18nContext';
import { Booking, BookingStatus } from '../types';

interface FutureBookingsManagerProps {
    restaurantId: string;
    onEditBooking?: (booking: Booking) => void;
}

const STATUS_ORDER: Record<string, number> = {
    [BookingStatus.CONFIRMED]: 0,
    [BookingStatus.OCCUPIED]: 1,
    [BookingStatus.COMPLETED]: 2,
    [BookingStatus.DECLINED]: 3,
    [BookingStatus.CANCELLED]: 4,
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
    [BookingStatus.CONFIRMED]: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30', label: 'confirmed' },
    [BookingStatus.OCCUPIED]: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-400/40', label: 'occupied' },
    [BookingStatus.COMPLETED]: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: 'completed' },
    [BookingStatus.DECLINED]: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', label: 'declined' },
    [BookingStatus.CANCELLED]: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', label: 'cancelled' },
};

const FutureBookingsManager: React.FC<FutureBookingsManagerProps> = ({ restaurantId, onEditBooking }) => {
    const { getRestaurant, updateBookingStatus, loadBookings } = useData();
    const { t } = useTranslation();
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const restaurant = getRestaurant(restaurantId);

    useEffect(() => {
        if (restaurantId && selectedDate) {
            loadBookings(restaurantId, selectedDate);
        }
    }, [restaurantId, selectedDate, loadBookings]);

    const filteredBookings = useMemo(() => {
        if (!restaurant) return [];

        return restaurant.bookings
            .filter(b => {
                // Exclude PENDING
                if (b.status === BookingStatus.PENDING) return false;
                if (!selectedDate) return true;

                const bookingDate = new Date(b.dateTime).toISOString().split('T')[0];
                return bookingDate === selectedDate;
            })
            .sort((a, b) => {
                // CONFIRMED first, then by status order, then by time
                const orderA = STATUS_ORDER[a.status] ?? 99;
                const orderB = STATUS_ORDER[b.status] ?? 99;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
            });
    }, [restaurant, selectedDate]);

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

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

    const isActionable = (status: string) =>
        status === BookingStatus.CONFIRMED || status === BookingStatus.OCCUPIED;

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-primary p-4 rounded-xl border border-brand-accent/30 shadow-lg">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('futureBookings.title')}</h2>
                    <p className="text-sm text-gray-400">{t('futureBookings.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-sm text-gray-300 font-medium whitespace-nowrap">{t('futureBookings.selectDate')}</label>
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
                        const style = STATUS_STYLES[booking.status] || STATUS_STYLES[BookingStatus.DECLINED];
                        const isPast = booking.status === BookingStatus.CONFIRMED && new Date(booking.dateTime) < new Date();
                        return (
                            <div key={booking.id} className={`flex flex-col justify-between gap-4 p-4 rounded-xl border transition-all hover:shadow-xl ${style.bg} ${style.border} group`}>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-lg text-brand-blue group-hover:text-brand-blue transition-colors">
                                                    {booking.guestName}
                                                </h4>
                                                {onEditBooking && isActionable(booking.status) && (
                                                    <button
                                                        onClick={() => onEditBooking(booking)}
                                                        className="text-gray-400 hover:text-brand-blue transition-colors p-1"
                                                        title={t('admin.editBookingTitle')}
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-brand-blue font-mono font-medium">{booking.guestPhone}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-xs font-bold border border-brand-blue/20">
                                                {booking.guestCount} {t('futureBookings.guests')}
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.text} ${style.bg} border ${style.border}`}>
                                                {t(`futureBookings.status.${style.label}`)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-1 bg-black/20 p-3 rounded-lg border border-white/5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-white">{t('futureBookings.tableLabel')}</span>
                                            <span className="text-brand-blue font-bold">
                                                {booking.tableLabels?.length ? booking.tableLabels.join(', ') : (booking.tableLabel || t('admin.tableNotAssigned'))}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-white">{t('futureBookings.timeLabel')}</span>
                                            <span className="text-brand-blue font-bold">{formatDate(booking.dateTime)}</span>
                                        </div>
                                        {booking.assignedTo && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-white">{t('futureBookings.assignedTo')}</span>
                                                <span className="text-brand-blue font-bold">{booking.assignedTo}</span>
                                            </div>
                                        )}
                                    </div>

                                    {booking.guestComment && (
                                        <div className="bg-brand-accent/30 p-2 rounded border border-white/5 italic text-xs text-gray-700">
                                            "{booking.guestComment}"
                                        </div>
                                    )}

                                    {isPast && (
                                        <div className="py-1 px-2 bg-brand-red text-white text-[10px] font-bold rounded inline-block animate-pulse uppercase">
                                            {t('admin.late')}
                                        </div>
                                    )}

                                    {booking.status === BookingStatus.DECLINED && booking.declineReason && (
                                        <div className="text-xs text-gray-700 italic">
                                            {t('futureBookings.reason')}: {booking.declineReason}
                                        </div>
                                    )}
                                    {booking.status === BookingStatus.CANCELLED && booking.cancelReason && (
                                        <div className="text-xs text-gray-700 italic">
                                            {t('futureBookings.reason')}: {booking.cancelReason}
                                            {booking.cancelComment && ` — ${booking.cancelComment}`}
                                        </div>
                                    )}
                                </div>

                                {isActionable(booking.status) && (
                                    <div className="flex gap-2 pt-2 border-t border-white/5">
                                        {booking.status === BookingStatus.CONFIRMED && (
                                            <button
                                                onClick={() => updateBookingStatus(booking.id, BookingStatus.OCCUPIED)}
                                                className="flex-1 bg-brand-green text-white py-2.5 rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg"
                                            >
                                                {t('admin.arrived')}
                                            </button>
                                        )}
                                        {booking.status === BookingStatus.OCCUPIED && (
                                            <button
                                                onClick={() => updateBookingStatus(booking.id, BookingStatus.COMPLETED)}
                                                className="flex-1 bg-brand-blue text-white py-2.5 rounded-lg text-sm font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg"
                                            >
                                                {t('admin.freeTable')}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (window.confirm(t('admin.cancelBookingConfirm'))) {
                                                    updateBookingStatus(booking.id, BookingStatus.DECLINED, t('admin.cancelledByAdmin'));
                                                }
                                            }}
                                            className="px-4 py-2.5 bg-brand-red/10 text-brand-red border border-brand-red/30 rounded-lg text-sm font-bold hover:bg-brand-red hover:text-white transition-all"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 text-center bg-brand-primary rounded-2xl border border-dashed border-brand-accent/30 opacity-50">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-lg font-medium text-gray-400">{t('futureBookings.noBookingsFound')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FutureBookingsManager;
