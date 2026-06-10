import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Dish } from '../types';
import { useTranslation } from '../context/I18nContext';

interface MenuViewProps {
    restaurantId: string;
}

export const MenuView: React.FC<MenuViewProps> = ({ restaurantId }) => {
    const { t } = useTranslation();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDish, setEditingDish] = useState<Dish | null>(null);

    // Form state
    const [dishTitle, setDishTitle] = useState('');
    const [price, setPrice] = useState<number>(0);
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Разное');
    const [weight, setWeight] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [isAvailable, setIsAvailable] = useState(true);

    const categories = ['Закуски', 'Салаты', 'Супы', 'Горячее', 'Десерты', 'Напитки', 'Разное'];

    const loadMenu = async () => {
        setIsLoading(true);
        try {
            const data = await api.menu.list(restaurantId);
            setDishes(data);
        } catch (error) {
            console.error('Failed to load menu:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMenu();
    }, [restaurantId]);

    const openCreateModal = () => {
        setEditingDish(null);
        setDishTitle('');
        setPrice(0);
        setDescription('');
        setCategory('Разное');
        setWeight('');
        setPhotoUrl(null);
        setIsAvailable(true);
        setIsModalOpen(true);
    };

    const openEditModal = (dish: Dish) => {
        setEditingDish(dish);
        setDishTitle(dish.dishTitle);
        setPrice(dish.price);
        setDescription(dish.description || '');
        setCategory(dish.category || 'Разное');
        setWeight(dish.weight || '');
        setPhotoUrl(dish.photoUrl || null);
        setIsAvailable(dish.isAvailable);
        setIsModalOpen(true);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadProgress('Загрузка...');
        try {
            const formData = new FormData();
            formData.append('image', file);

            // Using standard free ImgBB API key as fallback, or custom via VITE
            const apiKey = import.meta.env.VITE_IMGBB_API_KEY || 'e3568ab43cf6cb7e9e80277df179836a';
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('ImgBB upload failed');
            const resData = await response.json();
            setPhotoUrl(resData.data.url);
            setUploadProgress('Загружено!');
        } catch (error) {
            console.error('Failed to upload image:', error);
            setUploadProgress('Ошибка загрузки');
            alert('Не удалось загрузить изображение. Попробуйте снова.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dishTitle.trim()) {
            alert('Введите название блюда');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                dishTitle,
                photoUrl,
                price,
                description: description || null,
                category,
                weight: weight || null,
                isAvailable,
            };

            if (editingDish) {
                await api.menu.update(editingDish.id, payload);
            } else {
                await api.menu.create(restaurantId, payload);
            }
            setIsModalOpen(false);
            loadMenu();
        } catch (error) {
            console.error('Failed to save dish:', error);
            alert('Ошибка при сохранении блюда');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (dishId: string) => {
        if (!window.confirm('Вы уверены, что хотите удалить это блюдо?')) return;

        try {
            await api.menu.delete(dishId);
            loadMenu();
        } catch (error) {
            console.error('Failed to delete dish:', error);
            alert('Ошибка при удалении блюда');
        }
    };

    // Group dishes by category
    const groupedDishes = dishes.reduce((acc, dish) => {
        const cat = dish.category || 'Разное';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(dish);
        return acc;
    }, {} as Record<string, Dish[]>);

    return (
        <div className="flex flex-col gap-6 p-4 bg-brand-secondary/35 rounded-lg border border-brand-accent/20 min-h-[calc(100vh-140px)]">
            <div className="flex justify-between items-center border-b border-brand-accent/30 pb-4">
                <div>
                    <h2 className="text-2xl font-bold text-brand-primary tracking-wide">Меню ресторана</h2>
                    <p className="text-xs text-gray-400 mt-1">Добавляйте и редактируйте блюда вашего ресторана.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-brand-blue hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2 text-sm"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Добавить блюдо
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-blue"></div>
                </div>
            ) : dishes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3 bg-brand-primary/20 rounded-xl border border-dashed border-brand-accent/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-brand-accent/40 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-base font-medium">Ваше меню пока пусто</p>
                    <p className="text-xs text-gray-500">Нажмите кнопку «Добавить блюдо», чтобы наполнить меню.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-8">
                    {Object.keys(groupedDishes).map((catName) => (
                        <div key={catName} className="flex flex-col gap-4">
                            <h3 className="text-lg font-bold text-brand-accent border-b border-brand-accent/10 pb-1.5 pl-1 flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-accent"></span>
                                {catName}
                                <span className="text-xs font-normal text-gray-400 bg-brand-primary/60 px-2 py-0.5 rounded-full ml-2">
                                    {groupedDishes[catName].length}
                                </span>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groupedDishes[catName].map((dish) => (
                                    <div
                                        key={dish.id}
                                        className={`bg-brand-primary/80 backdrop-blur-md rounded-xl overflow-hidden border ${dish.isAvailable ? 'border-brand-accent/20' : 'border-red-900/40 opacity-70'
                                            } hover:border-brand-blue/40 transition-all duration-300 hover:shadow-xl hover:shadow-brand-blue/5 flex flex-col group`}
                                    >
                                        {/* Dish Image */}
                                        <div className="h-44 w-full bg-brand-secondary relative overflow-hidden flex items-center justify-center">
                                            {dish.photoUrl ? (
                                                <img
                                                    src={dish.photoUrl}
                                                    alt={dish.dishTitle}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-xs">Без фото</span>
                                                </div>
                                            )}
                                            {/* Badge availability */}
                                            {!dish.isAvailable && (
                                                <div className="absolute top-3 right-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md uppercase tracking-wider">
                                                    Нет в наличии
                                                </div>
                                            )}
                                        </div>

                                        {/* Dish Details */}
                                        <div className="p-4 flex-grow flex flex-col justify-between gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h4 className="font-bold text-white text-base leading-snug group-hover:text-brand-blue transition-colors">
                                                        {dish.dishTitle}
                                                    </h4>
                                                    <span className="text-brand-accent font-bold text-sm whitespace-nowrap">
                                                        {dish.price} ₸
                                                    </span>
                                                </div>
                                                {dish.weight && (
                                                    <span className="text-[11px] text-gray-900 bg-brand-secondary/60 px-2 py-0.5 rounded w-max">
                                                        {dish.weight}
                                                    </span>
                                                )}
                                                {dish.description && (
                                                    <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed mt-1">
                                                        {dish.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 border-t border-brand-accent/10 pt-3 mt-auto">
                                                <button
                                                    onClick={() => openEditModal(dish)}
                                                    className="flex-1 bg-brand-accent/40 hover:bg-brand-accent/60 text-gray-100 hover:text-white border border-brand-accent/20 font-medium py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                    Изменить
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(dish.id)}
                                                    className="bg-brand-red/10 hover:bg-brand-red/20 text-brand-red border border-brand-red/30 hover:border-brand-red/50 p-1.5 rounded transition-all flex items-center justify-center"
                                                    title="Удалить блюдо"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CREATE / EDIT MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-brand-primary border border-brand-accent/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-brand-accent/20 bg-brand-secondary/40">
                            <h3 className="font-bold text-white text-lg">
                                {editingDish ? 'Редактировать блюдо' : 'Добавить блюдо'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-white text-xl transition-colors"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[80vh]">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Название блюда *</label>
                                <input
                                    type="text"
                                    required
                                    value={dishTitle}
                                    onChange={(e) => setDishTitle(e.target.value)}
                                    placeholder="Например: Стейк Рибай"
                                    className="w-full bg-[#1a1c23] border border-brand-accent/30 rounded-lg p-2.5 text-white text-sm focus:border-brand-blue focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Категория</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-[#1a1c23] border border-brand-accent/30 rounded-lg p-2.5 text-white text-sm focus:border-brand-blue focus:outline-none"
                                    >
                                        {categories.map((cat) => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Кастомная категория</label>
                                    <input
                                        type="text"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        placeholder="Или введите свою"
                                        className="w-full bg-[#1a1c23] border border-brand-accent/30 rounded-lg p-2.5 text-white text-sm focus:border-brand-blue focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Цена (₸) *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        value={price || ''}
                                        onChange={(e) => setPrice(Number(e.target.value))}
                                        placeholder="0"
                                        className="w-full bg-[#1a1c23] border border-brand-accent/30 rounded-lg p-2.5 text-white text-sm focus:border-brand-blue focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Вес / Объем</label>
                                    <input
                                        type="text"
                                        value={weight}
                                        onChange={(e) => setWeight(e.target.value)}
                                        placeholder="Например: 350 г, 500 мл"
                                        className="w-full bg-[#1a1c23] border border-brand-accent/30 rounded-lg p-2.5 text-white text-sm focus:border-brand-blue focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Описание блюда</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Состав, особенности приготовления..."
                                    className="w-full bg-[#1a1c23] border border-brand-accent/30 rounded-lg p-2.5 text-white text-sm focus:border-brand-blue focus:outline-none h-20 resize-none"
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Фотография блюда</label>
                                <div className="flex items-center gap-4 border border-brand-accent/20 p-3 rounded-lg bg-brand-secondary/20">
                                    <div className="w-16 h-16 rounded bg-brand-secondary flex items-center justify-center overflow-hidden shrink-0 border border-brand-accent/20">
                                        {photoUrl ? (
                                            <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                            className="text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-brand-blue/20 file:text-brand-blue hover:file:bg-brand-blue/30 cursor-pointer"
                                        />
                                        {uploadProgress && (
                                            <span className="text-[10px] text-brand-accent font-medium">{uploadProgress}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Availability Toggle */}
                            <div className="flex items-center justify-between border-t border-brand-accent/10 pt-4">
                                <div>
                                    <span className="text-sm font-semibold text-white">Доступно для заказа</span>
                                    <p className="text-[10px] text-gray-400">Показывается ли блюдо в актуальном меню.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isAvailable}
                                        onChange={(e) => setIsAvailable(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-blue"></div>
                                </label>
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-3 border-t border-brand-accent/20 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-brand-secondary hover:bg-brand-secondary/80 text-gray-300 font-semibold py-2 rounded-lg text-sm border border-brand-accent/20 transition-all"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || uploadProgress === 'Загрузка...'}
                                    className="flex-1 bg-brand-blue hover:bg-blue-600 disabled:bg-brand-blue/50 text-white font-semibold py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                        'Сохранить'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
