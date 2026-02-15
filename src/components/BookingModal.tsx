import React, { useState, useEffect, useMemo } from 'react';
import { BookingStatus, TableElement } from '../types';
import { useData } from '../context/DataContext';
import { subscribeToPush } from '../services/pushService';

const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

interface BookingModalProps {
    table: TableElement;
    restaurantId: string;
    onClose: () => void;
    isAdmin?: boolean; // <-- ДОБАВЛЕНО
}

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    const limitedDigits = digits.slice(0, 11);
    const normalizedDigits = limitedDigits.startsWith('8')
        ? '7' + limitedDigits.slice(1)
        : limitedDigits;

    if (normalizedDigits.length === 0) return '';
    if (normalizedDigits.length <= 1) return `+${normalizedDigits}`;
    if (normalizedDigits.length <= 4) return `+${normalizedDigits[0]} (${normalizedDigits.slice(1)}`;
    if (normalizedDigits.length <= 7) return `+${normalizedDigits[0]} (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4)}`;
    if (normalizedDigits.length <= 9) return `+${normalizedDigits[0]} (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7)}`;
    return `+${normalizedDigits[0]} (${normalizedDigits.slice(1, 4)}) ${normalizedDigits.slice(4, 7)}-${normalizedDigits.slice(7, 9)}-${normalizedDigits.slice(9, 11)}`;
};

const BookingModal: React.FC<BookingModalProps> = ({ table, restaurantId, onClose, isAdmin = false }) => {
    const { addBooking, getRestaurant } = useData();
    const [guestName, setGuestName] = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [guestCount, setGuestCount] = useState<number>(2);

    const restaurant = getRestaurant(restaurantId);
    const workStarts = restaurant?.workStarts || '10:00';
    const workEnds = restaurant?.workEnds || '23:00';

    const [bookingDate, setBookingDate] = useState(formatLocalDate(new Date()));
    const [bookingTime, setBookingTime] = useState('');
    const [error, setError] = useState('');

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setGuestPhone(formatted);
    };

    // Генерируем слоты ТОЛЬКО если это не Админ. Админу слоты не нужны, он вводит время вручную.
    const availableSlots = useMemo(() => {
        if (isAdmin) return []; // Админу не нужен этот расчет

        const slots: string[] = [];
        const startMins = parseTime(workStarts);
        let endMins = parseTime(workEnds);

        if (endMins <= startMins) {
            endMins += 24 * 60;
        }

        const now = new Date();
        const [year, month, day] = bookingDate.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const isToday = selectedDate.toDateString() === now.toDateString();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        const minBookingMins = isToday ? currentMins + 15 : 0;

        const shiftStart = new Date(selectedDate);
        shiftStart.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
        const shiftEnd = new Date(selectedDate);
        shiftEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);

        const bookingsOnShift = restaurant?.bookings.filter(b => {
            if (b.tableId !== table.id) return false;
            if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.OCCUPIED && b.status !== BookingStatus.PENDING) return false;
            return b.dateTime >= shiftStart && b.dateTime < shiftEnd;
        }) || [];

        const bookingMinsList = bookingsOnShift.map(b => {
            const bDate = new Date(b.dateTime);
            let bMins = bDate.getHours() * 60 + bDate.getMinutes();
            if (bMins < startMins) bMins += 24 * 60;
            return bMins;
        });

        for (let time = startMins; time <= endMins - 60; time += 30) {
            if (isToday && time < minBookingMins) continue;
            const isBlockedByEarlierBooking = bookingMinsList.some(bm => bm <= time);
            if (isBlockedByEarlierBooking) continue;
            const hasConflict = bookingMinsList.some(bm => Math.abs(time - bm) < 60);
            if (hasConflict) continue;

            const h = Math.floor(time / 60) % 24;
            const m = time % 60;
            const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            slots.push(timeString);
        }

        return slots;
    }, [bookingDate, restaurant?.bookings, table.id, workStarts, workEnds, isAdmin]);

    useEffect(() => {
        if (!isAdmin) {
            if (availableSlots.length > 0) {
                if (!bookingTime || !availableSlots.includes(bookingTime)) {
                    setBookingTime(availableSlots[0]);
                }
            } else {
                setBookingTime('');
            }
        } else if (!bookingTime) {
            // Для админа по умолчанию ставим текущее время
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            setBookingTime(timeStr);
        }
    }, [availableSlots, bookingTime, isAdmin]);

    const formatBookingSlot = (date: Date) =>
        new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(date);

    const visualBookings = restaurant?.bookings
        .filter(booking =>
            booking.tableId === table.id &&
            (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) &&
            booking.dateTime.getTime() >= Date.now()
        )
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()) || [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Для админа телефон не обязателен
        if (!isAdmin && (!guestName || !guestPhone)) {
            setError('Пожалуйста, введите ваше имя и номер телефона.');
            return;
        }

        const phoneDigits = guestPhone.replace(/\D/g, '');
        if (!isAdmin && phoneDigits.length !== 11) {
            setError('Пожалуйста, введите корректный номер телефона: +7 (XXX) XXX-XX-XX');
            return;
        }
        if (guestCount > table.seats) {
            setError(`Этот столик вмещает не более ${table.seats} гостей.`);
            return;
        }
        if (!bookingTime) {
            setError('Не выбрано время.');
            return;
        }

        const [h, m] = bookingTime.split(':').map(Number);
        const dateTime = new Date(bookingDate);
        dateTime.setHours(h, m, 0, 0);

        // Корректировка даты для ночных смен (если время меньше времени открытия)
        const workStartH = parseInt(workStarts.split(':')[0]);
        if (h < workStartH && parseTime(bookingTime) < parseTime(workStarts)) {
            dateTime.setDate(dateTime.getDate() + 1);
        }

        try {
            await addBooking(restaurantId, {
                tableId: table.id,
                guestName: guestName || (isAdmin ? "Гость (Walk-in)" : ""),
                guestPhone,
                guestCount,
                dateTime,
                timezoneOffset: dateTime.getTimezoneOffset(),
                isAdmin
            });

            if (!isAdmin) {
                const normalizedPhone = guestPhone.replace(/\D/g, '');
                subscribeToPush('GUEST', undefined, normalizedPhone);
            }

            alert(isAdmin ? 'Столик успешно занят!' : 'Ваш запрос на бронирование отправлен!');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать бронирование.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300 p-2 sm:p-4">
            <div className="bg-brand-secondary rounded-lg shadow-2xl p-6 w-full max-w-lg m-auto transform transition-all duration-300 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-brand-secondary pb-2 border-b border-brand-accent/30 z-10">
                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#2c1f14' }}>
                        {isAdmin ? 'Посадить гостей: ' : 'Бронь столика '} <span className="text-brand-blue">{table.label}</span>
                    </h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white transition-colors">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-gray-400 text-sm">
                        Вместимость: до <span className="font-semibold">{table.seats}</span> гостей.
                    </p>

                    {error && (
                        <p className="bg-red-900/50 border border-brand-red text-red-200 px-3 py-2 rounded-md text-xs">{error}</p>
                    )}

                    {/* Визуализация броней для информации */}
                    {!isAdmin && (
                        <div className="bg-brand-accent/70 p-3 rounded-md border border-gray-700">
                            <h3 className="text-sm font-semibold text-white mb-2">Существующие брони:</h3>
                            {visualBookings.length > 0 ? (
                                <ul className="space-y-1 text-xs text-gray-400">
                                    {visualBookings.map(b => (
                                        <li key={b.id} className="flex justify-between">
                                            <span>{b.guestName}</span>
                                            <span className="font-mono">{formatBookingSlot(b.dateTime)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-white text-center py-2">На этот столик пока нет броней</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Имя гостя (опционально для админа)"
                            value={guestName}
                            onChange={e => setGuestName(e.target.value)}
                            className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-white text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                            required={!isAdmin}
                        />
                        <input
                            type="tel"
                            placeholder="+7 (___) ___-__-__"
                            value={guestPhone}
                            onChange={handlePhoneChange}
                            className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-white text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                            required={!isAdmin}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Гостей</label>
                                <input
                                    type="number"
                                    value={guestCount}
                                    onChange={e => setGuestCount(parseInt(e.target.value))}
                                    min="1"
                                    max={table.seats}
                                    className="w-full bg-brand-accent p-2 rounded-md border border-gray-600 text-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Дата</label>
                                <input
                                    type="date"
                                    value={bookingDate}
                                    onChange={e => setBookingDate(e.target.value)}
                                    className="w-full bg-brand-accent p-2 rounded-md border border-gray-600 text-white text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Время {isAdmin && '(Администратор: любое время)'}</label>
                            {isAdmin ? (
                                // Для админа - свободный ввод времени
                                <input
                                    type="time"
                                    value={bookingTime}
                                    onChange={e => setBookingTime(e.target.value)}
                                    className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 text-white text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                    required
                                />
                            ) : (
                                // Для гостя - строгий список слотов
                                <select
                                    value={bookingTime}
                                    onChange={e => setBookingTime(e.target.value)}
                                    className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 text-white text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                >
                                    {availableSlots.length > 0 ? (
                                        availableSlots.map(time => (
                                            <option key={time} value={time}>{time}</option>
                                        ))
                                    ) : (
                                        <option value="">Нет доступных слотов</option>
                                    )}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-md bg-gray-600 text-white text-sm font-semibold hover:bg-gray-700 transition-colors">Отмена</button>
                        <button
                            type="submit"
                            disabled={!isAdmin && availableSlots.length === 0}
                            className="flex-1 py-3 rounded-md bg-brand-blue text-white font-bold text-sm shadow-md hover:brightness-90 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
                        >
                            {isAdmin ? 'Занять столик' : 'Забронировать'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookingModal;