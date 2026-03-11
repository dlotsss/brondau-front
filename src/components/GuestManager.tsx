import React, { useState, useEffect, useCallback } from 'react';
import { Guest, BookingStatus } from '../types';
import { api } from '../services/api';

const GuestManager: React.FC = () => {
    const [searchPhone, setSearchPhone] = useState('');
    const [guests, setGuests] = useState<Guest[]>([]);
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [internalComment, setInternalComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSearch = useCallback(async (phone: string) => {
        setLoading(true);
        try {
            const data = await api.guests.search(phone);
            setGuests(data);
        } catch (error) {
            console.error('Search guests error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch(searchPhone);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchPhone, handleSearch]);

    const selectGuest = async (guest: Guest) => {
        setSelectedGuest(guest);
        setInternalComment(guest.internalComment || '');
        setLoading(true);
        try {
            const { history, stats } = await api.guests.getHistory(guest.phone);
            setHistory(history);
            setStats(stats);
        } catch (error) {
            console.error('Get guest history error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveComment = async () => {
        if (!selectedGuest) return;
        setSaving(true);
        try {
            const updated = await api.guests.update(selectedGuest.phone, {
                internalComment,
                name: selectedGuest.name,
                email: selectedGuest.email
            });
            setSelectedGuest(updated);
            setGuests(prev => prev.map(g => g.phone === updated.phone ? updated : g));
            alert('Комментарий сохранен');
        } catch (error) {
            console.error('Update guest error:', error);
            alert('Ошибка при сохранении');
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (date: string | Date) => {
        return new Date(date).toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case BookingStatus.CONFIRMED: return 'text-green-400';
            case BookingStatus.DECLINED: return 'text-red-400';
            case BookingStatus.PENDING: return 'text-yellow-400';
            case BookingStatus.COMPLETED: return 'text-blue-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="flex flex-col h-full bg-brand-secondary/30 rounded-xl overflow-hidden border border-brand-accent/20">
            {/* Search Header */}
            <div className="p-4 bg-brand-secondary border-b border-brand-accent/30">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Поиск по номеру телефона..."
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                        className="w-full bg-brand-accent p-3 pl-10 rounded-lg border border-gray-600 text-white placeholder-gray-500 focus:border-brand-blue outline-none transition-all"
                    />
                    <span className="absolute left-3 top-3.5 text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Guest List */}
                <div className="w-1/3 border-r border-brand-accent/20 overflow-y-auto bg-brand-secondary/10">
                    {loading && guests.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">Загрузка...</div>
                    ) : guests.length > 0 ? (
                        <ul className="divide-y divide-brand-accent/10">
                            {guests.map((guest) => (
                                <li
                                    key={guest.phone}
                                    onClick={() => selectGuest(guest)}
                                    className={`p-4 cursor-pointer hover:bg-brand-accent/30 transition-colors ${selectedGuest?.phone === guest.phone ? 'bg-brand-accent/50 border-l-4 border-brand-blue' : ''}`}
                                >
                                    <div className="font-bold text-gray-400">{guest.name}</div>
                                    <div className="text-sm text-gray-500">{guest.phone}</div>
                                    {guest.internalComment && (
                                        <div className="text-xs text-brand-blue mt-1 truncate italic">"{guest.internalComment}"</div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-gray-500">Клиенты не найдены</div>
                    )}
                </div>

                {/* Guest Details */}
                <div className="flex-1 overflow-y-auto p-6 bg-brand-secondary/5">
                    {selectedGuest ? (
                        <div className="space-y-8 animate-fadeIn">
                            {/* Profile Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-400 mb-1">{selectedGuest.name}</h2>
                                    <div className="text-xl text-brand-blue font-mono">{selectedGuest.phone}</div>
                                    <div className="text-gray-500 mt-1">{selectedGuest.email}</div>
                                </div>
                                <div className="bg-brand-accent/50 p-4 rounded-xl border border-brand-accent/30 text-center min-w-[150px]">
                                    <div className="text-sm text-gray-500 mb-1">Всего броней</div>
                                    <div className="text-4xl font-bold text-gray-400">{stats?.total_bookings || 0}</div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-brand-accent/20 p-4 rounded-lg border border-brand-accent/10">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Завершено</div>
                                    <div className="text-2xl font-bold text-blue-400">{stats?.completed || 0}</div>
                                </div>
                                <div className="bg-brand-accent/20 p-4 rounded-lg border border-brand-accent/10">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Отклонено</div>
                                    <div className="text-2xl font-bold text-red-400">{stats?.declined || 0}</div>
                                </div>
                                <div className="bg-brand-accent/20 p-4 rounded-lg border border-brand-accent/10">
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Отм. админом</div>
                                    <div className="text-2xl font-bold text-orange-400">{stats?.cancelled_by_admin || 0}</div>
                                </div>
                            </div>

                            {/* Admin Notes */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-gray-400 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Заметки администратора
                                </h3>
                                <div className="relative">
                                    <textarea
                                        placeholder="Добавьте внутренний комментарий о клиенте..."
                                        value={internalComment}
                                        onChange={(e) => setInternalComment(e.target.value)}
                                        className="w-full bg-brand-accent/30 p-4 rounded-xl border border-brand-accent/50 text-gray-400 placeholder-gray-500 focus:border-brand-blue outline-none transition-all resize-none min-h-[100px]"
                                    />
                                    <button
                                        onClick={handleSaveComment}
                                        disabled={saving || internalComment === (selectedGuest.internalComment || '')}
                                        className="absolute bottom-3 right-3 bg-brand-blue text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {saving ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                </div>
                            </div>

                            {/* Booking History */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-400">История бронирований</h3>
                                <div className="space-y-3">
                                    {history.length > 0 ? history.map((b) => (
                                        <div key={b.id} className="bg-brand-accent/20 p-4 rounded-xl border border-brand-accent/10 flex justify-between items-center group hover:bg-brand-accent/30 transition-all">
                                            <div className="space-y-1">
                                                <div className="font-bold text-gray-400 group-hover:text-brand-blue transition-colors">{formatDate(b.date_time)}</div>
                                                <div className="text-sm text-gray-400">{b.restaurant_name} • Стол: {b.table_label || 'Не назначен'}</div>
                                                {b.guest_comment && (
                                                    <div className="text-xs text-gray-500 italic mt-1 bg-black/20 p-2 rounded">
                                                        Коммент: {b.guest_comment}
                                                    </div>
                                                )}
                                                {b.decline_reason && (
                                                    <div className="text-xs text-red-500/80">
                                                        Причина: {b.decline_reason}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`text-sm font-bold uppercase tracking-wider ${getStatusColor(b.status)}`}>
                                                {b.status}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 text-gray-500 italic bg-brand-accent/5 rounded-xl border border-dashed border-brand-accent/20">
                                            История бронирований пуста
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4 opacity-50">
                            <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="text-xl">Выберите клиента из списка для просмотра деталей</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuestManager;
