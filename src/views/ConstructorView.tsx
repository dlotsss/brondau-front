import React, { useState, useRef, MouseEvent as ReactMouseEvent, useCallback, useEffect, TouchEvent as ReactTouchEvent } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, DecoElement, TextElement, Floor } from '../types';
import { useApp } from '../context/AppContext';

// Типы для обработки жестов
type DragState = {
    id: string;
    mode: 'move' | 'resize' | 'none';
    startX: number;
    startY: number;
    initialElementX: number;
    initialElementY: number;
    initialDistance: number; // Расстояние между пальцами для зума
    initialWidth: number;
    initialHeight: number;
};

const ConstructorView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant, updateLayout } = useData();
    const restaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;

    const [elements, setElements] = useState<LayoutElement[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    // Ссылка на текущее состояние перетаскивания/ресайза
    const gestureRef = useRef<DragState | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (restaurant && !isInitialized) {
            setElements(restaurant.layout || []);
            const resFloors = restaurant.floors || [{ id: 'floor-1', name: 'Основной зал' }];
            setFloors(resFloors);
            setActiveFloorId(resFloors[0]?.id || '');
            setIsInitialized(true);
        }
    }, [restaurant, isInitialized]);

    const selectedElement = elements.find(el => el.id === selectedElementId);

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    // Расстояние между двумя точками касания (для щипка)
    const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
        return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    };

    const updateElement = (id: string, updates: Partial<LayoutElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    // --- ОБРАБОТЧИКИ СОБЫТИЙ (MOUSE & TOUCH) ---

    // Начало касания (или клика)
    const handleStart = (clientX: number, clientY: number, id: string, e: any) => {
        e.stopPropagation();
        const element = elements.find(el => el.id === id);
        if (!element) return;

        setSelectedElementId(id);

        // Если это touch событие и пальцев 2 -> режим ресайза
        if (e.touches && e.touches.length === 2) {
            const dist = getDistance(e.touches[0], e.touches[1]);
            gestureRef.current = {
                id,
                mode: 'resize',
                startX: 0, startY: 0, initialElementX: 0, initialElementY: 0, // Не используются для ресайза
                initialDistance: dist,
                initialWidth: element.width,
                initialHeight: element.height
            };
        } else {
            // Режим перемещения (1 палец или мышь)
            gestureRef.current = {
                id,
                mode: 'move',
                startX: clientX,
                startY: clientY,
                initialElementX: element.x,
                initialElementY: element.y,
                initialDistance: 0,
                initialWidth: 0, initialHeight: 0
            };
        }
    };

    const handleMouseDown = (e: ReactMouseEvent, id: string) => {
        e.preventDefault(); // Предотвращаем выделение текста
        handleStart(e.clientX, e.clientY, id, e);
    };

    const handleTouchStart = (e: ReactTouchEvent, id: string) => {
        // e.preventDefault() здесь нельзя, иначе скролл не будет работать, если промахнулся
        // Но если попали по элементу, скролл нам мешает.
        // Решим через CSS touch-action: none на элементе
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, id, e);
    };

    // Движение
    const handleMove = useCallback((clientX: number, clientY: number, e: any) => {
        if (!gestureRef.current) return;
        const { id, mode, startX, startY, initialElementX, initialElementY, initialDistance, initialWidth, initialHeight } = gestureRef.current;

        // Обработка 2 пальцев (щипок/растягивание)
        if (mode === 'resize' && e.touches && e.touches.length === 2) {
            e.preventDefault(); // Блокируем зум браузера
            const currentDist = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDist / initialDistance;

            // Ограничиваем минимальный размер
            const newWidth = Math.max(20, Math.round(initialWidth * scale));
            const newHeight = Math.max(20, Math.round(initialHeight * scale));

            updateElement(id, { width: newWidth, height: newHeight });
            return;
        }

        // Обработка 1 пальца (перемещение)
        if (mode === 'move') {
            // Для touch предотвращаем скролл страницы, пока тащим элемент
            if (e.type === 'touchmove') e.preventDefault();

            // Учитываем зум браузера и скролл контейнера, если нужно, но пока просто дельта
            // ВАЖНО: clientX - это координаты экрана. Canvas может быть проскроллен.
            // Но мы меняем absolute left/top внутри relative контейнера.
            // Дельта движения пальца равна дельте движения элемента.

            const deltaX = clientX - startX;
            const deltaY = clientY - startY;

            updateElement(id, {
                x: initialElementX + deltaX,
                y: initialElementY + deltaY
            });
        }
    }, []);

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (gestureRef.current) handleMove(e.clientX, e.clientY, e);
    }, [handleMove]);

    const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
        if (gestureRef.current) {
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY, e);
        }
    }, [handleMove]);

    const handleEnd = useCallback(() => {
        gestureRef.current = null;
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleEnd);
        // non-passive чтобы работал preventDefault внутри для блокировки скролла при драге
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [handleMouseMove, handleTouchMove, handleEnd]);

    // --- ЛОГИКА ДОБАВЛЕНИЯ ЭЛЕМЕНТОВ ---

    const addElement = (type: any) => {
        const newId = `el-${Date.now()}`;
        // Добавляем в центр видимой области (примерно) или просто со сдвигом от скролла
        const scrollX = canvasRef.current?.scrollLeft || 0;
        const scrollY = canvasRef.current?.scrollTop || 0;
        const startX = scrollX + 150;
        const startY = scrollY + 200;

        let newElement: LayoutElement;
        const baseProps = { id: newId, x: startX, y: startY, floorId: activeFloorId };

        if (type.startsWith('table')) {
            const count = elements.filter(e => e.type === 'table').length;
            newElement = { ...baseProps, type: 'table', width: 60, height: 60, seats: 4, shape: type === 'table-square' ? 'square' : 'circle', label: (count + 1).toString() } as TableElement;
        } else if (type === 'text') {
            newElement = { ...baseProps, type: 'text', width: 100, height: 40, label: 'Текст', fontSize: 16 } as TextElement;
        } else {
            const isV = type === 'wall' || type === 'window';
            newElement = { ...baseProps, type: type, width: isV ? 10 : (type === 'bar' ? 150 : 40), height: isV ? 100 : 40 } as DecoElement;
        }
        setElements(prev => [...prev, newElement]);
        setSelectedElementId(newId); // Сразу выбираем добавленный
    };

    const deleteSelectedElement = () => {
        if (!selectedElementId) return;
        setElements(prev => prev.filter(el => el.id !== selectedElementId));
        setSelectedElementId(null);
    };

    const handleSaveLayout = () => {
        if (!selectedRestaurantId) return;
        updateLayout(selectedRestaurantId, elements, floors);
        alert('Сохранено!');
    };

    const addFloor = () => {
        const name = prompt('Название зала:', `Зал ${floors.length + 1}`);
        if (name) {
            const newFloor = { id: `floor-${Date.now()}`, name };
            setFloors(prev => [...prev, newFloor]);
            setActiveFloorId(newFloor.id);
        }
    };

    if (!restaurant) return <div className="p-4 text-center text-gray-500">Загрузка...</div>;

    const currentFloorElements = elements.filter(el => el.floorId === activeFloorId);

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] relative overflow-hidden bg-brand-secondary">

            {/* 1. ВЕРХНЯЯ ПАНЕЛЬ: Залы и Сохранение */}
            <div className="flex justify-between items-center p-2 bg-brand-primary shadow-md z-10">
                <div className="flex gap-2 overflow-x-auto max-w-[70%] no-scrollbar">
                    {floors.map(f => (
                        <button key={f.id} onClick={() => setActiveFloorId(f.id)} className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${activeFloorId === f.id ? 'bg-brand-blue text-white' : 'bg-brand-accent text-gray-200'}`}>
                            {f.name}
                        </button>
                    ))}
                    <button onClick={addFloor} className="px-3 py-1.5 rounded bg-brand-accent/50 text-brand-blue font-bold">+</button>
                </div>
                <button onClick={handleSaveLayout} className="px-3 py-1.5 rounded bg-green-600 text-white text-sm font-bold shadow">
                    Save
                </button>
            </div>

            {/* 2. ПАНЕЛЬ ИНСТРУМЕНТОВ (Скролл по горизонтали) */}
            <div className="bg-brand-secondary border-b border-brand-accent p-2 overflow-x-auto z-10">
                <div className="flex space-x-3 min-w-max">
                    <ToolButton label="Квадрат" onClick={() => addElement('table-square')} />
                    <ToolButton label="Круг" onClick={() => addElement('table-circle')} />
                    <ToolButton label="Стена" onClick={() => addElement('wall')} />
                    <ToolButton label="Окно" onClick={() => addElement('window')} />
                    <ToolButton label="Бар" onClick={() => addElement('bar')} />
                    <ToolButton label="Цветок" onClick={() => addElement('plant')} />
                    <ToolButton label="Текст" onClick={() => addElement('text')} />
                    <ToolButton label="Стрелка" onClick={() => addElement('arrow')} />
                    <ToolButton label="Лестн." onClick={() => addElement('stairs')} />
                </div>
            </div>

            {/* 3. ХОЛСТ (CANVAS) */}
            <div ref={canvasRef} className="flex-grow overflow-auto relative bg-grid touch-pan-x touch-pan-y" onClick={() => setSelectedElementId(null)}>
                <div className="w-[1500px] h-[1500px] relative">
                    {currentFloorElements.map(el => {
                        const isSelected = el.id === selectedElementId;
                        return (
                            <div
                                key={el.id}
                                onMouseDown={(e) => handleMouseDown(e, el.id)}
                                onTouchStart={(e) => handleTouchStart(e, el.id)}
                                style={{
                                    left: el.x, top: el.y, width: el.width, height: el.height,
                                    zIndex: isSelected ? 50 : 10,
                                    // transform translate нужен, чтобы x,y были центром элемента (как в админке)
                                    transform: 'translate(-50%, -50%)',
                                    outline: isSelected ? '3px solid #3b82f6' : 'none',
                                    touchAction: 'none' // ВАЖНО: блокирует скролл браузера при касании элемента
                                }}
                                className={`absolute flex items-center justify-center shadow-sm select-none
                                    ${el.type === 'table' ? (el.shape === 'circle' ? 'rounded-full bg-gray-500 text-white' : 'rounded-md bg-gray-500 text-white') : ''}
                                    ${el.type === 'wall' ? 'bg-gray-600' : ''}
                                    ${el.type === 'window' ? 'bg-sky-200/50 border-2 border-sky-300' : ''}
                                    ${el.type === 'bar' ? 'bg-yellow-800 border-b-4 border-yellow-900' : ''}
                                    ${el.type === 'text' ? 'border border-dashed border-gray-400' : ''}
                                `}
                            >
                                {/* Рендер содержимого (упрощено для примера) */}
                                {el.type === 'table' && <span className="font-bold">{(el as TableElement).label}</span>}
                                {el.type === 'text' && <span style={{ fontSize: (el as TextElement).fontSize }}>{(el as TextElement).label}</span>}
                                {el.type === 'plant' && <div className="w-2/3 h-2/3 bg-green-700 rounded-full opacity-80"></div>}
                                {el.type === 'arrow' && <span className="text-2xl text-black">➔</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4. НИЖНЯЯ ПАНЕЛЬ СВОЙСТВ (BOTTOM SHEET) - Только если выбран элемент */}
            {selectedElement && (
                <div className="bg-brand-primary border-t-2 border-brand-blue p-4 pb-8 shadow-2xl z-50 animate-slide-up">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold text-lg">Настройки элемента</h3>
                        <button onClick={deleteSelectedElement} className="bg-red-500/20 text-red-400 px-3 py-1 rounded text-sm font-bold border border-red-500/50">
                            Удалить
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Имя / Текст */}
                        {(selectedElement.type === 'table' || selectedElement.type === 'text') && (
                            <div className="col-span-2">
                                <label className="text-gray-400 text-xs block mb-1">Название / Текст</label>
                                <input
                                    type="text"
                                    value={(selectedElement as any).label}
                                    onChange={(e) => updateElement(selectedElement.id, { label: e.target.value } as any)}
                                    className="w-full bg-brand-secondary p-2 rounded text-white border border-gray-600"
                                />
                            </div>
                        )}

                        {/* Места (для столов) */}
                        {selectedElement.type === 'table' && (
                            <div className="col-span-2">
                                <label className="text-gray-400 text-xs block mb-1">Количество мест: {(selectedElement as TableElement).seats}</label>
                                <input
                                    type="range" min="1" max="12" step="1"
                                    value={(selectedElement as TableElement).seats}
                                    onChange={(e) => updateElement(selectedElement.id, { seats: parseInt(e.target.value) } as any)}
                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Слайдеры размеров - Удобно для мобилок */}
                        <div className="col-span-2 space-y-3 pt-2 border-t border-gray-700 mt-2">
                            <p className="text-gray-400 text-xs">Размеры (Растягивание)</p>
                            <div className="flex items-center gap-3">
                                <span className="text-white text-xs w-8">Шир:</span>
                                <input
                                    type="range" min="20" max="400" step="5"
                                    value={selectedElement.width}
                                    onChange={(e) => updateElement(selectedElement.id, { width: parseInt(e.target.value) })}
                                    className="flex-1 h-2 bg-brand-accent rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-gray-400 text-xs w-6 text-right">{selectedElement.width}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-white text-xs w-8">Выс:</span>
                                <input
                                    type="range" min="20" max="400" step="5"
                                    value={selectedElement.height}
                                    onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) })}
                                    className="flex-1 h-2 bg-brand-accent rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-gray-400 text-xs w-6 text-right">{selectedElement.height}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .bg-grid { background-image: linear-gradient(to right, #d5b483 1px, transparent 1px), linear-gradient(to bottom, #d5b483 1px, transparent 1px); background-size: 40px 40px; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

const ToolButton: React.FC<{ label: string, onClick: () => void }> = ({ label, onClick }) => (
    <button
        onClick={onClick}
        className="flex-shrink-0 bg-brand-accent hover:bg-orange-700 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-sm transition-colors border border-brand-primary/20"
    >
        {label}
    </button>
);

export default ConstructorView;