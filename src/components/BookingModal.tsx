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
}

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const BookingModal: React.FC<BookingModalProps> = ({ table, restaurantId, onClose }) => {
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

    // Generate available time slots based on work hours and constraints
    const availableSlots = useMemo(() => {
        const slots: string[] = [];
        const startMins = parseTime(workStarts);
        let endMins = parseTime(workEnds);

        // Handle overnight (ends next day)
        if (endMins <= startMins) {
            endMins += 24 * 60;
        }

        const now = new Date();
        const selectedDate = new Date(bookingDate);
        const isToday = selectedDate.toDateString() === now.toDateString();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        // Logic: Round up to next hour for "current time" constraint
        const minBookingMins = isToday ? Math.ceil(currentMins / 60) * 60 : 0; // if 14:15 -> 15:00 (900 mins)

        // Find existing bookings for this table on this WORKING day
        // We need to handle the "working day" concept for overnight shifts.
        // A booking at 01:00 belongs to the previous day's shift if we consider logical day.
        // But the date picker selects a calendar date.
        // If I select "Today" (Feb 12), and work ends at 02:00 (Feb 13).
        // I want to see slots: 10:00 ... 23:30 ... 00:00 ... 01:30.
        // Effectively, slots range from WorkStart on BookingDate to WorkEnd on BookingDate (or next day).

        // Let's filter existing bookings that fall into this range.
        const bookingsOnShift = restaurant?.bookings.filter(b => {
            if (b.tableId !== table.id) return false;
            if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.OCCUPIED) return false;

            // Check if booking falls in the shift window [ShiftStart, ShiftEnd]
            const shiftStart = new Date(selectedDate);
            shiftStart.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);

            const shiftEnd = new Date(selectedDate);
            shiftEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0); // Adds days if > 24h

            return b.dateTime >= shiftStart && b.dateTime < shiftEnd;
        }) || [];

        // Find the earliest booking time in this shift to block subsequent slots
        let firstBookingMins = endMins; // Default to close time
        if (bookingsOnShift.length > 0) {
            // Sort by time
            bookingsOnShift.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
            const first = bookingsOnShift[0];

            let bMins = first.dateTime.getHours() * 60 + first.dateTime.getMinutes();
            if (first.dateTime.getDate() !== selectedDate.getDate()) {
                bMins += 24 * 60;
            }

            // Adjust for overnight wrap relative to start
            // If shifts starts at 10:00 (600), booking at 01:00 (60) is actually 25*60 (1500).
            // But checking getDate() handles the physical date difference.
            // If booking date == selected date AND time < start (e.g. 01:00 vs 10:00), it's previous shift?
            // "bookingsOnShift" filter already handles valid range.
            // But we need 'bMins' to be comparable to 'time' (which goes > 24*60).

            // If filtered correctly, b.dateTime is >= shiftStart.
            // shiftStart corresponds to 'startMins'.
            const timeDiff = (first.dateTime.getTime() - new Date(selectedDate).setHours(Math.floor(startMins / 60), startMins % 60, 0, 0)) / 60000;
            const absoluteBookingMins = startMins + timeDiff;

            if (absoluteBookingMins < firstBookingMins) firstBookingMins = absoluteBookingMins;
        }

        // Generate slots
        for (let time = startMins; time <= endMins - 60; time += 30) { // 30 min interval
            // 1. Must be >= Current Time (Next Hour) if Today
            // Actually, if today is selected, 'time' (relative to shift start) vs 'minBookingMins' (relative to day start)?
            // If shift starts 10:00. minBookingMins is e.g. 14:00 (840).
            // time=600 (10:00). 600 < 840 -> continue.

            // What if overnight? Shift 22:00 - 04:00.
            // Start=1320. End=1680.
            // Current time 23:00 (1380). minBookingMins=1440 (00:00 next day? No, 24*60).
            // ceil(23*60 / 60) * 60 = 23*60? No, ceil(23) = 23.
            // If 23:15 -> ceil(23.25)=24 -> 1440.

            // We need to compare specific point in time.
            // 'time' is minutes from start of day (or next day).
            // 'minBookingMins' is minutes from start of day.
            // If time >= 24*60, it's next day.

            // If isToday, we block past times.
            // If I am at 23:00. I select "Today".
            // Slots 23:30 (1410) -> valid?
            // 00:00 (1440) -> valid?

            // minBookingMins handles today 00:00..23:59.
            // If 'time' > 1440, it implies tomorrow.
            // But 'isToday' check refers to "Start Date".
            // If I am booking for "Today's shift" which goes into tomorrow.
            // And "Now" is Today 23:00.
            // Slot 01:00 (Tomorrow) is 1500 mins.
            // minBookingMins is based on "Now".
            // If now is 23:00. minBookingMins = 24:00 (1440).
            // 1500 > 1440. So valid.

            // But what if "Now" is 01:00 (Tomorrow physically).
            // And I select "Today" (Yesterday relative to now?). 
            // The date picker usually picks calendar date.
            // If it's already 01:00, "Today" is Feb 13.
            // Shift starting Feb 13 10:00.
            // Work hours: 10:00 - 02:00 (Feb 14).
            // Slots: 10:00..01:30.
            // All future.

            // Corner case: It's 01:00 (Feb 13).
            // I want to book for ongoing shift (started Feb 12 22:00).
            // Date picker might not easily allow selecting "Yesterday".
            // Assumption: Users book for the date the shift STARTS.
            // If I am at 01:00 Feb 13. To book 01:30, I need to select Feb 12?
            // Or Feb 13?
            // If I select Feb 13, shift starts 22:00. 01:30 is next night.
            // This is acceptable limitation for now unless we implement "Logical Date".

            if (isToday && time < minBookingMins) continue;

            // 2. Must be < First Existing Booking
            if (time >= firstBookingMins) continue;

            // Format
            const h = Math.floor(time / 60) % 24;
            const m = time % 60;
            const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            slots.push(timeString);
        }

        return slots;

    }, [bookingDate, restaurant, table.id, workStarts, workEnds]);

    // Set initial time
    useEffect(() => {
        if (availableSlots.length > 0) {
            // Only set if not already set or if current selection is no longer available
            if (!bookingTime || !availableSlots.includes(bookingTime)) {
                setBookingTime(availableSlots[0]);
            }
        } else {
            setBookingTime('');
        }
    }, [availableSlots, bookingTime]);

    const formatBookingSlot = (date: Date) =>
        new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);

    // Existing bookings for display (just visual list) - filter broadly
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

        if (!guestName || !guestPhone) {
            setError('Пожалуйста, введите ваше имя и номер телефона.');
            return;
        }

        const phoneDigits = guestPhone.replace(/\D/g, '');
        if (phoneDigits.length !== 11) { // 7 + 10 digits
            setError('Пожалуйста, введите корректный номер телефона: +7 (XXX) XXX-XX-XX');
            return;
        }
        if (guestCount > table.seats) {
            setError(`Этот столик вмещает не более ${table.seats} гостей.`);
            return;
        }
        if (!bookingTime) {
            setError('Не выбран доступный временной слот.');
            return;
        }

        // Construct Date
        const [h, m] = bookingTime.split(':').map(Number);
        const dateTime = new Date(bookingDate);
        dateTime.setHours(h, m, 0, 0);

        // Handle Next Day case (e.g. selected 01:00 for a shift starting at 22:00 today)
        // If selected time (01:00) < WorkStart (22:00), assume next day.
        const workStartH = parseInt(workStarts.split(':')[0]);
        if (h < workStartH && parseTime(bookingTime) < parseTime(workStarts)) { // Only if selected time is earlier than workStarts
            dateTime.setDate(dateTime.getDate() + 1);
        }

        // Check for next booking to warn about duration
        const nextBooking = restaurant?.bookings
            .filter(b =>
                b.tableId === table.id &&
                (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED || b.status === BookingStatus.PENDING) &&
                b.dateTime > dateTime
            )
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())[0];

        if (nextBooking) {
            const diffMs = nextBooking.dateTime.getTime() - dateTime.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // Warn if next booking is within 6 hours (typical shift overlap concern)
            if (diffHours < 6) {
                const hours = Math.floor(diffHours);
                const minutes = Math.floor((diffHours - hours) * 60);
                const durationStr = minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`; // Russian as context suggests

                const nextTimeStr = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(nextBooking.dateTime);

                const confirmed = window.confirm(
                    `Внимание! На этот столик есть бронь в ${nextTimeStr}.\n` +
                    `У вас будет только ${durationStr}.\n\n` +
                    `Продолжить?`
                );
                if (!confirmed) return;
            }
        }

        try {
            await addBooking(restaurantId, {
                tableId: table.id,
                guestName,
                guestPhone,
                guestCount,
                dateTime
            });

            // Subscribe guest to push notifications for status updates
            const normalizedPhone = guestPhone.replace(/\D/g, '');
            subscribeToPush('GUEST', undefined, normalizedPhone);

            alert('Ваш запрос на бронирование отправлен!');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось создать бронирование. Пожалуйста, попробуйте снова.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 transition-opacity duration-300 p-2 sm:p-4">
            <div className="bg-brand-secondary rounded-lg shadow-2xl p-6 w-full max-w-lg m-auto transform transition-all duration-300 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-brand-secondary pb-2 border-b border-brand-accent/30 z-10">
                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#2c1f14' }}>Бронь столика <span className="text-brand-blue">{table.label}</span></h2>
                    <button onClick={onClose} className="text-gray-400 text-3xl leading-none hover:text-white">&times;</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-gray-400 text-sm">Вместимость: до <span className="font-semibold">{table.seats}</span> гостей.</p>

                    {error && <p className="bg-red-900/50 border border-brand-red text-red-200 px-3 py-2 rounded-md text-xs">{error}</p>}

                    {/* Visual Bookings List */}
                    <div className="bg-brand-accent/70 p-3 rounded-md border border-gray-700">
                        {/* ... existing logic ... */}
                    </div>

                    <div className="space-y-3">
                        <input type="text" placeholder="Ваше имя" value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-gray-400 text-sm" required />
                        <input type="tel" placeholder="Телефон" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 placeholder-gray-400 text-sm" required />

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Гостей</label>
                                <input type="number" value={guestCount} onChange={e => setGuestCount(parseInt(e.target.value))} min="1" max={table.seats} className="w-full bg-brand-accent p-2 rounded-md border border-gray-600" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-1">Дата</label>
                                <input type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full bg-brand-accent p-2 rounded-md border border-gray-600 text-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-gray-400 block mb-1">Время</label>
                            <select value={bookingTime} onChange={e => setBookingTime(e.target.value)} className="w-full bg-brand-accent p-3 rounded-md border border-gray-600 text-sm">
                                {availableSlots.map(time => <option key={time} value={time}>{time}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-md bg-gray-600 text-white text-sm">Отмена</button>
                        <button type="submit" disabled={availableSlots.length === 0} className="flex-1 py-3 rounded-md bg-brand-blue text-white font-bold text-sm shadow-md disabled:bg-gray-500">Забронировать</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default BookingModal;
