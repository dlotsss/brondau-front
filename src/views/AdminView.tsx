import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Booking, BookingStatus, TableElement, TextElement, DecoElement } from '../types';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../context/I18nContext';
import BookingModal from '../components/BookingModal';
import GuestManager from '../components/GuestManager';
import { api } from '../services/api';
import { registerServiceWorker, subscribeToPush } from '../services/pushService';
import { LayoutElement } from '../types';
import FutureBookingsManager from '../components/FutureBookingsManager';

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

const CountdownTimer: React.FC<{ createdAt: Date, deadlineAt?: Date }> = ({ createdAt, deadlineAt }) => {
    const { t } = useTranslation();
    const target = useMemo(() => deadlineAt || new Date(createdAt.getTime() + 60 * 60 * 1000), [createdAt, deadlineAt]);
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const updateTimer = () => {
            const remaining = (target.getTime() - new Date().getTime()) / 1000;
            setTimeLeft(Math.max(0, remaining));
        };
        updateTimer();
        const intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);
    }, [target]);

    const minutesTotal = Math.floor(timeLeft / 60);
    const minutes = Math.floor(timeLeft / 60) % 60;
    const seconds = Math.floor(timeLeft % 60);
    const timeColor = timeLeft < 60 ? 'text-brand-red' : 'text-brand-yellow';

    if (timeLeft > 3600) {
        return <span className={`font-mono font-bold text-brand-blue`}>{t('admin.frozen')}</span>;
    }

    return <span className={`font-mono font-bold ${timeColor}`}>{minutesTotal}:{seconds.toString().padStart(2, '0')}</span>;
};

const DurationEditor: React.FC<{ booking: Booking }> = ({ booking }) => {
    const { updateBookingStatus } = useData();
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(booking.duration || 60);

    if (!isEditing) {
        return (
            <button
                onClick={() => setIsEditing(true)}
                className="text-[10px] text-gray-500 hover:text-brand-blue flex items-center gap-1"
                title={t('admin.changeDuration')}
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {booking.duration || 120} {t('admin.min')}
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
                {t('admin.ok')}
            </button>
        </div>
    );
};

const BookingRequestCard: React.FC<{ booking: Booking; restaurantId: string; tables: TableElement[] }> = ({ booking, restaurantId, tables }) => {
    const { updateBookingStatus } = useData();
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [isDeclining, setIsDeclining] = useState(false);
    const [assignedTableIds, setAssignedTableIds] = useState<string[]>([]);
    const [customDuration, setCustomDuration] = useState<number>(booking.duration || 60);
    const [assignedTo, setAssignedTo] = useState<string>(booking.assignedTo || '');
    const [staffNames, setStaffNames] = useState<string[]>([]);
    const needsTableAssignment = !booking.tableId && (!booking.tableIds || booking.tableIds.length === 0);

    useEffect(() => {
        api.restaurants.getStaffNames(restaurantId).then(setStaffNames).catch(() => { });
    }, [restaurantId]);

    const toggleTable = (id: string) => {
        setAssignedTableIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const handleConfirm = async () => {
        if (!assignedTo?.trim()) {
            alert(t('admin.pleaseSelectResponsible'));
            return;
        }

        if (needsTableAssignment && assignedTableIds.length === 0) {
            alert(t('admin.pleaseSelectTables'));
            return;
        }

        const totalSeats = assignedTableIds.reduce((sum, id) => {
            const tbl = tables.find(t => t.id === id);
            return sum + (tbl?.seats || 2);
        }, 0);

        if (needsTableAssignment && totalSeats < booking.guestCount) {
            if (!window.confirm(t('admin.capacityWarning', { totalSeats: String(totalSeats), guestCount: String(booking.guestCount) }))) {
                return;
            }
        }

        try {
            if (needsTableAssignment) {
                const labels = assignedTableIds.map(id => tables.find(tbl => tbl.id === id)?.label || '');
                await updateBookingStatus(booking.id, BookingStatus.CONFIRMED, undefined, undefined, undefined, customDuration, assignedTableIds, labels, assignedTo || undefined);
            } else {
                await updateBookingStatus(booking.id, BookingStatus.CONFIRMED, undefined, undefined, undefined, customDuration, undefined, undefined, assignedTo || undefined);
            }
        } catch (err: any) {
            alert(err.message || t('admin.statusUpdateError'));
        }
    };

    const handleDecline = () => {
        if (!reason.trim()) {
            alert(t('admin.provideDeclineReason'));
            return;
        }
        updateBookingStatus(booking.id, BookingStatus.DECLINED, reason);
    };

    return (
        <div className="bg-brand-accent p-4 rounded-lg shadow-md border border-brand-accent/50">
            <div className="flex justify-between items-center flex-wrap gap-2 mb-1">
                <h4 className="font-bold text-lg text-white">
                    {booking.tableLabels?.length ? t('admin.assignedTables', { labels: booking.tableLabels.join(', ') }) : booking.tableLabel ? t('admin.assignedTable', { label: booking.tableLabel }) : <span className="text-yellow-400">{t('admin.noTableAssigned')}</span>}
                </h4>
                <div className="text-sm font-semibold text-gray-200">
                    {t('admin.timeLeft')} <CountdownTimer createdAt={booking.createdAt} deadlineAt={booking.deadlineAt} />
                </div>
            </div>
            <p className="text-sm font-medium text-gray-200">{booking.guestName} ({booking.guestCount} {t('admin.guestsText')})</p>
            <p className="text-sm font-bold text-brand-blue drop-shadow-sm">{booking.guestPhone}</p>
            <p className="text-xs font-medium text-brand-yellow mb-2">{new Date(booking.dateTime).toLocaleString('ru-RU')}</p>

            {booking.guestComment && (
                <div className="mt-2 mb-2 p-2 bg-black/20 rounded border border-gray-600/50">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{t('admin.guestCommentLabel')}</p>
                    <p className="text-sm text-white italic">"{booking.guestComment}"</p>
                </div>
            )}

            {/* Table assignment for no-map bookings (multiple selection) */}
            {needsTableAssignment && !isDeclining && (
                <div className="mt-3">
                    <label className="text-xs text-brand-yellow block mb-2 font-bold">{t('admin.assignTablesLabel')}</label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                        {tables.map(tbl => {
                            const isSelected = assignedTableIds.includes(tbl.id);
                            return (
                                <button
                                    key={tbl.id}
                                    onClick={() => toggleTable(tbl.id)}
                                    className={`px-2 py-1 text-xs rounded-md font-semibold border transition-colors ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'bg-brand-primary border-gray-600 text-gray-300 hover:border-gray-400'}`}
                                >
                                    {t('admin.tableLabelAdmin', { label: String(tbl.label), seats: String(tbl.seats) })}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Duration assignment */}
            {!isDeclining && (
                <div className="mt-3">
                    <label className="text-xs text-gray-200 font-medium block mb-1">{t('admin.durationLabel')}</label>
                    <input
                        type="number"
                        value={customDuration}
                        onChange={e => setCustomDuration(parseInt(e.target.value))}
                        className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm text-white focus:outline-none focus:border-brand-blue"
                    />
                </div>
            )}

            {/* Responsible staff assignment */}
            {!isDeclining && (
                <div className="mt-3 relative">
                    <label className="text-xs text-gray-200 font-medium block mb-1">
                        {t('admin.responsibleLabel')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={assignedTo}
                            onChange={e => setAssignedTo(e.target.value)}
                            placeholder={t('admin.managerNamePlaceholder')}
                            className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm text-white focus:outline-none focus:border-brand-blue placeholder-gray-500"
                        />
                        {staffNames.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {staffNames.filter(n => !assignedTo || n.toLowerCase().includes(assignedTo.toLowerCase())).map(name => (
                                    <button
                                        key={name}
                                        onClick={() => setAssignedTo(name)}
                                        className="text-[12px] bg-brand-primary px-2 py-0.5 rounded border border-gray-700 hover:border-brand-blue text-gray-300 transition-colors"
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isDeclining ? (
                <div className="mt-4 space-y-2">
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t('admin.declineReasonPlaceholder')}
                        className="w-full bg-brand-primary p-2 rounded-md border border-gray-600 text-sm focus:outline-none focus:border-brand-blue"
                    />
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                        <button onClick={handleDecline} className="flex-1 bg-brand-red text-white px-3 py-2 text-sm rounded-md hover:bg-red-700">{t('admin.confirm')}</button>
                        <button onClick={() => setIsDeclining(false)} className="bg-gray-500 text-white px-3 py-2 text-sm rounded-md hover:bg-gray-600">{t('common.cancel')}</button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button onClick={handleConfirm} className="flex-1 bg-brand-green text-white px-3 py-2 text-sm font-semibold rounded-md hover:bg-green-700 transition-colors">{t('admin.confirm')}</button>
                    <button onClick={() => setIsDeclining(true)} className="flex-1 bg-brand-red text-white px-3 py-2 text-sm font-semibold rounded-md hover:bg-red-700 transition-colors">{t('admin.decline')}</button>
                </div>
            )}
        </div>
    );
};

const AdminView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant, updateBookingStatus } = useData();
    const { t } = useTranslation();
    const [selectedTable, setSelectedTable] = useState<TableElement | null>(null);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [activeView, setActiveView] = useState<'MAP' | 'GUESTS' | 'FUTURE'>('MAP');
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

    const todayFutureBookings = useMemo(() => {
        if (!restaurant) return [];
        const todayStr = new Date().toISOString().split('T')[0];
        return restaurant.bookings
            .filter(b => {
                if (b.status !== BookingStatus.CONFIRMED) return false;
                return new Date(b.dateTime).toISOString().split('T')[0] === todayStr;
            })
            .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    }, [restaurant]);

    const occupiedTableBookings = useMemo(() => {
        if (!restaurant) return [];

        return (restaurant.layout.filter(el => el.type === 'table') as TableElement[])
            .map(table => {
                const booking = restaurant.bookings.find(b =>
                    (b.tableId === table.id || b.tableIds?.includes(table.id)) &&
                    b.status === BookingStatus.OCCUPIED
                );
                return booking ? { table, booking } : null;
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
        return <div className="text-center text-gray-400">{t('admin.loadingRestaurant')}</div>;
    }

    return (
        <div className="space-y-6">
            {/* View Switcher Tabs */}
            <div className="flex border-b border-brand-accent/30 gap-6 mb-2 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveView('MAP')}
                    className={`pb-3 text-lg font-bold transition-all relative whitespace-nowrap ${activeView === 'MAP' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    {t('admin.mapAndBookingsTab')}
                    {activeView === 'MAP' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-blue rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveView('FUTURE')}
                    className={`pb-3 text-lg font-bold transition-all relative whitespace-nowrap ${activeView === 'FUTURE' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    {t('admin.bookingsTab')}
                    {activeView === 'FUTURE' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-blue rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveView('GUESTS')}
                    className={`pb-3 text-lg font-bold transition-all relative whitespace-nowrap ${activeView === 'GUESTS' ? 'text-brand-blue' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    {t('admin.guestsTab')}
                    {activeView === 'GUESTS' && <div className="absolute bottom-0 left-0 w-full h-1 bg-brand-blue rounded-t-full" />}
                </button>
            </div>

            {activeView === 'MAP' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                    {/* Column 1: Requests */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <h2 className="text-xl md:text-2xl font-bold mb-4 text-brand-primary">{t('admin.newRequests')}</h2>
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
                                <p className="text-gray-500 text-center py-8">{t('admin.noPendingRequests')}</p>
                            )}
                        </div>
                    </div>

                    {/* Column 2 & 3: Map and Lists */}
                    <div className="lg:col-span-2 space-y-6 order-1 lg:order-2">

                        {/* Status Sections */}
                        <div className="space-y-4">
                            {/* 1. Today's Future Bookings - Full Width Highlighted */}
                            <div className="bg-[#1a1c23] rounded-xl border-l-4 border-brand-blue p-4 shadow-lg mb-4">
                                <div className="flex items-center justify-between mb-3 border-b border-brand-accent/30 pb-2">
                                    <h3 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                                        {t('admin.expectedGuests')}
                                        <span className="bg-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-full text-xs">{todayFutureBookings.length}</span>
                                    </h3>
                                </div>
                                {todayFutureBookings.length > 0 ? (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                        {todayFutureBookings.map(booking => {
                                            const timeStr = new Date(booking.dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                                            const isPast = new Date(booking.dateTime) < new Date();
                                            return (
                                                <div key={booking.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all hover:bg-white/5 ${isPast ? 'bg-brand-red/10 border-brand-red/30' : 'bg-brand-primary border-brand-accent'} group`}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-brand-blue font-bold font-mono text-lg">{timeStr}</span>
                                                            <span className="font-bold text-gray-200 group-hover:text-white transition-colors">{booking.guestName}</span>
                                                            <span className="text-xs text-gray-400 font-mono hidden sm:inline">{booking.guestPhone}</span>
                                                            <button
                                                                onClick={() => setEditingBooking(booking)}
                                                                className="text-gray-500 hover:text-brand-blue transition-colors p-1 opacity-50 hover:opacity-100"
                                                                title={t('admin.editBookingTitle')}
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <svg className="w-3 h-3 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                                {booking.guestCount}
                                                            </span>
                                                            <span className="flex items-center gap-1 text-white bg-white/5 px-2 py-0.5 rounded">
                                                                {t('admin.tableShort', { labels: booking.tableLabels?.length ? booking.tableLabels.join(', ') : (booking.tableLabel || t('admin.tableNotAssigned')) })}
                                                            </span>
                                                            {isPast && (
                                                                <span className="text-brand-red font-bold uppercase tracking-wider animate-pulse">{t('admin.late')}</span>
                                                            )}
                                                            {booking.guestComment && <span className="italic truncate max-w-[150px] text-gray-500">"{booking.guestComment}"</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2 shrink-0">
                                                        <button
                                                            onClick={() => updateBookingStatus(booking.id, BookingStatus.OCCUPIED)}
                                                            className="bg-brand-green/20 text-brand-green hover:bg-brand-green hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-all border border-brand-green/30"
                                                        >
                                                            {t('admin.arrived')}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm(t('admin.cancelBookingConfirm'))) updateBookingStatus(booking.id, BookingStatus.DECLINED, t('admin.cancelledByAdmin'));
                                                            }}
                                                            className="text-brand-red hover:bg-brand-red/20 px-2 py-1.5 rounded text-xs transition-colors border border-transparent hover:border-brand-red/30"
                                                        >
                                                            {t('common.cancel')}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-gray-500 text-sm italic">
                                        {t('admin.noExpectedGuestsToday')}
                                    </div>
                                )}
                            </div>

                            {/* Occupied Tables */}
                            <div className="bg-brand-primary rounded-lg border border-brand-accent p-4">
                                <h3 className="text-sm font-bold text-gray-400 mb-3 border-b border-brand-accent/30 pb-1 uppercase tracking-wider">{t('admin.occupiedTablesTitle')}</h3>
                                {occupiedTableBookings.length > 0 ? (
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {occupiedTableBookings.map(({ table, booking }) => {
                                            const startTime = new Date(booking.dateTime).getTime();
                                            const duration = booking.duration || 60;
                                            const endTime = startTime + duration * 60000;
                                            const timeLeft = Math.max(0, Math.floor((endTime - Date.now()) / 60000));

                                            return (
                                                <div key={table.id} className="flex items-center justify-between gap-2 bg-brand-green/10 border border-brand-green/30 rounded-md p-2">
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-brand-green text-xs truncate">{t('admin.tableShort', { labels: table.label })} — {booking.guestName}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="text-[10px] font-bold text-brand-red border border-brand-red/30 px-1.5 py-0.5 rounded bg-brand-red/5">
                                                                {timeLeft} {t('admin.min')}
                                                            </div>
                                                            <DurationEditor booking={booking} />
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => updateBookingStatus(booking.id, BookingStatus.COMPLETED)}
                                                        className="bg-brand-green text-white px-2 py-1 text-[10px] font-bold rounded hover:bg-green-700 transition-colors shrink-0"
                                                    >
                                                        {t('admin.freeTable')}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-[10px] italic py-2">{t('admin.noOccupiedTables')}</p>
                                )}
                            </div>
                        </div>

                        {/* Map Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
                            <h2 className="text-xl md:text-2xl font-bold text-brand-primary">{t('admin.hallPlan')}</h2>
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
                                                content = <div style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#ffffff' }} className="w-full h-full flex items-center justify-center p-1 font-bold">{textEl.label}</div>;
                                            } else if (el.type === 'arrow') {
                                                classes += ` text-white opacity-60`;
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
                                        const relevantBookings = restaurant.bookings.filter(b =>
                                            (b.tableId === el.id || b.tableIds?.includes(el.id)) &&
                                            [BookingStatus.CONFIRMED, BookingStatus.OCCUPIED].includes(b.status)
                                        ).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

                                        const occupied = relevantBookings.find(b => b.status === BookingStatus.OCCUPIED);
                                        const confirmed = relevantBookings.find(b => b.status === BookingStatus.CONFIRMED);

                                        let statusColor = 'bg-[rgb(59,130,246)]/80 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:bg-[rgb(59,130,246)]'; // BLUE: Default

                                        if (occupied) {
                                            statusColor = 'bg-brand-green/80 shadow-[0_0_15px_rgba(74,222,128,0.3)] hover:bg-brand-green'; // GREEN: Occupied
                                        } else if (confirmed) {
                                            const startTime = new Date(confirmed.dateTime).getTime();
                                            const timeDiff = startTime - now.getTime();

                                            if (timeDiff < 0) {
                                                statusColor = 'bg-brand-red/80 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:bg-brand-red'; // RED: Confirmed & Past
                                            } else if (timeDiff <= 60 * 60000) {
                                                statusColor = 'bg-brand-yellow/80 shadow-[0_0_15px_rgba(234,179,8,0.4)] hover:bg-brand-yellow'; // YELLOW: Confirmed & <= 1h
                                            }
                                        } else if (restaurant.bookings.some(b => (b.tableId === el.id || b.tableIds?.includes(el.id)) && b.status === BookingStatus.PENDING)) {
                                            statusColor = 'bg-brand-yellow/40 cursor-wait shadow-inner opacity-80'; // Subtle yellow for pending
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
                </div>
            ) : activeView === 'GUESTS' ? (
                <div className="animate-fadeIn h-[70vh]">
                    <GuestManager restaurantId={restaurant.id} />
                </div>
            ) : (
                <FutureBookingsManager
                    restaurantId={restaurant.id}
                    onEditBooking={(b) => setEditingBooking(b)}
                />
            )}

            {(selectedTable || editingBooking) && (
                <BookingModal
                    table={editingBooking ? ((restaurant.layout || []).find(el => el.type === 'table' && el.id === editingBooking.tableId) as TableElement || null) : selectedTable}
                    restaurantId={restaurant.id}
                    onClose={() => {
                        setSelectedTable(null);
                        setEditingBooking(null);
                    }}
                    isAdmin={true}
                    withMap={restaurant.with_map}
                    bookingToEdit={editingBooking || undefined}
                />
            )}
        </div>
    );
};

export default AdminView;