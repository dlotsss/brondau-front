import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, BookingStatus, DecoElement, TextElement } from '../types';
import BookingModal from '../components/BookingModal';
import GuestMenuModal from '../components/GuestMenuModal';
import { useApp } from '../context/AppContext';
import { useTranslation } from '../context/I18nContext';

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
                                return <strong key={j} className="font-bold">{part.slice(3, -4)}</strong>;
                            }
                            return <span key={j}>{part}</span>;
                        })}
                    </p>
                );
            })}
        </div>
    );
};

// Функция для вычисления границ занятой территории
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

const Table: React.FC<{
    table: TableElement;
    status: string;
    onClick: () => void;
    offsetX: number;
    offsetY: number;
}> = ({ table, status, onClick, offsetX, offsetY }) => {
    const statusClasses: { [key: string]: string } = {
        available: 'bg-brand-green/80 hover:bg-brand-green cursor-pointer shadow-[0_0_15px_rgba(74,222,128,0.3)]',
        confirmed: 'bg-brand-red/80 cursor-not-allowed opacity-90',
        pending: 'bg-brand-yellow/80 cursor-not-allowed opacity-90',
    };

    const baseClasses = "absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold text-white transition-all duration-300 hover:scale-[1.05] group";
    const shapeClasses = table.shape === 'circle' ? 'rounded-full' : 'rounded-md';
    const fontSize = Math.min(table.width, table.height) * 0.4;

    return (
        <div
            style={{
                left: `${table.x - offsetX}px`,
                top: `${table.y - offsetY}px`,
                width: `${table.width}px`,
                height: `${table.height}px`,
                transform: `translate(-50%, -50%) rotate(${table.rotation || 0}deg)`,
            }}
            className={`${baseClasses} ${shapeClasses} ${statusClasses[status]}`}
            onClick={(e) => {
                e.stopPropagation();
                if (status === 'available') onClick();
            }}
        >
            <span style={{ fontSize: `${fontSize}px` }}>{table.label}</span>
        </div>
    );
};

const Deco: React.FC<{
    element: LayoutElement;
    offsetX: number;
    offsetY: number;
}> = ({ element, offsetX, offsetY }) => {
    if (element.type === 'table') return null;

    const baseStyles = {
        left: `${element.x - offsetX}px`,
        top: `${element.y - offsetY}px`,
        width: `${(element as any).width}px`,
        height: `${(element as any).height}px`,
        transform: `translate(-50%, -50%) rotate(${element.rotation || 0}deg)`,
    };

    let content = null;
    let classes = 'absolute flex items-center justify-center pointer-events-none';

    if (element.type === 'text') {
        const textEl = element as TextElement;
        classes += ' bg-transparent text-center leading-tight overflow-hidden';
        content = (
            <div
                style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#ffffff' }}
                className="w-full h-full flex items-center justify-center p-1 font-bold"
            >
                {textEl.label}
            </div>
        );
    } else if (element.type === 'arrow') {
        classes += ' text-white/60';
        content = (
            <svg viewBox={`0 0 ${(element as any).width} ${(element as any).height}`} fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full opacity-60">
                <path d={`M 5 ${(element as any).height / 2} H ${(element as any).width - 15}`} strokeLinecap="round" />
                <path d={`M ${(element as any).width - 25} ${(element as any).height / 2 - 10} L ${(element as any).width - 5} ${(element as any).height / 2} L ${(element as any).width - 25} ${(element as any).height / 2 + 10}`} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    } else if (element.type === 'stairs') {
        classes += ' bg-[#4A4A4A] shadow-sm opacity-80 rounded-md';
        content = (
            <div className="w-full h-full flex flex-col justify-evenly p-1">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-full h-[2px] bg-[#6A6A6A]"></div>
                ))}
            </div>
        );
    } else if (element.type === 'plant') {
        classes += ' bg-transparent';
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
        const decoStyles: { [key: string]: string } = {
            wall: 'bg-[#4A4A4A] shadow-sm rounded-sm',
            bar: 'bg-[#5c4033] border border-[#3b271d] shadow-lg rounded-sm',
            window: 'bg-sky-200/20 border border-sky-300/40 rounded-sm',
        };
        classes += ' ' + (decoStyles[(element as DecoElement).type] || 'bg-gray-400');

        if (element.type === 'window') {
            content = (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-[1px] h-full bg-sky-300/30"></div>
                </div>
            );
        }
    }

    return <div style={baseStyles} className={classes}>{content}</div>;
};

const UserView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant } = useData();
    const [selectedTable, setSelectedTable] = useState<TableElement | null>(null);
    const [showNoMapModal, setShowNoMapModal] = useState(false);
    const [showMenuModal, setShowMenuModal] = useState(false);

    const { t, language } = useTranslation();
    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);

    const restaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;
    const withMap = restaurant?.with_map !== false; // default true if not set

    useEffect(() => {
        if (restaurant && !isInitialized) {
            const floors = restaurant.floors;
            if (floors && floors.length > 0) {
                setActiveFloorId(floors[0].id);
            }
            setIsInitialized(true);
        }
    }, [restaurant, isInitialized]);

    const tableStatuses = useMemo(() => {
        if (!restaurant) return {};
        const statuses: { [key: string]: string } = {};
        const nowTime = Date.now();
        const effectiveRestriction = restaurant?.bookingRestriction && restaurant.bookingRestriction !== -1 ? restaurant.bookingRestriction : 60;
        const tables = restaurant.layout.filter(el => el.type === 'table') as TableElement[];

        tables.forEach(table => {
            const activePending = restaurant.bookings.find(b => {
                if (b.tableId !== table.id && (!b.tableIds || !b.tableIds.includes(table.id))) return false;
                if (b.status !== BookingStatus.PENDING) return false;
                const bDuration = b.duration || effectiveRestriction;
                const bookingStart = new Date(b.dateTime).getTime();
                const bookingEnd = bookingStart + bDuration * 60000;
                return nowTime >= bookingStart && nowTime < bookingEnd;
            });

            const activeConfirmed = restaurant.bookings.find(b => {
                if (b.tableId !== table.id && (!b.tableIds || !b.tableIds.includes(table.id))) return false;
                if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.OCCUPIED) return false;
                const bDuration = b.duration || effectiveRestriction;
                const bookingStart = new Date(b.dateTime).getTime();
                const bookingEnd = bookingStart + bDuration * 60000;
                return nowTime >= bookingStart && nowTime < bookingEnd;
            });

            if (activePending) statuses[table.id] = 'pending';
            else if (activeConfirmed) statuses[table.id] = 'confirmed';
            else statuses[table.id] = 'available';
        });

        return statuses;
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

    // Обработка колеса мыши для зума
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
                draggedRef.current = true; // Считаем зум тоже перемещением (отмена клика)
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

    const handleMainBookClick = () => {
        if (withMap) {
            // Scroll to map
            document.getElementById('restaurant-map')?.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Open standard booking modal
            setShowNoMapModal(true);
        }
    };

    if (!restaurant) {
        return <div className="text-center text-[#A3A3A3] flex items-center justify-center h-screen bg-[#1A1513]"><span className="animate-pulse">{t('common.loading')}</span></div>;
    }

    return (
        <div className="rounded-xl bg-[#1A1513] flex flex-col gap-6 pl-6 pr-6 pt-6 md:gap-8 pb-6 w-full max-w-7xl mx-auto">
            {/* HERO SECTION */}
            <div className="relative w-full h-[300px] md:h-[450px] rounded-2xl md:rounded-[32px] overflow-hidden shadow-2xl group border border-[#2A2A2A]">
                {restaurant.photoUrl ? (
                    <img src={restaurant.photoUrl} alt="Hero" className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#2A2A2A] to-[#121212] flex items-center justify-center">
                        <span className="text-8xl opacity-10">🍽️</span>
                    </div>
                )}
                {/* Smooth Dark Gradient Masking */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/50 to-transparent"></div>

                <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
                    <div className="flex items-center md:items-end gap-5 md:gap-8">
                        {restaurant.logoUrl && (
                            <img
                                src={restaurant.logoUrl}
                                alt="Logo"
                                className="w-20 h-20 md:w-32 md:h-32 p-2 rounded-2xl object-contain border-2 border-[#2A2A2A] shadow-2xl bg-white flex-shrink-0"
                            />
                        )}
                        <div className="mb-1 md:mb-2">
                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-[#FAF9F6] tracking-tight">{restaurant.name}</h2>
                            <p className="text-[#A3A3A3] mt-2 md:mt-3 text-sm md:text-lg font-medium max-w-2xl leading-relaxed">
                                {restaurant.description || t('userView.fillForm')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* BOOKING CTA CARD */}
            <div className="bg-[#1A1513] rounded-2xl md:rounded-[32px] p-6 md:p-10 shadow-2xl border border-[#2A2A2A] flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
                <div className="flex-1 z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center gap-2 bg-[#2A2A2A]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-green-500/30 w-fit">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                            <span className="text-green-400 text-xs font-bold uppercase tracking-wider">{t('app.available') || 'Available Tonight!'}</span>
                        </div>
                        {restaurant.menu && (
                            <button
                                onClick={() => setShowMenuModal(true)}
                                className="bg-[#2A2A2A]/80 hover:bg-[#3A3A3A] text-[#FAF9F6] border border-[#4A4A4A] backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#D4A373]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                {t('userView.viewMenu') || 'Меню'}
                            </button>
                        )}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold text-[#FAF9F6]">{t('userView.onlineBooking')}</h3>
                    <p className="text-[#8A8A8A] text-sm md:text-base mt-2 max-w-lg">{t('userView.leaveRequest')}</p>
                </div>

                <div className="w-full md:w-auto z-10">
                    <button
                        onClick={handleMainBookClick}
                        className="w-full md:w-auto bg-[#E07A5F] hover:bg-[#c96c53] active:scale-[0.98] text-[#FAF9F6] font-bold text-base md:text-lg px-10 py-4 rounded-xl shadow-[0_4px_20px_rgba(224,122,95,0.4)] transition-all duration-300 whitespace-nowrap"
                    >
                        {t('userView.bookTableButton')}
                    </button>
                </div>
            </div>

            {/* DEPOSIT / AGE RESTRICTION NOTICES */}
            {(() => {
                const depositText = language === 'kz' && restaurant.deposit_kz && restaurant.deposit_kz.trim() !== '' ? restaurant.deposit_kz : restaurant.deposit;
                return depositText && depositText.trim() !== '' ? (
                    <div className="flex bg-[#E07A5F]/10 border border-[#E07A5F]/30 rounded-2xl p-5 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#E07A5F] mr-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-[#D4A373] font-medium text-sm md:text-base w-full"><FormattedMessage text={depositText} /></div>
                    </div>
                ) : null;
            })()}

            {/* MAP SECTION (Only if withMap) */}
            {withMap && (
                <div id="restaurant-map" className="bg-[#1A1513] rounded-2xl md:rounded-[32px] p-6 md:p-8 shadow-2xl border border-[#2A2A2A] flex flex-col flex-grow">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h3 className="text-xl md:text-2xl font-bold text-[#FAF9F6]">{t('app.map') || 'Карта зала'}</h3>
                            <p className="text-[#8A8A8A] text-sm mt-1">{t('userView.clickGreenTable')}</p>
                        </div>

                        {restaurant.floors && restaurant.floors.length > 1 && (
                            <div className="flex bg-[#2A2A2A] p-1.5 rounded-xl border border-[#3A3A3A] overflow-x-auto w-full md:w-auto">
                                {restaurant.floors.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setActiveFloorId(f.id)}
                                        className={`px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap transition-all duration-300 ${activeFloorId === f.id
                                            ? 'bg-[#E07A5F] text-[#FAF9F6] shadow-lg'
                                            : 'text-[#8A8A8A] hover:text-[#FAF9F6] hover:bg-[#3A3A3A]'
                                            }`}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        ref={containerRef}
                        className="w-full bg-[#121212] rounded-xl border border-[#2A2A2A] relative flex-grow min-h-[400px] h-[60vh] md:h-[650px] overflow-hidden shadow-inner"
                        style={{ touchAction: 'none', cursor: isDragging.current ? 'grabbing' : 'grab' }}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        onPointerLeave={onPointerUp}
                    >
                        {/* Transform Layer */}
                        <div
                            className="absolute top-0 left-0 origin-top-left will-change-transform"
                            style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
                        >
                            <div style={{ width: dynamicWidth, height: dynamicHeight, position: 'relative' }}>
                                {activeFloorElements.map((element) =>
                                    element.type === 'table' ? (
                                        <Table
                                            key={element.id}
                                            table={element as TableElement}
                                            status={tableStatuses[element.id] || 'available'}
                                            onClick={() => {
                                                if (draggedRef.current) return;
                                                setSelectedTable(element as TableElement);
                                            }}
                                            offsetX={bounds.minX}
                                            offsetY={bounds.minY}
                                        />
                                    ) : (
                                        <Deco
                                            key={element.id}
                                            element={element as DecoElement}
                                            offsetX={bounds.minX}
                                            offsetY={bounds.minY}
                                        />
                                    )
                                )}
                            </div>
                        </div>

                        {/* Zoom Controls Overlay */}
                        <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-10" onPointerDown={e => e.stopPropagation()}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setTransform(p => enforceTransformBounds(p.x, p.y, p.scale * 1.3)) }}
                                className="w-12 h-12 bg-[#2A2A2A]/90 backdrop-blur-sm text-[#FAF9F6] font-bold rounded-full shadow-lg border border-[#4A4A4A] flex items-center justify-center hover:bg-[#3A3A3A] hover:border-[#D4A373] active:scale-95 transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setTransform(p => enforceTransformBounds(p.x, p.y, p.scale / 1.3)) }}
                                className="w-12 h-12 bg-[#2A2A2A]/90 backdrop-blur-sm text-[#FAF9F6] font-bold rounded-full shadow-lg border border-[#4A4A4A] flex items-center justify-center hover:bg-[#3A3A3A] hover:border-[#D4A373] active:scale-95 transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); fitToContainer() }}
                                className="w-12 h-12 bg-[#D4A373]/90 backdrop-blur-sm text-white rounded-full shadow-lg border border-[#D4A373] flex items-center justify-center hover:bg-[#E07A5F] hover:border-[#E07A5F] active:scale-95 transition-all mt-2"
                                title={t('userView.centerMap')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm font-medium">
                        <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full bg-brand-green mr-2 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                            <span className="text-[#A3A3A3]">{t('userView.legendAvailable')}</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full bg-brand-yellow mr-2 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>
                            <span className="text-[#A3A3A3]">{t('userView.legendPending')}</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full bg-brand-red mr-2 shadow-[0_0_10px_rgba(248,113,113,0.5)]"></div>
                            <span className="text-[#A3A3A3]">{t('userView.legendOccupied')}</span>
                        </div>
                    </div>
                </div>
            )}

            {showNoMapModal && selectedRestaurantId && (
                <BookingModal
                    table={null}
                    restaurantId={selectedRestaurantId}
                    onClose={() => setShowNoMapModal(false)}
                    withMap={false}
                />
            )}

            {selectedTable && selectedRestaurantId && (
                <BookingModal
                    table={selectedTable}
                    restaurantId={selectedRestaurantId}
                    onClose={() => setSelectedTable(null)}
                />
            )}

            {showMenuModal && selectedRestaurantId && (
                <GuestMenuModal
                    restaurantId={selectedRestaurantId}
                    onClose={() => setShowMenuModal(false)}
                />
            )}
        </div>
    );
};

export default UserView;