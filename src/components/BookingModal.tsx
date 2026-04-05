import React, { useState, useEffect, useMemo } from 'react';
import { BookingStatus, TableElement, Booking } from '../types';
import { useData } from '../context/DataContext';

const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
    const actualLines = text.split(/\r?\n|\\n/);
    return (
        <div className="space-y-2">
            {actualLines.map((line, i) => {
                const parts = line.split(/(<b>.*?<\/b>)/g);
                return (
                    <p key={i}>
                        {parts.map((part, j) => {
                            if (part.startsWith('<b>') && part.endsWith('</b>')) {
                                return <strong key={j} className="text-white font-bold">{part.slice(3, -4)}</strong>;
                            }
                            return <span key={j}>{part}</span>;
                        })}
                    </p>
                );
            })}
        </div>
    );
};

const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

interface BookingModalProps {
    table: TableElement | null;
    restaurantId: string;
    onClose: () => void;
    isAdmin?: boolean;
    withMap?: boolean; // If false - no table selection was made, table is null
    bookingToEdit?: Booking;
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

const BookingModal: React.FC<BookingModalProps> = ({ table, restaurantId, onClose, isAdmin = false, withMap = true, bookingToEdit }) => {
    const { addBooking, getRestaurant, updateBookingDetails } = useData();
    const restaurant = getRestaurant(restaurantId);

    const [guestName, setGuestName] = useState(bookingToEdit?.guestName || '');
    const [guestPhone, setGuestPhone] = useState(bookingToEdit?.guestPhone || '');
    const [guestEmail, setGuestEmail] = useState(bookingToEdit?.guestEmail || '');
    const [duration, setDuration] = useState<number>(bookingToEdit?.duration || (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60));
    const [loading, setLoading] = useState(false);
    const [guestCount, setGuestCount] = useState<number>(bookingToEdit?.guestCount || 2);
    const [guestComment, setGuestComment] = useState(bookingToEdit?.guestComment || '');
    const [assignedTo, setAssignedTo] = useState(bookingToEdit?.assignedTo || '');
    const [staffNames, setStaffNames] = useState<string[]>([]);
    const [isSuccess, setIsSuccess] = useState(false);

    const [bookingDate, setBookingDate] = useState(bookingToEdit ? formatLocalDate(new Date(bookingToEdit.dateTime)) : formatLocalDate(new Date()));
    const [bookingTime, setBookingTime] = useState(bookingToEdit ? new Date(bookingToEdit.dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '');
    const [error, setError] = useState('');

    const [currentTableId, setCurrentTableId] = useState<string>(table?.id || bookingToEdit?.tableId || '');
    const currentTableLabel = useMemo(() => {
        const t = restaurant?.layout?.find(el => el.id === currentTableId);
        return t ? (t as TableElement).label : '';
    }, [restaurant, currentTableId]);

    useEffect(() => {
        if (isAdmin && restaurantId) {
            import('../services/api').then(({ api }) => {
                api.restaurants.getStaffNames(restaurantId).then(setStaffNames).catch(() => { });
            });
        }
    }, [isAdmin, restaurantId]);

    const selectedDateObj = useMemo(() => {
        const [year, month, day] = bookingDate.split('-').map(Number);
        return new Date(year, month - 1, day);
    }, [bookingDate]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setGuestPhone(formatted);
    };

    const getScheduleForDay = (dayIndex: number) => {
        if (restaurant?.schedule && restaurant.schedule[dayIndex]) {
            return restaurant.schedule[dayIndex];
        }
        return {
            start: restaurant?.workStarts || '10:00',
            end: restaurant?.workEnds || '23:00'
        };
    };

    // Generate slots only for guests WITH map (specific table picked). For no-map guests, use free time input.
    const availableSlots = useMemo(() => {
        if (isAdmin || !withMap || !table) return [];

        const slots: string[] = [];
        const now = new Date();
        const [year, month, day] = bookingDate.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const isToday = selectedDate.toDateString() === now.toDateString();

        const todayIndex = selectedDate.getDay();
        const yesterdayIndex = (todayIndex + 6) % 7;

        const todaySchedule = getScheduleForDay(todayIndex);
        const yesterdaySchedule = getScheduleForDay(yesterdayIndex);

        const yStartMins = parseTime(yesterdaySchedule.start);
        const yEndMins = parseTime(yesterdaySchedule.end);

        const tStartMins = parseTime(todaySchedule.start);
        const tEndMins = parseTime(todaySchedule.end);

        const slotTimesToGenerate: number[] = [];

        // 1. Spillover from yesterday
        if (yEndMins <= yStartMins) {
            const spilloverEnd = yEndMins - (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60);
            for (let time = 0; time <= spilloverEnd; time += 30) {
                slotTimesToGenerate.push(time);
            }
        }

        // 2. Today's shift
        const endForToday = (tEndMins <= tStartMins) ? (24 * 60 - (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60)) : (tEndMins - (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60));
        for (let time = tStartMins; time <= endForToday; time += 30) {
            slotTimesToGenerate.push(time);
        }

        const currentMins = now.getHours() * 60 + now.getMinutes();
        const minBookingMins = isToday ? currentMins + 60 : 0;

        const relevantBookings = restaurant?.bookings.filter(b => {
            if (b.tableId !== table.id) return false;
            if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.OCCUPIED && b.status !== BookingStatus.PENDING) return false;
            const bDate = new Date(b.dateTime);
            return bDate.getFullYear() === selectedDate.getFullYear() &&
                bDate.getMonth() === selectedDate.getMonth() &&
                bDate.getDate() === selectedDate.getDate();
        }) || [];

        const bookingMinsList = relevantBookings.map(b => {
            const bDate = new Date(b.dateTime);
            return {
                start: bDate.getHours() * 60 + bDate.getMinutes(),
                end: bDate.getHours() * 60 + bDate.getMinutes() + (b.duration || 60)
            };
        });

        for (const time of slotTimesToGenerate) {
            if (isToday && time < minBookingMins) continue;
            if (selectedDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;

            const isSpillover = time < tStartMins;

            const hasConflict = bookingMinsList.some(b => {
                const isBmSpillover = b.start < tStartMins;
                if (isBmSpillover !== isSpillover) return false; // Only compare within the same "shift" (today vs yesterday spillover)

                // Check for overlap with existing booking
                // A new booking from 'time' with 'duration' conflicts if it overlaps with an existing booking 'b'
                // Conflict if: (start1 < end2) && (end1 > start2)
                return (time < b.end) && (time + (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60) > b.start);
            });
            if (hasConflict) continue;

            const h = Math.floor(time / 60) % 24;
            const m = time % 60;
            const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (!slots.includes(timeString)) {
                slots.push(timeString);
            }
        }

        slots.sort((a, b) => parseTime(a) - parseTime(b));

        return slots;
    }, [bookingDate, restaurant, table?.id, isAdmin, withMap]);

    // For no-map guest booking: generate time slots from restaurant schedule (no table-specific blocking)
    const noMapSlots = useMemo(() => {
        if (isAdmin || withMap) return [];

        const slots: string[] = [];
        const now = new Date();
        const [year, month, day] = bookingDate.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const isToday = selectedDate.toDateString() === now.toDateString();

        const todayIndex = selectedDate.getDay();
        const yesterdayIndex = (todayIndex + 6) % 7;
        const todaySchedule = getScheduleForDay(todayIndex);
        const yesterdaySchedule = getScheduleForDay(yesterdayIndex);

        const yStartMins = parseTime(yesterdaySchedule.start);
        const yEndMins = parseTime(yesterdaySchedule.end);
        const tStartMins = parseTime(todaySchedule.start);
        const tEndMins = parseTime(todaySchedule.end);

        const slotTimesToGenerate: number[] = [];

        if (yEndMins <= yStartMins) {
            const spilloverEnd = yEndMins - (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60);
            for (let time = 0; time <= spilloverEnd; time += 30) {
                slotTimesToGenerate.push(time);
            }
        }

        const endForToday = (tEndMins <= tStartMins) ? (24 * 60 - (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60)) : (tEndMins - (restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60));
        for (let time = tStartMins; time <= endForToday; time += 30) {
            slotTimesToGenerate.push(time);
        }

        const currentMins = now.getHours() * 60 + now.getMinutes();
        const minBookingMins = isToday ? currentMins + 60 : 0;

        const relevantBookings = restaurant?.bookings.filter(b => {
            const bDate = new Date(b.dateTime);
            return bDate.getFullYear() === selectedDate.getFullYear() &&
                bDate.getMonth() === selectedDate.getMonth() &&
                bDate.getDate() === selectedDate.getDate();
        }) || [];

        const bookingMinsList = relevantBookings.map(b => {
            const bDate = new Date(b.dateTime);
            return {
                start: bDate.getHours() * 60 + bDate.getMinutes(),
                end: bDate.getHours() * 60 + bDate.getMinutes() + (b.duration || 60)
            };
        });

        const totalTables = (restaurant?.layout || []).filter(l => l.type === 'table').length || 1;
        const effectiveRestriction = restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60;

        for (const time of slotTimesToGenerate) {
            if (isToday && time < minBookingMins) continue;
            if (selectedDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) continue;

            const isSpillover = time < tStartMins;

            // Count how many bookings overlap with this potential slot
            let overlapCount = 0;
            bookingMinsList.forEach(b => {
                const isBmSpillover = b.start < tStartMins;
                if (isBmSpillover !== isSpillover) return;

                const hasOverlap = (time < b.end) && (time + effectiveRestriction > b.start);
                if (hasOverlap) overlapCount++;
            });

            // If overlapCount is equal or greater than total tables, this slot is fully booked
            if (overlapCount >= totalTables) continue;

            const h = Math.floor(time / 60) % 24;
            const m = time % 60;
            const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (!slots.includes(timeString)) slots.push(timeString);
        }

        slots.sort((a, b) => parseTime(a) - parseTime(b));
        return slots;
    }, [bookingDate, restaurant, isAdmin, withMap]);

    useEffect(() => {
        if (isAdmin) {
            if (!bookingTime) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                setBookingTime(timeStr);
            }
            return;
        }

        const slots = withMap ? availableSlots : noMapSlots;
        if (slots.length > 0) {
            if (!bookingTime || !slots.includes(bookingTime)) {
                setBookingTime(slots[0]);
            }
        } else {
            setBookingTime('');
        }
    }, [availableSlots, noMapSlots, bookingTime, isAdmin, withMap]);

    const formatBookingSlot = (date: Date) =>
        new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(date);

    const visualBookings = table ? restaurant?.bookings
        .filter(booking =>
            booking.tableId === table.id &&
            (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) &&
            new Date(booking.dateTime).getTime() >= Date.now()
        )
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()) || [] : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!isAdmin && (!guestName || !guestPhone || !guestEmail)) {
            setError('Пожалуйста, заполните имя, телефон и email.');
            setLoading(false);
            return;
        }

        const phoneDigits = guestPhone.replace(/\D/g, '');
        if (!isAdmin && phoneDigits.length !== 11) {
            setError('Пожалуйста, введите корректный номер телефона: +7 (XXX) XXX-XX-XX');
            setLoading(false);
            return;
        }
        if (table && guestCount > table.seats) {
            setError(`Этот столик вмещает не более ${table.seats} гостей.`);
            setLoading(false);
            return;
        }
        if (!bookingTime) {
            setError('Не выбрано время.');
            setLoading(false);
            return;
        }

        const [h, m] = bookingTime.split(':').map(Number);
        const dateTime = new Date(bookingDate);
        dateTime.setHours(h, m, 0, 0);

        try {
            const payload: any = {
                guestName: guestName || (isAdmin ? 'Гость (Walk-in)' : ''),
                guestPhone,
                guestEmail,
                guestCount,
                dateTime,
                timezoneOffset: new Date().getTimezoneOffset(),
                tableId: currentTableId || undefined,
                tableLabel: currentTableLabel || undefined,
                guestComment,
                isAdmin,
                duration,
                assignedTo: isAdmin ? assignedTo : undefined
            };

            if (bookingToEdit) {
                await updateBookingDetails(bookingToEdit.id, payload);
                alert('Изменения сохранены!');
                onClose();
            } else {
                await addBooking(restaurantId, payload);
                if (isAdmin) {
                    alert('Столик успешно занят!');
                    onClose();
                } else {
                    setIsSuccess(true);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать бронирование.');
        } finally {
            setLoading(false);
        }
    };

    const activeSlots = withMap ? availableSlots : noMapSlots;

    if (isSuccess) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300 p-2 sm:p-4">
                <div className="bg-brand-secondary rounded-xl shadow-2xl p-8 w-full max-w-md m-auto transform transition-all duration-300 text-center border border-brand-accent/50">
                    <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
                        <svg className="w-8 h-8 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-brand-primary mb-2">Бронирование оформлено!</h2>
                    <p className="text-gray-400 mb-6">Ваш запрос на бронирование успешно отправлен.</p>

                    {restaurant?.age_restriction && restaurant.age_restriction.trim() !== '' && (
                        <div className="bg-[#1a1c23] border-l-4 border-brand-blue rounded-r-lg p-4 text-left text-sm text-gray-300 mb-8 shadow-inner">
                            <FormattedMessage text={restaurant.age_restriction} />
                        </div>
                    )}

                    <button onClick={onClose} className="w-full bg-brand-blue hover:bg-blue-600 active:scale-95 text-white font-bold py-3 rounded-lg shadow-lg transition-all">
                        Понятно, спасибо
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300 p-2 sm:p-4">
            <div className="bg-brand-secondary rounded-lg shadow-2xl p-6 w-full max-w-lg m-auto transform transition-all duration-300 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-brand-secondary pb-2 border-b border-brand-accent/30 z-10">
                    <h2 className="text-xl md:text-2xl font-bold text-brand-primary">
                        {bookingToEdit ? 'Редактирование брони' : (
                            isAdmin
                                ? table ? <>Посадить гостей: <span className="text-brand-blue">{table.label}</span></> : 'Посадить гостей'
                                : table ? <>Бронь столика <span className="text-brand-blue">{table.label}</span></> : 'Забронировать столик'
                        )}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white transition-colors">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isAdmin && bookingToEdit ? (
                        <div className="bg-brand-accent/40 border border-brand-accent px-3 py-2 rounded-md">
                            <label className="text-xs text-brand-blue block mb-1 font-bold">Пересадить за столик:</label>
                            <select
                                value={currentTableId}
                                onChange={e => setCurrentTableId(e.target.value)}
                                className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                            >
                                {restaurant?.layout?.filter(el => el.type === 'table').map((t: any) => (
                                    <option key={t.id} value={t.id}>Столик {t.label} (Вместимость: {t.seats})</option>
                                ))}
                                <option value="">Без столика (назначается позже)</option>
                            </select>
                        </div>
                    ) : (
                        table && (
                            <p className="text-gray-500 text-sm">
                                Вместимость: до <span className="font-semibold">{table.seats}</span> гостей.
                            </p>
                        )
                    )}

                    {!withMap && !isAdmin && (
                        <div className="bg-brand-accent/40 border border-brand-accent px-3 py-2 rounded-md text-sm text-gray-400">
                            📋 Столик будет назначен администратором после подтверждения заявки.
                        </div>
                    )}

                    {error && (
                        <p className="bg-red-900/50 border border-brand-red text-red-200 px-3 py-2 rounded-md text-xs">{error}</p>
                    )}

                    {/* Show existing bookings only for map-based guest booking */}
                    {!isAdmin && withMap && table && (
                        <div className="bg-brand-accent/70 p-3 rounded-md border border-gray-700">
                            <h3 className="text-sm font-semibold text-gray-200 mb-2">Существующие брони:</h3>
                            {visualBookings.length > 0 ? (
                                <ul className="space-y-1 text-xs text-gray-500">
                                    {visualBookings.map(b => (
                                        <li key={b.id} className="flex justify-between">
                                            <span>{b.guestName}</span>
                                            <span className="font-mono">{formatBookingSlot(new Date(b.dateTime))}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-200 text-center py-2">На этот столик пока нет броней</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Имя гостя"
                            value={guestName}
                            onChange={e => setGuestName(e.target.value)}
                            className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                            required={!isAdmin}
                        />
                        <input
                            type="tel"
                            placeholder="+7 (___) ___-__-__"
                            value={guestPhone}
                            onChange={handlePhoneChange}
                            className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                            required={!isAdmin}
                        />
                        <input
                            type="email"
                            placeholder="Email"
                            value={guestEmail}
                            onChange={e => setGuestEmail(e.target.value)}
                            className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                            required={!isAdmin}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Гостей</label>
                                <input
                                    type="number"
                                    value={guestCount}
                                    onChange={e => setGuestCount(parseInt(e.target.value))}
                                    min="1"
                                    max={table?.seats || 20}
                                    className="w-full bg-brand-accent p-2 rounded-md border border-gray-600 text-gray-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Дата</label>
                                <input
                                    type="date"
                                    value={bookingDate}
                                    onChange={e => setBookingDate(e.target.value)}
                                    className="w-full bg-brand-accent p-2 rounded-md border border-gray-600 text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <textarea
                                placeholder="Комментарий к бронированию"
                                value={guestComment}
                                onChange={e => setGuestComment(e.target.value)}
                                className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all resize-none"
                                rows={2}
                            />
                        </div>

                        {isAdmin && (
                            <div>
                                <label className="text-xs text-brand-blue block mb-2 font-bold">Ответственный (менеджер / хостес):</label>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={assignedTo}
                                        onChange={e => setAssignedTo(e.target.value)}
                                        placeholder="Введите имя..."
                                        className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-white text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                    />
                                    {staffNames.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {staffNames.filter(n => !assignedTo || n.toLowerCase().includes(assignedTo.toLowerCase())).map(name => (
                                                <button
                                                    key={name}
                                                    type="button"
                                                    onClick={() => setAssignedTo(name)}
                                                    className="text-[10px] bg-brand-primary px-2 py-1 rounded border border-gray-600 hover:border-brand-blue text-gray-300 transition-colors"
                                                >
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Время {isAdmin && '(Администратор: любое время)'}</label>
                            {isAdmin ? (
                                <input
                                    type="time"
                                    value={bookingTime}
                                    onChange={e => setBookingTime(e.target.value)}
                                    className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                    required
                                />
                            ) : (
                                <select
                                    value={bookingTime}
                                    onChange={e => setBookingTime(e.target.value)}
                                    className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 text-gray-200 text-sm focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all"
                                >
                                    {activeSlots.length > 0 ? (
                                        activeSlots.map(time => (
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
                            disabled={!isAdmin && activeSlots.length === 0}
                            className="flex-1 py-3 rounded-md bg-brand-blue text-white font-bold text-sm shadow-md hover:brightness-90 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
                        >
                            {bookingToEdit ? 'Сохранить изменения' : (isAdmin ? 'Занять столик' : 'Забронировать')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookingModal;