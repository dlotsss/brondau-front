import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Booking, BookingStatus, TableElement, TextElement, DecoElement } from '../types';
import { useApp } from '../context/AppContext';
import BookingModal from '../components/BookingModal';
import GuestManager from '../components/GuestManager';
import { registerServiceWorker, subscribeToPush } from '../services/pushService';
import { LayoutElement } from '../types';

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
    const [timeLeft, setTimeLeft] = useState(3600);

    useEffect(() => {
        const updateTimer = () => {
            const elapsed = (new Date().getTime() - createdAt.getTime()) / 1000;
            const remaining = 3600 - elapsed;
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

const DurationEditor: React.FC<{ booking: Booking }> = ({ booking }) => {
    const { updateBookingStatus } = useData();
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(booking.duration || 60);

    if (!isEditing) {
        return (
            <button 
                onClick={() => setIsEditing(true)} 
                className="text-[10px] text-gray-500 hover:text-brand-blue flex items-center gap-1"
                title="Изменить длительность"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {booking.duration || 60} мин
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1">
            <input 
                type="number" 
                value={val} 
                onChange={e => setVal(parseInt(e.target.value))} 
                className="w-12 bg-brand-primary border border-gray-600 rounded text-[10px] px-1 text-white"
                autoFocus
            />
            <button 
                onClick={() => {
                    updateBookingStatus(booking.id, booking.status, undefined, undefined, undefined, val);
                    setIsEditing(false);
                }}
                className="text-brand-green text-[10px] font-bold"
            >
                OK
            </button>
        </div>
    );
};

const BookingRequestCard: React.FC<{ booking: Booking; restaurantId: string; tables: TableElement[] }> = ({ booking, restaurantId, tables }) => {
    const { updateBookingStatus } = useData();
    const [reason, setReason] = useState('');
    const [isDeclining, setIsDeclining] = useState(false);
    const [assignedTableId, setAssignedTableId] = useState('');
    const [customDuration, setCustomDuration] = useState<number>(booking.duration || 60);
    const needsTableAssignment = !booking.tableId;

    const handleConfirm = () => {
        if (needsTableAssignment && !assignedTableId) {
            alert('Пожалуйста, выберите столик для гостя.');
            return;
        }
        if (needsTableAssignment) {
            const assignedTable = tables.find(t => t.id === assignedTableId);
            updateBookingStatus(booking.id, BookingStatus.CONFIRMED, undefined, assignedTableId, assignedTable?.label, customDuration);
        } else {
            updateBookingStatus(booking.id, BookingStatus.CONFIRMED, undefined, undefined, undefined, customDuration);
        }
    };

    const handleDecline = () => {
        if (!reason.trim()) {
            alert('Пожалуйста, укажите причину отклонения.');
            return;
        }
        updateBookingStatus(booking.id, BookingStatus.DECLINED, reason);
    };

    return (
        <div className="bg-brand-accent p-4 rounded-lg shadow-md transition-transform hover:scale-105">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h4 className="font-bold text-lg">
                    {booking.tableLabel ? `Столик ${booking.tableLabel}` : <span className="text-brand-yellow">Столик не назначен</span>}
                </h4>
                <div className="text-sm">
                    Осталось: <CountdownTimer createdAt={booking.createdAt} />
                </div>
            </div>
            <p className="text-sm" style={{ color: '#d1c1b1' }}>{booking.guestName} ({booking.guestCount} гостей)</p>
            <p className="text-sm font-medium" style={{ color: '#b5a48f' }}>{booking.guestPhone}</p>
            <p className="text-sm text-gray-500">{new Date(booking.dateTime).toLocaleString('ru-RU')}</p>

            {/* Table assignment for no-map bookings */}
            {needsTableAssignment && !isDeclining && (
                <div className="mt-3">
                    <label className="text-xs text-gray-300 block mb-1">Назначить столик:</label>
                    <select
                        value={assignedTableId}
                        onChange={e => setAssignedTableId(e.target.value)}
                        className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm text-white focus:outline-none focus:border-brand-blue"
                    >
                        <option value="">— Выберите столик —</option>
                        {tables.map(t => (
                            <option key={t.id} value={t.id}>Столик {t.label} ({t.seats} мест)</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Duration assignment */}
            {!isDeclining && (
                <div className="mt-3">
                    <label className="text-xs text-gray-300 block mb-1">Длительность (мин):</label>
                    <input 
                        type="number" 
                        value={customDuration} 
                        onChange={e => setCustomDuration(parseInt(e.target.value))} 
                        className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm text-white focus:outline-none focus:border-brand-blue"
                    />
                </div>
            )}

            {isDeclining ? (
                <div className="mt-4 space-y-2">
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Причина отказа"
                        className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm focus:outline-none focus:border-brand-blue"
                    />
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <button onClick={handleDecline} className="flex-1 bg-brand-red text-white px-3 py-2 text-sm rounded-md hover:bg-red-700">Подтвердить</button>
                        <button onClick={() => setIsDeclining(false)} className="bg-gray-500 text-white px-3 py-2 text-sm rounded-md hover:bg-gray-600">Отмена</button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button onClick={handleConfirm} className="flex-1 bg-brand-green text-white px-3 py-2 text-sm font-semibold rounded-md hover:bg-green-700 transition-colors">Подтвердить</button>
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
    const [activeView, setActiveView] = useState<'MAP' | 'GUESTS'>('MAP');
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
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
                            new Date(b.dateTime) <= now
                    )
                    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())[0];

                return activeBooking ? { table, booking: activeBooking } : null;
            })
            .filter((item): item is { table: TableElement; booking: Booking } => item !== null);
    }, [restaurant]);

    const activeFloorElements = useMemo(() => {
        if (!restaurant) return [];
        return restaurant.layout.filter(el =>
            !activeFloorId || el.floorId === activeFloorId || !el.floorId
        );
    }, [restaurant, activeFloorId]);

    const bounds = useMemo(() => calculateBounds(activeFloorElements), [activeFloorElements]);
    const dynamicWidth = bounds.maxX - bounds.minX;
    const dynamicHeight = bounds.maxY - bounds.minY;

    // === ПЕРЕМЕЩЕНИЕ И ЗУМ (Pan & Zoom) ===
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const isDragging = useRef(false);
    const draggedRef = useRef(false);
    const initialPointerPos = useRef({ x: 0, y: 0 });
    const activePointers = useRef<Map<number, { x: number, y: number }>>(new Map());
    const startPan = useRef({ x: 0, y: 0 });
    const pinchStart = useRef<{ dist: number, scale: number, cx: number, cy: number, x: number, y: number } | null>(null);

    const enforceTransformBounds = useCallback((x: number, y: number, scale: number) => {
        if (!containerRef.current) return { x, y, scale };
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const minScale = 0.2;
        const maxScale = 5;
        const s = Math.min(Math.max(scale, minScale), maxScale);

        const rw = (dynamicWidth || 500) * s;
        const rh = (dynamicHeight || 500) * s;

        const marginX = Math.min(cw * 0.4, 150);
        const marginY = Math.min(ch * 0.4, 150);
        const minX = cw - rw - marginX;
        const maxX = marginX;
        const minY = ch - rh - marginY;
        const maxY = marginY;

        return {
            x: Math.min(Math.max(x, Math.min(minX, maxX)), Math.max(minX, maxX)),
            y: Math.min(Math.max(y, Math.min(minY, maxY)), Math.max(minY, maxY)),
            scale: s
        };
    }, [dynamicWidth, dynamicHeight]);

    const fitToContainer = useCallback(() => {
        if (!containerRef.current || !bounds) return;
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const mw = dynamicWidth || 500;
        const mh = dynamicHeight || 500;

        const padding = 40;
        let scale = Math.min((cw - padding) / mw, (ch - padding) / mh);
        scale = Math.min(Math.max(scale, 0.2), 5);
        const x = (cw - mw * scale) / 2;
        const y = (ch - mh * scale) / 2;
        setTransform(enforceTransformBounds(x, y, scale));
    }, [bounds, dynamicWidth, dynamicHeight, enforceTransformBounds]);

    useEffect(() => {
        fitToContainer();
    }, [fitToContainer, activeFloorId]);

    // Колесо мыши (Зум)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setTransform(prev => {
                const newScale = prev.scale * (1 + delta);
                const ratio = newScale / prev.scale;
                return enforceTransformBounds(
                    cx - (cx - prev.x) * ratio,
                    cy - (cy - prev.y) * ratio,
                    newScale
                );
            });
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [enforceTransformBounds]);

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.current.size === 1) {
            isDragging.current = true;
            draggedRef.current = false;
            initialPointerPos.current = { x: e.clientX, y: e.clientY };
            startPan.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
        } else if (activePointers.current.size === 2) {
            isDragging.current = false;
            const pts = Array.from(activePointers.current.values()) as { x: number, y: number }[];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const cx = (pts[0].x + pts[1].x) / 2 - rect.left;
                const cy = (pts[0].y + pts[1].y) / 2 - rect.top;
                pinchStart.current = { dist, scale: transform.scale, cx, cy, x: transform.x, y: transform.y };
            }
        }
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!activePointers.current.has(e.pointerId)) return;
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.current.size === 1 && isDragging.current) {
            const dist = Math.hypot(e.clientX - initialPointerPos.current.x, e.clientY - initialPointerPos.current.y);
            if (dist > 5) {
                if (!draggedRef.current) {
                    draggedRef.current = true;
                    try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    } catch (err) { }
                }
            }
            setTransform(prev => enforceTransformBounds(
                e.clientX - startPan.current.x,
                e.clientY - startPan.current.y,
                prev.scale
            ));
        } else if (activePointers.current.size === 2 && pinchStart.current) {
            if (!draggedRef.current) {
                draggedRef.current = true;
                try {
                    e.currentTarget.setPointerCapture(e.pointerId);
                } catch (err) { }
            }
            const pts = Array.from(activePointers.current.values()) as { x: number, y: number }[];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

            const scaleRatio = dist / pinchStart.current.dist;
            const newScale = pinchStart.current.scale * scaleRatio;
            const currentRatio = newScale / pinchStart.current.scale;

            const rect = containerRef.current?.getBoundingClientRect();
            const cx = (pts[0].x + pts[1].x) / 2 - (rect ? rect.left : 0);
            const cy = (pts[0].y + pts[1].y) / 2 - (rect ? rect.top : 0);

            const dx = cx - pinchStart.current.cx;
            const dy = cy - pinchStart.current.cy;

            setTransform(enforceTransformBounds(
                pinchStart.current.x + dx - (pinchStart.current.cx - pinchStart.current.x) * (currentRatio - 1),
                pinchStart.current.y + dy - (pinchStart.current.cy - pinchStart.current.y) * (currentRatio - 1),
                newScale
            ));
        }
    };

    const onPointerUp = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId);
        if (activePointers.current.size < 2) pinchStart.current = null;
        if (activePointers.current.size === 1) {
            const pt = Array.from(activePointers.current.values())[0] as { x: number, y: number };
            isDragging.current = true;
            startPan.current = { x: pt.x - transform.x, y: pt.y - transform.y };
        } else if (activePointers.current.size === 0) {
            isDragging.current = false;
        }
        try {
            if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch (err) { }
    };

    // === КОНЕЦ ЛОГИКИ PAN & ZOOM ===


    if (!restaurant) {
        return <div className="text-center text-gray-400">Загрузка данных ресторана...</div>;
    }

    return (
        <div className="space-y-6">
            {/* View Switcher Tabs */}
            <div className="flex border-b border-brand-accent/30 gap-6 mb-2">
                <button 
                    onClick={() => setActiveView('MAP')}
                    className={`pb-3 text-lg font-bold transition-all relative ${activeView === 'MAP' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Зал и Брони
                    {activeView === 'MAP' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-blue rounded-t-full" />}
                </button>
                <button 
                    onClick={() => setActiveView('GUESTS')}
                    className={`pb-3 text-lg font-bold transition-all relative ${activeView === 'GUESTS' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    База клиентов
                    {activeView === 'GUESTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-blue rounded-t-full" />}
                </button>
            </div>

            {activeView === 'MAP' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            {/* Column 1: Requests */}
            <div className="lg:col-span-1 order-2 lg:order-1">
                <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ color: '#2c1f14' }}>Новые запросы</h2>
                <div className="space-y-4 max-h-[50vh] lg:max-h-[70vh] overflow-y-auto pr-2">
                    {pendingBookings.length > 0 ? (
                        pendingBookings.map(b => (
                            <BookingRequestCard
                                key={b.id}
                                booking={b}
                                restaurantId={restaurant.id}
                                tables={restaurant.layout.filter(el => el.type === 'table') as TableElement[]}
                            />
                        ))
                    ) : (
                        <p className="text-gray-500 text-center py-8">Нет ожидающих запросов.</p>
                    )}
                </div>
            </div>

            {/* Column 2 & 3: Map and Lists */}
            <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">

                {/* Status Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-brand-primary rounded-lg border border-brand-accent p-4">
                        <h3 className="text-lg md:text-xl font-semibold mb-3 text-gray-200">Занятые столики</h3>
                        {occupiedTableBookings.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {occupiedTableBookings.map(({ table, booking }) => (
                                    <div key={table.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-accent/60 rounded-md p-3">
                                        <div>
                                            <p className="font-semibold text-gray-200">Столик {table.label}</p>
                                            <p className="text-xs text-gray-400">
                                                {booking.guestName}
                                            </p>
                                            <DurationEditor booking={booking} />
                                        </div>
                                        <button
                                            onClick={() => updateBookingStatus(booking.id, BookingStatus.COMPLETED)}
                                            className="bg-brand-green text-white px-2 py-1 text-xs font-semibold rounded-md hover:bg-green-700 transition-colors"
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
                        {restaurant.bookings.filter(b => b.status === BookingStatus.CONFIRMED && new Date(b.dateTime) > new Date()).length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {restaurant.bookings
                                    .filter(b => b.status === BookingStatus.CONFIRMED && new Date(b.dateTime) > new Date())
                                    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                                    .map(booking => (
                                        <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-accent/40 rounded-md p-3">
                                            <div>
                                                <p className="font-semibold text-sm text-gray-200">{booking.guestName} ({booking.guestCount} ч.)</p>
                                                <p className="text-xs text-brand-blue font-medium">{booking.guestPhone}</p>
                                                <p className="text-xs text-gray-400">
                                                    Ст. {booking.tableLabel} • {new Date(booking.dateTime).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}
                                                </p>
                                                <DurationEditor booking={booking} />
                                            </div>
                                            <button
                                                onClick={() => updateBookingStatus(booking.id, BookingStatus.DECLINED, "Отменено администратором")}
                                                className="bg-brand-red text-white px-2 py-1 text-xs font-semibold rounded self-start sm:self-center hover:bg-red-700 transition-colors"
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

                    <div className="bg-brand-primary rounded-lg border border-brand-accent p-4 md:col-span-2">
                        <h3 className="text-lg md:text-xl font-semibold mb-3">Отмененные / Отклоненные</h3>
                        {restaurant.bookings.filter(b => b.status === BookingStatus.CANCELLED || b.status === BookingStatus.DECLINED).length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {restaurant.bookings
                                    .filter(b => b.status === BookingStatus.CANCELLED || b.status === BookingStatus.DECLINED)
                                    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
                                    .map(booking => (
                                        <div key={booking.id} className="bg-brand-accent/20 border border-brand-accent/30 rounded-md p-3">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                                <div>
                                                    <p className="font-semibold text-sm text-gray-300">
                                                        {booking.guestName} ({booking.guestCount} ч.) 
                                                        <span className={`ml-2 px-2 py-0.5 rounded text-[10px] uppercase font-bold ${booking.status === BookingStatus.CANCELLED ? 'bg-brand-red/20 text-brand-red' : 'bg-gray-700 text-gray-400'}`}>
                                                            {booking.status === BookingStatus.CANCELLED ? (booking.cancelledBy === 'guest' ? 'Отменено гостем' : 'Отменено') : 'Отклонено'}
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(booking.dateTime).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}
                                                        {booking.tableLabel && ` • Стол ${booking.tableLabel}`}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    {booking.status === BookingStatus.CANCELLED ? (
                                                        <p className="text-xs text-brand-red italic">Причина: {booking.cancelReason}{booking.cancelComment ? ` (${booking.cancelComment})` : ''}</p>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 italic">Причина: {booking.declineReason || 'Не указана'}</p>
                                                    )}
                                                    <p className="text-[10px] text-gray-600 mt-1">
                                                        {booking.status === BookingStatus.CANCELLED && booking.cancelledAt && `Обновлено: ${new Date(booking.cancelledAt).toLocaleString('ru-RU')}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Пусто.</p>
                        )}
                    </div>
                </div>

                {/* Map Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#2c1f14' }}>План зала</h2>
                    {restaurant.floors && restaurant.floors.length > 1 && (
                        <div className="flex bg-brand-secondary p-1 rounded-lg border border-brand-accent overflow-x-auto max-w-full">
                            {restaurant.floors.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFloorId(f.id)}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-all ${activeFloorId === f.id ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    {f.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Map Container */}
                <div
                    ref={containerRef}
                    className="w-full bg-[#3d2e23] bg-opacity-50 rounded-xl border-2 border-brand-accent shadow-inner relative flex-grow min-h-[400px] h-[500px] md:h-[600px] overflow-hidden"
                    style={{ touchAction: 'none', cursor: isDragging.current ? 'grabbing' : 'grab' }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onPointerUp}
                >
                    <div
                        className="absolute top-0 left-0 origin-top-left will-change-transform"
                        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                    >
                        <div style={{ width: dynamicWidth, height: dynamicHeight, position: 'relative' }}>
                            {activeFloorElements.map(el => {
                                if (el.type !== 'table') {
                                    let content = null;
                                    let classes = `absolute flex items-center justify-center pointer-events-none`;

                                    if (el.type === 'text') {
                                        const textEl = el as TextElement;
                                        classes += ` bg-transparent text-center leading-tight overflow-hidden`;
                                        content = <div style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#2c1f14' }} className="w-full h-full flex items-center justify-center p-1 font-bold">{textEl.label}</div>;
                                    } else if (el.type === 'arrow') {
                                        classes += ` text-[#2c1f14] opacity-60`;
                                        content = (
                                            <svg viewBox={`0 0 ${el.width} ${el.height}`} fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
                                                <path d={`M 5 ${el.height / 2} H ${el.width - 15}`} strokeLinecap="round" />
                                                <path d={`M ${el.width - 25} ${el.height / 2 - 10} L ${el.width - 5} ${el.height / 2} L ${el.width - 25} ${el.height / 2 + 10}`} strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        );
                                    } else if (el.type === 'stairs') {
                                        classes += ` bg-gray-300 shadow-sm opacity-80`;
                                        content = (
                                            <div className="w-full h-full flex flex-col justify-evenly">
                                                {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-gray-400"></div>)}
                                            </div>
                                        );
                                    } else if (el.type === 'plant') {
                                        classes += ` bg-transparent`;
                                        content = (
                                            <div className="relative w-full h-full flex items-center justify-center drop-shadow-md">
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
                                            wall: 'bg-gray-500 shadow-sm',
                                            bar: 'bg-yellow-800 border-2 border-yellow-900 shadow-lg',
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
                                            new Date(b.dateTime) <= now
                                    )
                                    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())[0];
                                const isPending = restaurant.bookings.some(
                                    b => b.tableId === el.id && b.status === BookingStatus.PENDING && new Date(b.dateTime) <= now
                                );

                                let statusColor = 'bg-brand-green/80 shadow-[0_0_15px_rgba(74,222,128,0.3)] hover:bg-brand-green';
                                if (currentBooking) statusColor = 'bg-brand-red/80 cursor-not-allowed opacity-90';
                                if (isPending) statusColor = 'bg-brand-yellow/80 cursor-wait opacity-90';

                                if (!currentBooking && !isPending) {
                                    const nextBooking = restaurant.bookings
                                        .filter(b =>
                                            b.tableId === el.id &&
                                            (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED || b.status === BookingStatus.PENDING) &&
                                            new Date(b.dateTime) > now
                                        )
                                        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())[0];

                                    if (nextBooking && (new Date(nextBooking.dateTime).getTime() - now.getTime()) < 60 * 60 * 1000) {
                                        statusColor = 'bg-brand-red/80 cursor-not-allowed opacity-90';
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
                                        className={`absolute flex items-center justify-center font-bold text-gray-200 transition-all duration-300 ${shapeClasses} ${statusColor} cursor-pointer hover:scale-[1.05]`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (draggedRef.current) return;
                                            setSelectedTable(el as TableElement);
                                        }}
                                    >
                                        <span style={{ fontSize: `${fontSize}px` }}>{el.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Zoom Controls Overlay */}
                    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10" onPointerDown={e => e.stopPropagation()}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setTransform(p => enforceTransformBounds(p.x, p.y, p.scale * 1.3)) }}
                            className="w-10 h-10 bg-brand-primary/80 backdrop-blur-sm text-white font-bold rounded-full shadow-lg border border-brand-accent flex items-center justify-center hover:bg-brand-accent active:scale-95 transition-all"
                        >
                            +
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setTransform(p => enforceTransformBounds(p.x, p.y, p.scale / 1.3)) }}
                            className="w-10 h-10 bg-brand-primary/80 backdrop-blur-sm text-white font-bold rounded-full shadow-lg border border-brand-accent flex items-center justify-center hover:bg-brand-accent active:scale-95 transition-all"
                        >
                            -
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); fitToContainer() }}
                            className="w-10 h-10 bg-brand-blue/90 backdrop-blur-sm text-white text-lg rounded-full shadow-lg border border-blue-400 flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all mt-2"
                            title="Центрировать"
                        >
                            ⛶
                        </button>
                    </div>
                </div>
            </div>

                    {selectedTable && (
                        <BookingModal
                            table={selectedTable}
                            restaurantId={restaurant.id}
                            onClose={() => setSelectedTable(null)}
                            isAdmin={true}
                        />
                    )}
                </div>
            ) : (
                <div className="animate-fadeIn h-[70vh]">
                    <GuestManager />
                </div>
            )}
        </div>
    );
};

export default AdminView;