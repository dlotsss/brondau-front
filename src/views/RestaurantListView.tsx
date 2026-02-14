
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';
import { Restaurant } from '../types';

const RestaurantCard: React.FC<{ restaurant: Restaurant; onSelect: () => void }> = ({ restaurant, onSelect }) => {
    const totalTables = restaurant.layout.filter(l => l.type === 'table').length;

    // Calculate availability logic
    const now = new Date();
    const activeBookings = restaurant.bookings.filter(b =>
        (b.status === 'CONFIRMED' || b.status === 'OCCUPIED') &&
        b.dateTime <= now &&
        new Date(b.dateTime.getTime() + 90 * 60000) > now // Assuming 90m duration? Or just check if "currently occupied" logic from AdminView context?
        // AdminView uses strict overlap logic often, but for "Free tables now", let's assume a standard duration or if the backend provided "occupied" status.
        // Actually, without duration in Booking, it's hard to know exactly when it frees up.
        // But for simplicity and consistency with admin view "Occupied" check:
        // AdminView checks: b.dateTime <= now (and implicitly not finished/marked completed).
        // Let's assume bookings within last 2 hours are "active" if not completed?
        // Or simpler: just count bookings that are currently marked status OCCUPIED?
        // AdminView marks them occupied manually? No, it filters by status.
        // Let's use a simple heuristic: Count 'OCCUPIED' status OR 'CONFIRMED' within last 1.5 hours.
    );

    // Actually, AdminView logic for "Occupied tables" was:
    // b.status === CONFIRMED || OCCUPIED, and b.dateTime <= now.
    // It picks the *latest* one.
    // Let's stick to a simpler "Open Tables" estimate if possible.
    // Better: Just show "Book a table" generic if we can't be precise.
    // User asked: "есть ли свободные столики на текущее время".
    // I will count tables that do NOT have an active booking.
    // A table is "busy" if there is a booking (CONFIRMED/OCCUPIED) with dateTime within [now - 90m, now + ?].
    // Let's assume standard 1.5h duration for availability check.

    const busyTableIds = new Set();
    restaurant.bookings.forEach(b => {
        if ((b.status === 'CONFIRMED' || b.status === 'OCCUPIED') &&
            b.dateTime <= now &&
            b.dateTime.getTime() + 90 * 60000 > now.getTime()
        ) {
            busyTableIds.add(b.tableId);
        }
    });

    const freeTables = totalTables - busyTableIds.size;
    const isFull = freeTables <= 0;

    return (
        <div
            onClick={onSelect}
            className="group bg-brand-primary rounded-xl shadow-lg cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] border border-brand-accent/30"
        >
            <div className="h-48 w-full bg-gray-800 relative">
                <img
                    src={restaurant.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=60'}
                    alt={restaurant.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-2xl font-bold">{restaurant.name}</h3>
                    {restaurant.address && <p className="text-gray-300 text-sm flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{restaurant.address}</p>}
                </div>
            </div>
            <div className="p-4 flex justify-between items-center bg-brand-primary">
                <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${isFull ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
                    <span className={`text-sm font-medium ${isFull ? 'text-red-400' : 'text-green-400'}`}>
                        {isFull ? 'Все столики заняты' : `Свободных столиков: ${freeTables}`}
                    </span>
                </div>
                <button className="text-brand-blue text-sm font-semibold group-hover:underline">Подробнее &rarr;</button>
            </div>
        </div>
    );
};

const AddRestaurantCard: React.FC<{ onAdd: (name: string) => void }> = ({ onAdd }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [name, setName] = useState('');

    const handleAdd = () => {
        if (name.trim()) {
            onAdd(name.trim());
            setIsAdding(false);
            setName('');
        }
    };

    if (isAdding) {
        return (
            <div className="bg-brand-primary p-6 rounded-lg shadow-lg border-2 border-dashed border-brand-accent">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Название нового ресторана"
                    className="w-full bg-brand-secondary p-2 rounded-md mb-3"
                    autoFocus
                />
                <div className="flex space-x-2">
                    <button onClick={handleAdd} className="w-full bg-brand-blue p-2 rounded-md text-sm font-semibold">Сохранить</button>
                    <button onClick={() => setIsAdding(false)} className="w-full bg-brand-accent p-2 rounded-md text-sm">Отмена</button>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsAdding(true)}
            className="bg-brand-primary p-6 rounded-lg shadow-lg cursor-pointer transition-all duration-300 hover:shadow-2xl hover:bg-brand-accent hover:scale-105 border-2 border-dashed border-brand-accent flex items-center justify-center text-gray-400 min-h-[116px]"
        >
            <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                <h3 className="font-bold">Добавить новый ресторан</h3>
            </div>
        </div>
    );
};


const RestaurantListView: React.FC = () => {
    const { currentUser, addRestaurantToCurrentUser } = useApp();
    const { restaurants, addRestaurant } = useData();
    const navigate = useNavigate();

    const handleAddRestaurant = async (name: string) => {
        const newRestaurant = await addRestaurant(name);
        if (newRestaurant) {
            addRestaurantToCurrentUser(newRestaurant.id);
        }
    }

    const managedRestaurants = currentUser?.role === 'GUEST'
        ? restaurants
        : restaurants.filter(r => currentUser?.restaurantIds.includes(r.id));

    return (
        <div className="min-h-screen bg-brand-secondary p-4 md:p-8 animate-fade-in">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#2c1f14' }}>Выберите ресторан</h1>
                <p className="text-gray-400 mb-6 md:mb-8">
                    {currentUser?.role === 'GUEST' ? "Выберите ресторан для просмотра плана зала и бронирования." : "Выберите ресторан для управления."}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {managedRestaurants.map(r => (
                        <RestaurantCard key={r.id} restaurant={r} onSelect={() => navigate(`/restaurant/${r.id}`)} />
                    ))}
                    {currentUser?.role === 'OWNER' && <AddRestaurantCard onAdd={handleAddRestaurant} />}
                </div>
            </div>
            <style>{`
                @keyframes fade-in {
                    0% { opacity: 0; transform: translateY(10px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default RestaurantListView;
