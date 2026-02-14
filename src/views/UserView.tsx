import React, { useState, useMemo, useEffect } from 'react';
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
        available: 'bg-brand-green/70 hover:bg-brand-green cursor-pointer ring-brand-green',
        confirmed: 'bg-brand-red/70 cursor-not-allowed ring-brand-red',
        pending: 'bg-brand-yellow/70 cursor-not-allowed ring-brand-yellow',
    };

    const baseClasses = "absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold text-white transition-all duration-300 hover:scale-110 focus:ring-4 group";
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
            onClick={status === 'available' ? onClick : undefined}
            tabIndex={status === 'available' ? 0 : -1}
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
    let classes = 'absolute flex items-center justify-center';

    if (element.type === 'text') {
        const textEl = element as TextElement;
        classes += ' bg-transparent text-center leading-tight overflow-hidden';
        content = (
            <div
                style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#2c1f14' }}
                className="w-full h-full flex items-center justify-center p-1"
            >
                {textEl.label}
            </div>
        );
    } else if (element.type === 'arrow') {
        classes += ' text-[#2c1f14]';
        content = (
            <svg viewBox={`0 0 ${(element as any).width} ${(element as any).height}`} fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
                <path d={`M 5 ${(element as any).height / 2} H ${(element as any).width - 15}`} strokeLinecap="round" />
                <path d={`M ${(element as any).width - 25} ${(element as any).height / 2 - 10} L ${(element as any).width - 5} ${(element as any).height / 2} L ${(element as any).width - 25} ${(element as any).height / 2 + 10}`} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    } else if (element.type === 'stairs') {
        classes += ' bg-gray-300';
        content = (
            <div className="w-full h-full flex flex-col justify-evenly">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-full h-px bg-gray-500"></div>
                ))}
            </div>
        );
    } else if (element.type === 'plant') {
        classes += ' bg-transparent';
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
        const decoStyles: { [key: string]: string } = {
            wall: 'bg-gray-500',
            bar: 'bg-yellow-800 border-2 border-yellow-900',
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

    return (
        <div style={baseStyles} className={classes}>
            {content}
        </div>
    );
};

const UserView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant } = useData();
    const [selectedTable, setSelectedTable] = useState<TableElement | null>(null);
    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);

    const restaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;

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
        const now = new Date();

        const tables = restaurant.layout.filter(el => el.type === 'table') as TableElement[];
        tables.forEach(table => {
            const activePending = restaurant.bookings.find(
                b => b.tableId === table.id && b.status === BookingStatus.PENDING && b.dateTime > now
            );
            const activeConfirmed = restaurant.bookings.find(
                b => b.tableId === table.id &&
                    (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED) &&
                    b.dateTime > now
            );

            if (activePending) {
                statuses[table.id] = 'pending';
            } else if (activeConfirmed) {
                statuses[table.id] = 'confirmed';
            } else {
                statuses[table.id] = 'available';
            }
        });

        return statuses;
    }, [restaurant]);

    // Вычисляем динамические границы карты
    const activeFloorElements = useMemo(() => {
        if (!restaurant) return [];
        return restaurant.layout.filter(el =>
            !activeFloorId || el.floorId === activeFloorId || !el.floorId
        );
    }, [restaurant, activeFloorId]);

    const bounds = useMemo(() =>
        calculateBounds(activeFloorElements),
        [activeFloorElements]
    );

    const dynamicWidth = bounds.maxX - bounds.minX;
    const dynamicHeight = bounds.maxY - bounds.minY;

    if (!restaurant) {
        return <div className="text-center text-gray-400">Загрузка...</div>;
    }

    return (
        <div className="bg-brand-primary p-4 md:p-6 rounded-lg shadow-xl h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{restaurant.name}</h2>
                    <p className="text-gray-400 text-sm">Нажмите на зеленый столик для брони.</p>
                </div>

                {restaurant.floors && restaurant.floors.length > 1 && (
                    <div className="flex bg-brand-secondary p-1 rounded-lg border border-brand-accent overflow-x-auto w-full md:w-auto">
                        {restaurant.floors.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFloorId(f.id)}
                                className={`px-4 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${activeFloorId === f.id
                                    ? 'bg-brand-blue text-white shadow-lg'
                                    : 'text-gray-400'
                                    }`}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Scrollable Map Container */}
            <div className="w-full bg-brand-secondary rounded-xl relative overflow-hidden border-2 border-brand-accent shadow-inner flex-grow min-h-[500px]">
                <div className="overflow-auto w-full h-full absolute inset-0 touch-pan-x touch-pan-y">
                    {/* SCALABLE WRAPPER */}
                    <div
                        className="relative w-full h-full transform origin-top-left transition-transform duration-300 scale-[0.65] md:scale-100"
                        style={{
                            width: `${dynamicWidth}px`,
                            height: `${dynamicHeight}px`,
                            minWidth: `${dynamicWidth}px`,
                            minHeight: `${dynamicHeight}px`,
                        }}
                    >
                        {activeFloorElements.map((element) =>
                            element.type === 'table' ? (
                                <Table
                                    key={element.id}
                                    table={element as TableElement}
                                    status={tableStatuses[element.id] || 'available'}
                                    onClick={() => setSelectedTable(element as TableElement)}
                                    offsetX={bounds.minX}
                                    offsetY={bounds.minY}
                                />
                            ) : (
                                // @ts-ignore - Using original Deco logic in real code
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
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
                <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-green mr-2"></div>
                    <span>Доступен</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-yellow mr-2"></div>
                    <span>Ожидает</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-brand-red mr-2"></div>
                    <span>Занят</span>
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
