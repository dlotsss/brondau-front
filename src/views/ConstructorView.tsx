import React, { useState, useRef, MouseEvent as ReactMouseEvent, useCallback, useEffect, TouchEvent as ReactTouchEvent } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, DecoElement, TextElement, Floor } from '../types';
import { useApp } from '../context/AppContext';

// Типы состояния перетаскивания
type DragMode = 'move' | 'resize';
type DragState = {
    id: string;
    mode: DragMode;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    resizeDirection?: string;
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

    const dragState = useRef<DragState | null>(null);
    const canvasRef = useRef<HTMLDivElement>(null);

    // Загрузка данных
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

    // --- ЛОГИКА КООРДИНАТ ---

    // Получить координаты относительно холста (учитывая скролл)
    const getCanvasCoordinates = (clientX: number, clientY: number) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: clientX - rect.left + canvasRef.current.scrollLeft,
            y: clientY - rect.top + canvasRef.current.scrollTop
        };
    };

    const updateElement = (id: string, updates: Partial<LayoutElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    // --- ОБРАБОТЧИКИ НАЧАЛА ДЕЙСТВИЯ (Mouse & Touch) ---

    const handleStart = (clientX: number, clientY: number, id: string, mode: DragMode, direction?: string) => {
        const element = elements.find(el => el.id === id);
        if (!element) return;

        // Если кликнули, делаем активным
        setSelectedElementId(id);

        dragState.current = {
            id,
            mode,
            startX: clientX,
            startY: clientY,
            initialX: element.x,
            initialY: element.y,
            initialWidth: element.width,
            initialHeight: element.height,
            resizeDirection: direction
        };
    };

    const handleMouseDown = (e: ReactMouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault(); // Важно для предотвращения выделения текста
        handleStart(e.clientX, e.clientY, id, 'move');
    };

    const handleResizeMouseDown = (e: ReactMouseEvent, id: string, direction: string) => {
        e.stopPropagation();
        e.preventDefault();
        handleStart(e.clientX, e.clientY, id, 'resize', direction);
    };

    const handleTouchStart = (e: ReactTouchEvent, id: string) => {
        e.stopPropagation();
        // e.preventDefault() не вызываем здесь, чтобы можно было скроллить если промахнулся,
        // но на самом элементе будет touch-action: none
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, id, 'move');
    };

    // --- ОБРАБОТЧИКИ ДВИЖЕНИЯ ---

    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (!dragState.current) return;
        const { id, mode, startX, startY, initialX, initialY, initialWidth, initialHeight, resizeDirection } = dragState.current;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        if (mode === 'move') {
            // Просто добавляем дельту к начальной позиции
            // Поскольку мы двигаем мышь на N пикселей, элемент должен сдвинуться на N пикселей.
            // Скролл холста здесь не влияет на дельту, только на абсолютные координаты при клике.
            updateElement(id, {
                x: initialX + deltaX,
                y: initialY + deltaY
            });
        } else if (mode === 'resize' && resizeDirection) {
            let newWidth = initialWidth;
            let newHeight = initialHeight;
            let newX = initialX;
            let newY = initialY;

            if (resizeDirection.includes('e')) newWidth = Math.max(20, initialWidth + deltaX);
            if (resizeDirection.includes('w')) {
                newWidth = Math.max(20, initialWidth - deltaX);
                newX = initialX + (initialWidth - newWidth); // Сдвигаем X, если тянем влево
            }
            if (resizeDirection.includes('s')) newHeight = Math.max(20, initialHeight + deltaY);
            if (resizeDirection.includes('n')) {
                newHeight = Math.max(20, initialHeight - deltaY);
                newY = initialY + (initialHeight - newHeight); // Сдвигаем Y, если тянем вверх
            }

            // Корректировка центра для кругов/квадратов, если мы меняем X/Y
            // В данной реализации x/y - это центр (из-за translate(-50%, -50%)), поэтому логика ресайза сложнее.
            // УПРОЩЕНИЕ: Для админки координаты обычно left/top.
            // Вернемся к модели: x,y - это top-left угол или центр? 
            // В UserView и AdminView используется `left: el.x, top: el.y` и `transform -translate-1/2`. Значит x,y - это ЦЕНТР.

            // Если x,y - это ЦЕНТР, то при изменении ширины вправо (east), центр должен сместиться вправо на половину изменения ширины.
            if (resizeDirection === 'e') newX = initialX + deltaX / 2;
            if (resizeDirection === 'w') newX = initialX + deltaX / 2; // deltaX отрицательная
            if (resizeDirection === 's') newY = initialY + deltaY / 2;
            if (resizeDirection === 'n') newY = initialY + deltaY / 2;

            // Для простоты ресайза лучше использовать модель top-left, но чтобы не ломать совместимость:
            // Просто обновляем ширину/высоту. Центр "плывет"? 
            // Да, если мы хотим оставить левый край на месте, а ширину увеличить, центр должен сдвинуться вправо.
            // newCenter = oldCenter + (newWidth - oldWidth) / 2

            if (resizeDirection === 'e') newX = initialX + (newWidth - initialWidth) / 2;
            if (resizeDirection === 'w') newX = initialX - (newWidth - initialWidth) / 2;
            if (resizeDirection === 's') newY = initialY + (newHeight - initialHeight) / 2;
            if (resizeDirection === 'n') newY = initialY - (newHeight - initialHeight) / 2;

            updateElement(id, { width: newWidth, height: newHeight, x: newX, y: newY });
        }
    }, []);

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (dragState.current) handleMove(e.clientX, e.clientY);
    }, [handleMove]);

    const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
        if (dragState.current) {
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
        }
    }, [handleMove]);

    const handleEnd = useCallback(() => {
        dragState.current = null;
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [handleMouseMove, handleTouchMove, handleEnd]);


    // --- УПРАВЛЕНИЕ ---

    const addElement = (type: any) => {
        const newId = `el-${Date.now()}`;
        // Добавляем в центр видимой области скролла
        const scrollX = canvasRef.current?.scrollLeft || 0;
        const scrollY = canvasRef.current?.scrollTop || 0;

        // Базовые координаты (центр видимой области ~ + смещение)
        const startX = scrollX + 300;
        const startY = scrollY + 300;

        let newElement: LayoutElement;
        const base = { id: newId, x: startX, y: startY, floorId: activeFloorId };

        if (type.startsWith('table')) {
            const count = elements.filter(e => e.type === 'table').length;
            newElement = { ...base, type: 'table', width: 60, height: 60, seats: 4, shape: type === 'table-square' ? 'square' : 'circle', label: (count + 1).toString() } as TableElement;
        } else if (type === 'text') {
            newElement = { ...base, type: 'text', width: 100, height: 40, label: 'Текст', fontSize: 16 } as TextElement;
        } else {
            const isV = type === 'wall' || type === 'window';
            newElement = { ...base, type: type, width: isV ? 10 : (type === 'bar' ? 150 : 40), height: isV ? 100 : 40 } as DecoElement;
        }
        setElements(prev => [...prev, newElement]);
        setSelectedElementId(newId);
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

    if (!restaurant) return <div className="text-center text-gray-400 p-8">Загрузка...</div>;
    const currentFloorElements = elements.filter(el => el.floorId === activeFloorId);

    // Компонент инструмента
    const ToolBtn = ({ label, onClick }: { label: string, onClick: () => void }) => (
        <button onClick={onClick} className="bg-brand-accent hover:bg-[#c27d3e] text-white text-xs px-3 py-2 rounded whitespace-nowrap shadow-sm border border-brand-primary/20">
            {label}
        </button>
    );

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-80px)]">

            {/* ЛЕВАЯ ПАНЕЛЬ (Инструменты + Свойства Desktop) */}
            <div className="lg:w-64 flex flex-col gap-4 shrink-0">
                {/* Инструменты */}
                <div className="bg-brand-primary p-3 rounded-lg shadow border border-brand-accent">
                    <h3 className="font-bold text-white mb-2">Инструменты</h3>
                    {/* Grid для десктопа, Flex-row скролл для мобилок */}
                    <div className="flex lg:grid lg:grid-cols-2 gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                        <ToolBtn label="Квадрат" onClick={() => addElement('table-square')} />
                        <ToolBtn label="Круг" onClick={() => addElement('table-circle')} />
                        <ToolBtn label="Стена" onClick={() => addElement('wall')} />
                        <ToolBtn label="Окно" onClick={() => addElement('window')} />
                        <ToolBtn label="Бар" onClick={() => addElement('bar')} />
                        <ToolBtn label="Цветок" onClick={() => addElement('plant')} />
                        <ToolBtn label="Текст" onClick={() => addElement('text')} />
                        <ToolBtn label="Стрелка" onClick={() => addElement('arrow')} />
                        <ToolBtn label="Лестн." onClick={() => addElement('stairs')} />
                    </div>
                    <button onClick={handleSaveLayout} className="w-full mt-4 bg-brand-blue text-white font-bold py-2 rounded hover:bg-blue-600 transition">
                        Сохранить
                    </button>
                </div>

                {/* Свойства (DESKTOP) - скрыто на мобильных */}
                <div className="hidden lg:block bg-brand-primary p-3 rounded-lg shadow border border-brand-accent flex-grow">
                    <h3 className="font-bold text-white mb-2">Свойства</h3>
                    {selectedElement ? (
                        <div className="space-y-3 text-sm">
                            {(selectedElement.type === 'table' || selectedElement.type === 'text') && (
                                <div>
                                    <label className="text-gray-400 block">Название / Текст</label>
                                    <input type="text" value={(selectedElement as any).label} onChange={e => updateElement(selectedElement.id, { label: e.target.value } as any)} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" />
                                </div>
                            )}
                            {selectedElement.type === 'table' && (
                                <div>
                                    <label className="text-gray-400 block">Мест</label>
                                    <input type="number" value={(selectedElement as TableElement).seats} onChange={e => updateElement(selectedElement.id, { seats: parseInt(e.target.value) } as any)} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" />
                                </div>
                            )}
                            <div>
                                <label className="text-gray-400 block">Ширина</label>
                                <input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" />
                            </div>
                            <div>
                                <label className="text-gray-400 block">Высота</label>
                                <input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" />
                            </div>
                            <button onClick={deleteSelectedElement} className="w-full bg-brand-red/20 text-brand-red border border-brand-red/50 py-2 rounded mt-4 uppercase text-xs font-bold">Удалить</button>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-xs">Выберите элемент</p>
                    )}
                </div>
            </div>

            {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ (Canvas) */}
            <div className="flex-grow flex flex-col h-full overflow-hidden">
                {/* Выбор этажа */}
                <div className="flex items-center space-x-2 bg-brand-secondary p-2 rounded-t-md border-b border-brand-accent overflow-x-auto">
                    {floors.map(f => (
                        <button key={f.id} onClick={() => setActiveFloorId(f.id)} className={`px-3 py-1 rounded text-sm font-medium whitespace-nowrap ${activeFloorId === f.id ? 'bg-brand-blue text-white' : 'text-gray-400'}`}>{f.name}</button>
                    ))}
                    <button onClick={addFloor} className="px-2 py-1 text-brand-blue font-bold">+</button>
                </div>

                {/* Холст */}
                <div
                    ref={canvasRef}
                    className="flex-grow bg-brand-secondary relative overflow-auto border-2 border-brand-accent bg-grid touch-none"
                    onClick={() => setSelectedElementId(null)}
                >
                    {/* Фиксированный размер внутренней области, чтобы было где скроллить */}
                    <div className="w-[2000px] h-[2000px] relative">
                        {currentFloorElements.map(el => {
                            const isSelected = el.id === selectedElementId;

                            // Рендер контента
                            let content = null;
                            let shapeClass = '';
                            let bgClass = '';

                            if (el.type === 'table') {
                                shapeClass = el.shape === 'circle' ? 'rounded-full' : 'rounded-md';
                                bgClass = 'bg-gray-500 text-white font-bold shadow-md';
                                content = (el as TableElement).label;
                            } else if (el.type === 'text') {
                                bgClass = 'border border-dashed border-gray-400';
                                content = <span style={{ fontSize: (el as TextElement).fontSize }}>{(el as TextElement).label}</span>;
                            } else if (el.type === 'plant') {
                                content = <div className="w-2/3 h-2/3 bg-green-700 rounded-full opacity-80"></div>;
                            } else {
                                const map: any = { wall: 'bg-gray-600', window: 'bg-sky-200/50 border-2 border-sky-300', bar: 'bg-yellow-800 border-b-4 border-yellow-900', arrow: 'text-2xl text-black' };
                                bgClass = map[el.type] || 'bg-brand-accent';
                                if (el.type === 'arrow') content = '➔';
                            }

                            return (
                                <div
                                    key={el.id}
                                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                                    onTouchStart={(e) => handleTouchStart(e, el.id)}
                                    style={{
                                        left: `${el.x}px`, top: `${el.y}px`,
                                        width: `${el.width}px`, height: `${el.height}px`,
                                        zIndex: isSelected ? 50 : 10,
                                        transform: 'translate(-50%, -50%)', // Центрируем координату
                                        outline: isSelected ? '2px solid #3b82f6' : 'none',
                                        touchAction: 'none' // Блокируем скролл браузера при драге
                                    }}
                                    className={`absolute flex items-center justify-center cursor-move select-none ${shapeClass} ${bgClass}`}
                                >
                                    {content}

                                    {/* Resize Handles (Desktop Only) */}
                                    {isSelected && (
                                        <>
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'nw')} className="hidden md:block absolute -top-1 -left-1 w-3 h-3 bg-white border border-blue-500 cursor-nw-resize z-20" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'ne')} className="hidden md:block absolute -top-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-ne-resize z-20" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'sw')} className="hidden md:block absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-blue-500 cursor-sw-resize z-20" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'se')} className="hidden md:block absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-se-resize z-20" />
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Свойства (MOBILE) - Bottom Sheet */}
            {selectedElement && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-brand-primary border-t-2 border-brand-blue p-4 shadow-2xl z-50 animate-slide-up rounded-t-xl">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold">Настройки</h3>
                        <button onClick={deleteSelectedElement} className="text-red-400 text-sm font-bold border border-red-500/50 px-3 py-1 rounded">Удалить</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {(selectedElement.type === 'table' || selectedElement.type === 'text') && (
                            <div className="col-span-2">
                                <label className="text-gray-400 text-xs block">Текст</label>
                                <input type="text" value={(selectedElement as any).label} onChange={e => updateElement(selectedElement.id, { label: e.target.value } as any)} className="w-full bg-brand-secondary p-2 rounded text-white border border-gray-600" />
                            </div>
                        )}
                        <div className="col-span-2 space-y-2">
                            <label className="text-gray-400 text-xs block">Размеры (Ширина / Высота)</label>
                            <div className="flex items-center gap-2">
                                <input type="range" min="20" max="400" step="5" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} className="flex-1" />
                                <span className="text-white text-xs w-8">{selectedElement.width}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="range" min="20" max="400" step="5" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="flex-1" />
                                <span className="text-white text-xs w-8">{selectedElement.height}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .bg-grid { background-image: linear-gradient(to right, #d5b483 1px, transparent 1px), linear-gradient(to bottom, #d5b483 1px, transparent 1px); background-size: 40px 40px; }
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ConstructorView;