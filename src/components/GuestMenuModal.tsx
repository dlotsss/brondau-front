import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from '../context/I18nContext';
import { api } from '../services/api';
import { Dish } from '../types';

interface Props {
    restaurantId: string;
    onClose: () => void;
}

const DishDetailModal: React.FC<{ dish: Dish; onClose: () => void }> = ({ dish, onClose }) => {
    // Add escape key listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" 
            onClick={onClose}
        >
            <div 
                className="bg-[#1A1513] w-full max-w-xl rounded-2xl shadow-2xl border border-[#2A2A2A] overflow-hidden flex flex-col transform transition-all animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="relative aspect-[4/3] w-full bg-[#121212]">
                    {dish.photoUrl ? (
                        <img src={dish.photoUrl} alt={dish.dishTitle} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#4A4A4A] bg-[#121212]">
                            <span className="text-6xl opacity-20">🍽️</span>
                        </div>
                    )}
                    
                    {/* Floating Close Button */}
                    <button 
                        onClick={onClose} 
                        className="absolute top-4 right-4 p-2 bg-black/40 text-[#FAF9F6] rounded-full hover:bg-black/60 backdrop-blur-md transition-all duration-200"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-6 md:p-8 flex-1 bg-[#1A1513]">
                    <div className="flex justify-between items-start gap-4 mb-2">
                        <h2 className="text-2xl font-bold text-[#FAF9F6] leading-tight">{dish.dishTitle}</h2>
                        <div className="text-xl font-bold text-[#D4A373] whitespace-nowrap">
                            {dish.price} ₸
                        </div>
                    </div>
                    
                    {dish.weight && (
                        <div className="text-sm font-medium text-[#8A8A8A] mb-6">
                            {dish.weight}
                        </div>
                    )}
                    
                    <div className="text-[#A3A3A3] text-base leading-relaxed whitespace-pre-wrap">
                        {dish.description || 'Описание отсутствует.'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const GuestMenuModal: React.FC<Props> = ({ restaurantId, onClose }) => {
    const { t } = useTranslation();
    const [dishes, setDishes] = useState<Dish[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchMenu = async () => {
            try {
                const data = await api.menu.list(restaurantId);
                const available = data.filter(d => d.isAvailable);
                setDishes(available);
                if (available.length > 0) {
                    const firstCat = available[0].category || 'Без категории';
                    setActiveCategory(firstCat);
                }
            } catch (err) {
                console.error('Failed to fetch menu', err);
            } finally {
                setLoading(false);
            }
        };
        fetchMenu();
    }, [restaurantId]);

    const categorizedDishes = useMemo(() => {
        const categories: { [key: string]: Dish[] } = {};
        dishes.forEach(dish => {
            const cat = dish.category || 'Без категории';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(dish);
        });
        return categories;
    }, [dishes]);

    const categoryNames = Object.keys(categorizedDishes);

    const scrollToCategory = (category: string) => {
        setActiveCategory(category);
        const element = document.getElementById(`category-${category}`);
        if (element && scrollContainerRef.current) {
            const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
            const elementTop = element.getBoundingClientRect().top;
            const offset = elementTop - containerTop + scrollContainerRef.current.scrollTop - 20;
            scrollContainerRef.current.scrollTo({
                top: offset,
                behavior: 'smooth'
            });
        }
    };

    // Intersection Observer to update active category on scroll
    useEffect(() => {
        if (loading || categoryNames.length === 0) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            let currentActive = categoryNames[0];
            let minDistance = Infinity;

            categoryNames.forEach(cat => {
                const el = document.getElementById(`category-${cat}`);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();
                    const distance = Math.abs(rect.top - containerRect.top - 40); 

                    if (distance < minDistance && rect.top < containerRect.bottom && rect.bottom > containerRect.top) {
                        minDistance = distance;
                        currentActive = cat;
                    }
                }
            });

            if (currentActive !== activeCategory) {
                setActiveCategory(currentActive);
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [loading, categoryNames, activeCategory]);

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}>
                <div 
                    className="bg-[#1A1513] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-[24px] shadow-2xl flex flex-col overflow-hidden relative border-0 md:border md:border-[#2A2A2A]" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header: Seamless blend */}
                    <div className="flex items-center justify-between px-6 pt-8 pb-4 md:px-10 z-20 flex-shrink-0 bg-[#1A1513]">
                        <h2 className="text-3xl font-bold text-[#FAF9F6] tracking-wide">
                            {t('userView.viewMenu') || 'Меню'}
                        </h2>
                        <button 
                            onClick={onClose} 
                            className="p-2 text-[#8A8A8A] hover:text-[#FAF9F6] transition-colors"
                        >
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-hidden flex flex-col relative bg-[#1A1513]">
                        
                        {/* Categories Tab System */}
                        {!loading && categoryNames.length > 0 && (
                            <div className="bg-[#1A1513] z-10 w-full overflow-x-auto no-scrollbar pb-4 pt-2 px-6 md:px-10 flex gap-6 flex-shrink-0 border-b border-[#2A2A2A]">
                                {categoryNames.map(category => (
                                    <button
                                        key={category}
                                        onClick={() => scrollToCategory(category)}
                                        className={`relative pb-2 whitespace-nowrap font-medium text-base md:text-lg transition-colors duration-300 ${
                                            activeCategory === category 
                                            ? 'text-[#D4A373]' 
                                            : 'text-[#8A8A8A] hover:text-[#FAF9F6]'
                                        }`}
                                    >
                                        {category}
                                        {activeCategory === category && (
                                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4A373] rounded-t-full"></span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Scrollable Dishes Grid */}
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 custom-scrollbar scroll-smooth">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#D4A373]"></div>
                                </div>
                            ) : categoryNames.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-[#4A4A4A]">
                                    <span className="text-6xl mb-4 opacity-50">🍽️</span>
                                    <span className="text-xl font-medium">Меню пока пусто</span>
                                </div>
                            ) : (
                                <div className="space-y-12 pb-24">
                                    {categoryNames.map(category => (
                                        <div key={category} id={`category-${category}`} className="scroll-mt-6">
                                            <h3 className="text-2xl font-bold text-[#FAF9F6] mb-6 tracking-wide">
                                                {category}
                                            </h3>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                                                {categorizedDishes[category].map(dish => (
                                                    <div 
                                                        key={dish.id} 
                                                        onClick={() => setSelectedDish(dish)}
                                                        className="bg-[#1f1a18] rounded-2xl overflow-hidden border border-[#2A2A2A] hover:border-[#D4A373]/50 flex flex-col group cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-xl"
                                                    >
                                                        <div className="relative aspect-[4/3] w-full bg-[#121212] overflow-hidden">
                                                            {dish.photoUrl ? (
                                                                <img src={dish.photoUrl} alt={dish.dishTitle} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[#4A4A4A]">
                                                                    <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="p-5 flex-1 flex flex-col">
                                                            <div className="flex justify-between items-start gap-3 mb-1">
                                                                <h4 className="text-lg font-bold text-[#FAF9F6] leading-snug group-hover:text-[#D4A373] transition-colors line-clamp-2">
                                                                    {dish.dishTitle}
                                                                </h4>
                                                                <div className="font-bold text-[#D4A373] whitespace-nowrap text-lg">
                                                                    {dish.price} ₸
                                                                </div>
                                                            </div>
                                                            
                                                            {dish.weight && (
                                                                <div className="text-sm font-medium text-[#8A8A8A] mb-3">
                                                                    {dish.weight}
                                                                </div>
                                                            )}
                                                            
                                                            {dish.description && (
                                                                <p className="text-sm text-[#A3A3A3] mt-auto leading-relaxed line-clamp-2">
                                                                    {dish.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dish Detail Overlay */}
            {selectedDish && (
                <DishDetailModal dish={selectedDish} onClose={() => setSelectedDish(null)} />
            )}
        </>
    );
};

export default GuestMenuModal;
