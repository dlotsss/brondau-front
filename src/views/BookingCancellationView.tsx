import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { BookingStatus, PublicCancelBookingInfo } from '../types';

const REASONS = [
  'Изменились планы',
  'Не подошло время',
  'Не понравились условия',
  'Нашли другое место',
  'Случайно забронировал',
  'Другое'
];

const BookingCancellationView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingInfo, setBookingInfo] = useState<PublicCancelBookingInfo | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) {
      loadBookingInfo();
    }
  }, [token]);

  const loadBookingInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await api.public.getCancelInfo(token!);
      setBookingInfo(info);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить информацию о бронировании');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!token || !selectedReason) return;
    if (selectedReason === 'Другое' && !comment.trim()) {
      alert('Пожалуйста, укажите причину в комментарии');
      return;
    }

    try {
      setSubmitting(true);
      await api.public.cancelBooking(token, { reason: selectedReason, comment });
      setSuccess(true);
    } catch (err: any) {
      alert(err.message || 'Ошибка при отмене бронирования');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-secondary flex items-center justify-center p-4">
        <div className="text-white text-xl animate-pulse">Загрузка информации...</div>
      </div>
    );
  }

  if (error || !bookingInfo) {
    return (
      <div className="min-h-screen bg-brand-secondary flex items-center justify-center p-4">
        <div className="bg-brand-primary p-8 rounded-2xl border border-brand-accent max-w-md w-full text-center shadow-2xl">
          <div className="text-brand-red text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Ошибка</h2>
          <p className="text-gray-400 mb-6">{error || 'Бронирование не найдено или ссылка недействительна'}</p>
          <a href="/" className="inline-block bg-brand-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition-colors">
            На главную
          </a>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-secondary flex items-center justify-center p-4">
        <div className="bg-brand-primary p-8 rounded-2xl border border-brand-accent max-w-md w-full text-center shadow-2xl animate-fadeIn">
          <div className="text-brand-green text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">Бронирование отменено</h2>
          <p className="text-gray-400 mb-6">Ваша бронь в <b>{bookingInfo.restaurantName}</b> успешно отменена. Ждем вас в следующий раз!</p>
          <a href="/" className="inline-block bg-brand-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition-colors">
            Забронировать снова
          </a>
        </div>
      </div>
    );
  }

  if (!bookingInfo.canCancel) {
    return (
      <div className="min-h-screen bg-brand-secondary flex items-center justify-center p-4">
        <div className="bg-brand-primary p-8 rounded-2xl border border-brand-accent max-w-md w-full text-center shadow-2xl">
          <div className="text-brand-yellow text-5xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-white mb-2">Отмена невозможна</h2>
          <p className="text-gray-400 mb-6">Это бронирование уже отменено, завершено или находится в статусе, не позволяющем отмену.</p>
          <p className="text-sm text-gray-500 mb-6">Текущий статус: {bookingInfo.status}</p>
          <a href="/" className="inline-block bg-brand-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition-colors">
            На главную
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-secondary flex items-center justify-center p-4">
      <div className="bg-brand-primary p-6 md:p-8 rounded-2xl border border-brand-accent max-w-lg w-full shadow-2xl animate-slideUp">
        <h2 className="text-2xl font-bold text-white mb-6">Отмена бронирования</h2>

        <div className="bg-brand-accent/30 rounded-xl p-4 mb-6 border border-brand-accent/50">
          <h3 className="text-brand-blue font-bold text-lg mb-2">{bookingInfo.restaurantName}</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-400">Гость:</span>
            <span className="text-white font-medium">{bookingInfo.guestName}</span>
            <span className="text-gray-400">Дата и время:</span>
            <span className="text-white font-medium">{new Date(bookingInfo.dateTime).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-gray-400">Кол-во гостей:</span>
            <span className="text-white font-medium">{bookingInfo.guestCount}</span>
            {bookingInfo.tableLabel && (
              <>
                <span className="text-gray-400">Столик:</span>
                <span className="text-white font-medium">{bookingInfo.tableLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <p className="text-gray-300 font-medium mb-3">Пожалуйста, выберите причину отмены:</p>
          <div className="grid grid-cols-1 gap-2">
            {REASONS.map((reason) => (
              <button
                key={reason}
                onClick={() => setSelectedReason(reason)}
                className={`text-left px-4 py-3 rounded-xl border transition-all duration-200 ${selectedReason === reason
                  ? 'bg-brand-blue/20 border-brand-blue text-brand-blue ring-1 ring-brand-blue'
                  : 'bg-brand-secondary/50 border-brand-accent/50 text-gray-400 hover:border-gray-500'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-white">{reason}</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedReason === reason ? 'border-brand-blue' : 'border-gray-600'}`}>
                    {selectedReason === reason && <div className="w-2.5 h-2.5 bg-brand-blue rounded-full"></div>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedReason === 'Другое' && (
            <div className="mt-4 animate-fadeIn">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Расскажите подробнее..."
                className="w-full bg-brand-secondary border border-brand-accent rounded-xl p-3 text-white focus:outline-none focus:border-brand-blue transition-colors min-h-[100px]"
                required
              />
            </div>
          )}
        </div>

        <button
          onClick={handleCancel}
          disabled={!selectedReason || (selectedReason === 'Другое' && !comment.trim()) || submitting}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${!selectedReason || (selectedReason === 'Другое' && !comment.trim()) || submitting
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-brand-red text-white hover:bg-red-700 active:scale-[0.98]'
            }`}
        >
          {submitting ? 'Отмена...' : 'Отменить бронь'}
        </button>
      </div>
    </div>
  );
};

export default BookingCancellationView;
