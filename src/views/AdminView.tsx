import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Booking, BookingStatus, TableElement, TextElement, DecoElement } from '../types';
import { useApp } from '../context/AppContext';
import BookingModal from '../components/BookingModal';
import { registerServiceWorker, subscribeToPush } from '../services/pushService';
import { LayoutElement } from '../types';

// Константы логического размера холста (виртуальные единицы)
const LOGICAL_WIDTH = 1500;
const LOGICAL_HEIGHT = 1000;

const calculateBounds = (elements: LayoutElement[]) => {
    if (elements.length === 0) {
        return { minX: 0, minY: 0, maxX: 500, maxY: 500 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
        const halfWidth = (el as any).width / 2;
        const halfHeight = (el as any).height / 2;

        minX = Math.min(minX, el.x - halfWidth);
        minY = Math.min(minY, el.y - halfHeight);
        maxX = Math.max(maxX, el.x + halfWidth);
        maxY = Math.max(maxY, el.y + halfHeight);
    });

    const padding = 50;
    return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding
    };
};

const CountdownTimer: React.FC<{ createdAt: Date }> = ({ createdAt }) => {
    const [timeLeft, setTimeLeft] = useState(180);

    useEffect(() => {
        const updateTimer = () => {
            const elapsed = (new Date().getTime() - createdAt.getTime()) / 1000;
            const remaining = 180 - elapsed;
            setTimeLeft(Math.max(0, remaining));
        };
        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [createdAt]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = Math.floor(timeLeft % 60);
    const timeColor = timeLeft < 60 ? 'text-brand-red' : 'text-brand-yellow';

    return <span className={`font-mono font-bold ${timeColor}`}>{minutes}:{seconds.toString().padStart(2, '0')}</span>;
};

const BookingRequestCard: React.FC<{ booking: Booking; restaurantId: string }> = ({ booking, restaurantId }) => {
    const { updateBookingStatus } = useData();
    const [reason, setReason] = useState('');
    const [isDeclining, setIsDeclining] = useState(false);

    const handleDecline = () => {
        if (!reason.trim()) {
            alert("Пожалуйста, укажите причину отклонения.");
            return;
        }
        updateBookingStatus(restaurantId, booking.id, BookingStatus.DECLINED, reason);
    };

    return (
        <div className="bg-brand-accent p-4 rounded-lg shadow-md transition-transform hover:scale-105">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="font-bold text-lg">Столик {booking.tableLabel}</h4>
                <div className="text-sm">
                    Осталось: <CountdownTimer createdAt={booking.createdAt} />
                </div>
            </div>
            <p className="text-sm" style={{ color: '#f5efe6' }}>{booking.guestName} ({booking.guestCount} гостей)</p>
            <p className="text-sm text-gray-400">{booking.dateTime.toLocaleString('ru-RU')}</p>

            {isDeclining ? (
                <div className="mt-4 space-y-2">
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Причина отказа"
                        className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm"
                    />
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <button onClick={handleDecline} className="flex-1 bg-brand-red text-white px-3 py-2 text-sm rounded-md hover:bg-red-700">Подтвердить</button>
                        <button onClick={() => setIsDeclining(false)} className="bg-gray-500 text-white px-3 py-2 text-sm rounded-md hover:bg-gray-600">Отмена</button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button onClick={() => updateBookingStatus(restaurantId, booking.id, BookingStatus.CONFIRMED)} className="flex-1 bg-brand-green text-white px-3 py-2 text-sm font-semibold rounded-md hover:bg-green-700 transition-colors">Подтвердить</button>
                    <button onClick={() => setIsDeclining(true)} className="flex-1 bg-brand-red text-white px-3 py-2 text-sm font-semibold rounded-md hover:bg-red-700 transition-colors">Отклонить</button>
                </div>
            )}
        </div>
    );
};

const AdminView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant, updateBookingStatus } = useData();
    const [selectedTable, setSelectedTable] = useState<TableElement | null>(null);
    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);

    const restaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;

    useEffect(() => {
        if (restaurant && !isInitialized) {
            const floors = restaurant.floors || [];
            if (floors.length > 0) {
                setActiveFloorId(floors[0].id);
            }
            setIsInitialized(true);
        }
    }, [restaurant, isInitialized]);

    const pushSubscribed = useRef(false);
    useEffect(() => {
        if (selectedRestaurantId && !pushSubscribed.current) {
            pushSubscribed.current = true;
            registerServiceWorker().then(() => {
                subscribeToPush('ADMIN', selectedRestaurantId);
            });
        }
    }, [selectedRestaurantId]);

    const pendingBookings = useMemo(() => {
        if (!restaurant) return [];
        return restaurant.bookings
            .filter(b => b.status === BookingStatus.PENDING)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }, [restaurant]);

    const occupiedTableBookings = useMemo(() => {
        if (!restaurant) return [];
        const now = new Date();

        return (restaurant.layout.filter(el => el.type === 'table') as TableElement[])
            .map(table => {
                const activeBooking = restaurant.bookings
                    .filter(
                        b =>
                            b.tableId === table.id &&
                            (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED) &&
                            b.dateTime <= now
                    )
                    .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())[0];

                return activeBooking ? { table, booking: activeBooking } : null;
            })
            .filter((item): item is { table: TableElement; booking: Booking } => item !== null);
    }, [restaurant]);

    // --- ИСПРАВЛЕНИЕ: Вычисляем элементы и bounds ДО проверки if (!restaurant) ---
    // Используем useMemo, чтобы это считалось хуком. Если ресторана нет, возвращаем пустой массив.
    const activeFloorElements = useMemo(() => {
        if (!restaurant) return [];
        return restaurant.layout.filter(el =>
            !activeFloorId || el.floorId === activeFloorId || !el.floorId
        );
    }, [restaurant, activeFloorId]);

    // Хук useMemo вызывается ВСЕГДА, независимо от наличия ресторана
    const bounds = useMemo(() =>
        calculateBounds(activeFloorElements),
        [activeFloorElements]
    );

    const dynamicWidth = bounds.maxX - bounds.minX;
    const dynamicHeight = bounds.maxY - bounds.minY;

    // --- ТЕПЕРЬ МОЖНО ДЕЛАТЬ РАННИЙ RETURN ---
    if (!restaurant) {
        return <div className="text-center text-gray-400">Загрузка данных ресторана...</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Column 1: Requests */}
            <div className="lg:col-span-1 order-2 lg:order-1">
                <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: '#2c1f14' }}>Новые запросы</h2>
                <div className="space-y-4 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto pr-2">
                    {pendingBookings.length > 0 ? (
                        pendingBookings.map(b => <BookingRequestCard key={b.id} booking={b} restaurantId={restaurant.id} />)
                    ) : (
                        <p className="text-gray-400 text-center py-8">Нет ожидающих запросов.</p>
                    )}
                </div>
            </div>

            {/* Column 2 & 3: Map and Lists */}
            <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">

                {/* Status Sections (Collapsible on mobile could be nice, but stacked is fine) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-brand-primary rounded-lg border border-brand-accent p-4">
                        <h3 className="text-lg md:text-xl font-semibold mb-3">Занятые столики</h3>
                        {occupiedTableBookings.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {occupiedTableBookings.map(({ table, booking }) => (
                                    <div key={table.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-accent/60 rounded-md p-3">
                                        <div>
                                            <p className="font-semibold">Столик {table.label}</p>
                                            <p className="text-xs text-gray-300">
                                                {booking.guestName}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => updateBookingStatus(restaurant.id, booking.id, BookingStatus.COMPLETED)}
                                            className="bg-brand-green text-white px-2 py-1 text-xs font-semibold rounded-md hover:bg-green-700"
                                        >
                                            Освободить
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Пусто.</p>
                        )}
                    </div>

                    <div className="bg-brand-primary rounded-lg border border-brand-accent p-4">
                        <h3 className="text-lg md:text-xl font-semibold mb-3">Бронь (будущая)</h3>
                        {restaurant.bookings.filter(b => b.status === BookingStatus.CONFIRMED && b.dateTime > new Date()).length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {restaurant.bookings
                                    .filter(b => b.status === BookingStatus.CONFIRMED && b.dateTime > new Date())
                                    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
                                    .map(booking => (
                                        <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-accent/40 rounded-md p-3">
                                            <div>
                                                <p className="font-semibold text-sm">{booking.guestName} ({booking.guestCount} ч.)</p>
                                                <p className="text-xs text-gray-300">
                                                    Ст. {booking.tableLabel} • {booking.dateTime.toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => updateBookingStatus(restaurant.id, booking.id, BookingStatus.DECLINED, "Отменено администратором")}
                                                className="bg-brand-red text-white px-2 py-1 text-xs font-semibold rounded self-start sm:self-center"
                                            >
                                                Отменить
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Нет записей.</p>
                        )}
                    </div>
                </div>

                {/* Map Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#2c1f14' }}>План зала</h2>
                    {restaurant.floors && restaurant.floors.length > 1 && (
                        <div className="flex bg-brand-secondary p-1 rounded-lg border border-brand-accent overflow-x-auto max-w-full">
                            {restaurant.floors.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFloorId(f.id)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-all ${activeFloorId === f.id ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Scrollable Map Container */}
                <div className="w-full border-2 border-brand-accent rounded-xl shadow-inner overflow-hidden bg-brand-secondary">
                    <div className="overflow-auto w-full h-[500px] md:h-[600px] relative touch-pan-x touch-pan-y">
                        <div
                            className="relative w-full h-full transform origin-top-left transition-transform duration-300"
                            style={{
                                width: `${dynamicWidth}px`,
                                height: `${dynamicHeight}px`,
                                minWidth: `${dynamicWidth}px`,
                                minHeight: `${dynamicHeight}px`
                            }}
                        >
                            {activeFloorElements.map(el => {
                                if (el.type !== 'table') {
                                    let content = null;
                                    let classes = `absolute flex items-center justify-center`;

                                    if (el.type === 'text') {
                                        const textEl = el as TextElement;
                                        classes += ` bg-transparent text-center leading-tight overflow-hidden`;
                                        content = <div style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#2c1f14' }} className="w-full h-full flex items-center justify-center p-1">{textEl.label}</div>;
                                    } else if (el.type === 'arrow') {
                                        classes += ` text-[#2c1f14]`;
                                        content = (
                                            <svg viewBox={`0 0 ${el.width} ${el.height}`} fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
                                                <path d={`M 5 ${el.height / 2} H ${el.width - 15}`} strokeLinecap="round" />
                                                <path d={`M ${el.width - 25} ${el.height / 2 - 10} L ${el.width - 5} ${el.height / 2} L ${el.width - 25} ${el.height / 2 + 10}`} strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        );
                                    } else if (el.type === 'stairs') {
                                        classes += ` bg-gray-300`;
                                        content = (
                                            <div className="w-full h-full flex flex-col justify-evenly">
                                                {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-gray-500"></div>)}
                                            </div>
                                        );
                                    } else if (el.type === 'plant') {
                                        classes += ` bg-transparent`;
                                        content = (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                <div className="absolute w-2/3 h-2/3 bg-emerald-800 rounded-full"></div>
                                                <div className="absolute w-full h-full flex items-center justify-center">
                                                    <div className="w-full h-1/3 bg-green-500 absolute top-0 rounded-full opacity-75 transform rotate-45"></div>
                                                    <div className="w-full h-1/3 bg-green-500 absolute top-0 rounded-full opacity-75 transform -rotate-45"></div>
                                                    <div className="w-1/3 h-full bg-green-500 absolute left-0 rounded-full opacity-75 transform rotate-45"></div>
                                                    <div className="w-1/3 h-full bg-green-500 absolute left-0 rounded-full opacity-75 transform -rotate-45"></div>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        const styles: { [key: string]: string } = {
                                            wall: 'bg-gray-500',
                                            bar: 'bg-yellow-800 border-b-2 border-yellow-900',
                                            window: 'bg-sky-200/40 border-2 border-sky-300'
                                        };
                                        classes += ` ${styles[el.type] || 'bg-gray-400'}`;
                                        if (el.type === 'window') {
                                            content = <div className="w-full h-full flex items-center justify-center"><div className="w-px h-full bg-sky-300/50"></div></div>;
                                        }
                                    }

                                    return (
                                        <div
                                            key={el.id}
                                            style={{
                                                left: `${el.x - bounds.minX}px`,
                                                top: `${el.y - bounds.minY}px`,
                                                width: `${(el as any).width}px`,
                                                height: `${(el as any).height}px`,
                                                transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`
                                            }}
                                            className={classes}
                                        >
                                            {content}
                                        </div>
                                    );
                                }

                                const now = new Date();
                                const currentBooking = restaurant.bookings
                                    .filter(
                                        b =>
                                            b.tableId === el.id &&
                                            (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED) &&
                                            b.dateTime <= now
                                    )
                                    .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())[0];
                                const isPending = restaurant.bookings.some(
                                    b => b.tableId === el.id && b.status === BookingStatus.PENDING && b.dateTime <= now
                                );

                                let statusColor = 'bg-brand-green/80';
                                if (currentBooking) statusColor = 'bg-brand-red/80 cursor-not-allowed';
                                if (isPending) statusColor = 'bg-brand-yellow/80 cursor-wait';

                                if (!currentBooking && !isPending) {
                                    const nextBooking = restaurant.bookings
                                        .filter(b =>
                                            b.tableId === el.id &&
                                            (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED || b.status === BookingStatus.PENDING) &&
                                            b.dateTime > now
                                        )
                                        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())[0];

                                    if (nextBooking && (nextBooking.dateTime.getTime() - now.getTime()) < 60 * 60 * 1000) {
                                        statusColor = 'bg-brand-red/80 cursor-not-allowed';
                                    }
                                }

                                const shapeClasses = el.shape === 'circle' ? 'rounded-full' : 'rounded-md';
                                const fontSize = Math.min((el as any).width, (el as any).height) * 0.4;

                                return (
                                    <div
                                        key={el.id}
                                        style={{
                                            left: `${el.x - bounds.minX}px`,
                                            top: `${el.y - bounds.minY}px`,
                                            width: `${(el as any).width}px`,
                                            height: `${(el as any).height}px`,
                                            transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`
                                        }}
                                        className={`absolute flex items-center justify-center font-bold text-white transition-colors ${shapeClasses} ${statusColor} cursor-pointer hover:scale-110 transition-transform`}
                                        onClick={() => setSelectedTable(el as TableElement)}
                                    >
                                        <span style={{ fontSize: `${fontSize}px` }}>{el.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
            {selectedTable && (
                <BookingModal
                    table={selectedTable}
                    restaurantId={restaurant.id}
                    onClose={() => setSelectedTable(null)}
                />
            )}
        </div>
    );
};

export default AdminView;