
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, BookingStatus, DecoElement, TextElement } from '../types';
import BookingModal from '../components/BookingModal';
import { useApp } from '../context/AppContext';

const Table: React.FC<{ table: TableElement; status: string; onClick: () => void }> = ({ table, status, onClick }) => {
    const statusClasses: { [key: string]: string } = {
        available: 'bg-brand-green/70 hover:bg-brand-green cursor-pointer ring-brand-green',
        confirmed: 'bg-brand-red/70 cursor-not-allowed ring-brand-red',
        pending: 'bg-brand-yellow/70 cursor-not-allowed ring-brand-yellow',
    };

    const baseClasses = "absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center font-bold text-white transition-all duration-300 hover:scale-110 focus:ring-4";
    const shapeClasses = table.shape === 'circle' ? 'rounded-full w-12 h-12' : 'rounded-md w-14 h-14';

    return (
        <div
            style={{ left: `${table.x}px`, top: `${table.y}px` }}
            className={`${baseClasses} ${shapeClasses} ${statusClasses[status]}`}
            onClick={status === 'available' ? onClick : undefined}
            tabIndex={status === 'available' ? 0 : -1}
        >
            <span>{table.label}</span>
        </div>
    );
};


const Deco: React.FC<{ element: LayoutElement }> = ({ element }) => {
    if (element.type === 'table') return null;

    const baseStyles = {
        left: `${element.x}px`, top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`
    };

    let content = null;
    let classes = `absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center`;

    if (element.type === 'text') {
        const textEl = element as TextElement;
        classes += ` bg-transparent text-center leading-tight overflow-hidden`;
        content = <div style={{ fontSize: `${textEl.fontSize || 16}px`, color: '#2c1f14' }} className="w-full h-full flex items-center justify-center p-1">{textEl.label}</div>;
    } else if (element.type === 'arrow') {
        classes += ` text-[#2c1f14]`;
        content = (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M12 2L12 22M12 2L5 9M12 2L19 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    } else if (element.type === 'stairs') {
        classes += ` bg-gray-300`;
        content = (
            <div className="w-full h-full flex flex-col justify-evenly">
                {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-gray-500"></div>)}
            </div>
        );
    } else if (element.type === 'plant') {
        classes += ` bg-transparent`;
        content = (
            <div className="relative w-full h-full flex items-center justify-center">
                <div className="absolute w-2/3 h-2/3 bg-emerald-800 rounded-full"></div>
                <div className="absolute w-full h-full flex items-center justify-center">
                    {/* Leaves */}
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
            window: 'bg-sky-200/40 border-2 border-sky-300'
        };
        classes += ` ${decoStyles[(element as DecoElement).type] || 'bg-gray-400'}`;

        if (element.type === 'window') {
            content = <div className="w-full h-full flex items-center justify-center"><div className="w-0.5 h-full bg-sky-300/50"></div></div>;
        }
    }

    return (
        <div
            style={baseStyles}
            className={classes}
        >
            {content}
        </div>
    );
}

const UserView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant } = useData();
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

    const tableStatuses = useMemo(() => {
        if (!restaurant) return {};
        const statuses: { [key: string]: string } = {};
        const now = new Date();
        const tables = restaurant.layout.filter(el => el.type === 'table') as TableElement[];

        tables.forEach(table => {
            const activePending = restaurant.bookings
                .filter(b => b.tableId === table.id && b.status === BookingStatus.PENDING && b.dateTime <= now)
                .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())[0];

            const activeConfirmed = restaurant.bookings
                .filter(
                    b =>
                        b.tableId === table.id &&
                        (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED) &&
                        b.dateTime <= now
                )
                .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())[0];

            if (activePending) {
                statuses[table.id] = 'pending';
            } else if (activeConfirmed) {
                statuses[table.id] = 'confirmed';
            } else {
                // Feature: Mark as 'confirmed' (red) if next booking is within 1 hour
                const nextBooking = restaurant.bookings
                    .filter(b =>
                        b.tableId === table.id &&
                        (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.OCCUPIED || b.status === BookingStatus.PENDING) &&
                        b.dateTime > now
                    )
                    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())[0];

                if (nextBooking && (nextBooking.dateTime.getTime() - now.getTime()) < 60 * 60 * 1000) {
                    statuses[table.id] = 'confirmed';
                } else {
                    statuses[table.id] = 'available';
                }
            }
        });
        return statuses;
    }, [restaurant]);

    if (!restaurant) {
        return <div className="text-center text-gray-400">Загрузка данных ресторана...</div>;
    }

    return (
        <div className="bg-brand-primary p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white leading-tight">Добро пожаловать в {restaurant.name}!</h2>
                    <p className="text-gray-400">Нажмите на свободный зеленый столик для бронирования.</p>
                </div>
                {restaurant.floors && restaurant.floors.length > 1 && (
                    <div className="flex bg-brand-secondary p-1 rounded-lg border border-brand-accent">
                        {restaurant.floors.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFloorId(f.id)}
                                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeFloorId === f.id ? 'bg-brand-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-full h-[600px] bg-brand-secondary rounded-xl relative overflow-hidden border-2 border-brand-accent shadow-inner">
                {restaurant.layout
                    .filter(el => !activeFloorId || el.floorId === activeFloorId || !el.floorId)
                    .map(element =>
                        element.type === 'table'
                            ? <Table key={element.id} table={element as TableElement} status={tableStatuses[element.id] || 'available'} onClick={() => setSelectedTable(element as TableElement)} />
                            : <Deco key={element.id} element={element as DecoElement} />
                    )}
            </div>
            <div className="flex justify-center space-x-6 mt-4">
                <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-brand-green mr-2"></div><span>Свободно</span></div>
                <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-brand-yellow mr-2"></div><span>Ожидает подтверждения</span></div>
                <div className="flex items-center"><div className="w-4 h-4 rounded-full bg-brand-red mr-2"></div><span>Забронировано</span></div>
            </div>

            {selectedTable && selectedRestaurantId && <BookingModal table={selectedTable} restaurantId={selectedRestaurantId} onClose={() => setSelectedTable(null)} />}
        </div>
    );
};

export default UserView;
