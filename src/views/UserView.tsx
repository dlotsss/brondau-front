import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, BookingStatus, DecoElement, TextElement } from '../types';
import BookingModal from '../components/BookingModal';
import { useApp } from '../context/AppContext';

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
                style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#2c1f14' }}
                className="w-full h-full flex items-center justify-center p-1 font-bold"
            >
                {textEl.label}
            </div>
        );
    } else if (element.type === 'arrow') {
        classes += ' text-[#2c1f14]';
        content = (
            <svg viewBox={`0 0 ${(element as any).width} ${(element as any).height}`} fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full opacity-60">
                <path d={`M 5 ${(element as any).height / 2} H ${(element as any).width - 15}`} strokeLinecap="round" />
                <path d={`M ${(element as any).width - 25} ${(element as any).height / 2 - 10} L ${(element as any).width - 5} ${(element as any).height / 2} L ${(element as any).width - 25} ${(element as any).height / 2 + 10}`} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    } else if (element.type === 'stairs') {
        classes += ' bg-gray-300 shadow-sm opacity-80';
        content = (
            <div className="w-full h-full flex flex-col justify-evenly">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-full h-px bg-gray-400"></div>
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
            wall: 'bg-gray-500 shadow-sm',
            bar: 'bg-yellow-800 border-2 border-yellow-900 shadow-lg',
            window: 'bg-sky-200/40 border-2 border-sky-300',
        };
        classes += ' ' + (decoStyles[(element as DecoElement).type] || 'bg-gray-400');

        if (element.type === 'window') {
            content = (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-0.5 h-full bg-sky-300/50"></div>
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
                if (b.tableId !== table.id) return false;
                if (b.status !== BookingStatus.PENDING) return false;
                const bDuration = b.duration || effectiveRestriction;
                const bookingStart = new Date(b.dateTime).getTime();
                const bookingEnd = bookingStart + bDuration * 60000;
                return nowTime >= bookingStart && nowTime < bookingEnd;
            });

            const activeConfirmed = restaurant.bookings.find(b => {
                if (b.tableId !== table.id) return false;
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

    if (!restaurant) {
        return <div className="text-center text-gray-400">Загрузка...</div>;
    }

    // ===== NO-MAP MODE =====
    if (!withMap) {
        return (
            <div className="bg-brand-primary p-4 md:p-6 rounded-lg shadow-xl h-full md:h-auto md:min-h-full flex flex-col">
                <div className="flex flex-col gap-2 mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{restaurant.name}</h2>
                    <p className="text-gray-400 text-sm">Заполните форму, и мы подберём для вас лучший столик.</p>
                </div>

                <div className="flex-grow flex flex-col items-center justify-center gap-8">
                    <div className="text-center space-y-4 max-w-sm mx-auto">
                        <div className="w-20 h-20 bg-brand-accent/30 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-4xl">🍽️</span>
                        </div>
                        <h3 className="text-xl font-semibold text-white">Онлайн-бронирование</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Оставьте заявку — наш администратор подтвердит бронь и подберёт для вас столик.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowNoMapModal(true)}
                        className="bg-brand-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-lg px-10 py-4 rounded-xl shadow-xl transition-all duration-200"
                    >
                        Забронировать столик
                    </button>
                </div>

                {showNoMapModal && selectedRestaurantId && (
                    <BookingModal
                        table={null}
                        restaurantId={selectedRestaurantId}
                        onClose={() => setShowNoMapModal(false)}
                        withMap={false}
                    />
                )}
            </div>
        );
    }

    // ===== WITH MAP MODE =====
    return (
        <div className="bg-brand-primary p-4 md:p-6 rounded-lg shadow-xl h-full md:h-auto md:min-h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 flex-none">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{restaurant.name}</h2>
                    <p className="text-gray-400 text-sm">Нажмите на доступный (зеленый) столик для брони.</p>
                </div>

                {restaurant.floors && restaurant.floors.length > 1 && (
                    <div className="flex bg-brand-secondary p-1 rounded-lg border border-brand-accent overflow-x-auto w-full md:w-auto">
                        {restaurant.floors.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFloorId(f.id)}
                                className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${activeFloorId === f.id
                                    ? 'bg-brand-blue text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
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
                className="w-full bg-[#3d2e23] bg-opacity-50 rounded-xl border-2 border-brand-accent shadow-inner relative flex-grow min-h-[400px] h-[60vh] md:h-[650px] overflow-hidden"
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

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm flex-none font-medium">
                <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-green mr-2 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
                    <span className="text-gray-200">Доступен</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-yellow mr-2 shadow-[0_0_8px_rgba(250,204,21,0.8)]"></div>
                    <span className="text-gray-200">Ожидает</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-red mr-2 shadow-[0_0_8px_rgba(248,113,113,0.8)]"></div>
                    <span className="text-gray-200">Занят</span>
                </div>
            </div>

            {selectedTable && selectedRestaurantId && (
                <BookingModal
                    table={selectedTable}
                    restaurantId={selectedRestaurantId}
                    onClose={() => setSelectedTable(null)}
                />
            )}
        </div>
    );
};

export default UserView;