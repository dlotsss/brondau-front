import React, { useState, useRef, MouseEvent as ReactMouseEvent, useCallback, useEffect, TouchEvent as ReactTouchEvent } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, DecoElement, TextElement, Floor } from '../types';
import { useApp } from '../context/AppContext';

// Константы логического размера холста (виртуальные единицы)
const LOGICAL_WIDTH = 2000;
const LOGICAL_HEIGHT = 1500;

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

    // Масштаб для Desktop (чтобы все влезало)
    const [scale, setScale] = useState(1);
    const [isMobile, setIsMobile] = useState(false);

    const dragState = useRef<DragState | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ---
    useEffect(() => {
        if (restaurant && !isInitialized) {
            setElements(restaurant.layout || []);
            const resFloors = restaurant.floors || [{ id: 'floor-1', name: 'Основной зал' }];
            setFloors(resFloors);
            setActiveFloorId(resFloors[0]?.id || '');
            setIsInitialized(true);
        }
    }, [restaurant, isInitialized]);

    // --- АВТОМАТИЧЕСКОЕ МАСШТАБИРОВАНИЕ (FIT TO SCREEN) ---
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024; // Tailwind lg breakpoint
            setIsMobile(mobile);

            if (!containerRef.current) return;

            if (mobile) {
                // На мобильных не масштабируем принудительно под экран, даем скроллить
                // Можно поставить 0.7 или 1, как удобнее
                setScale(0.8);
            } else {
                // На десктопе вычисляем scale, чтобы вписать LOGICAL размер в контейнер
                const { clientWidth, clientHeight } = containerRef.current;
                // Отнимаем отступы (padding) если есть
                const wRatio = (clientWidth - 40) / LOGICAL_WIDTH;
                const hRatio = (clientHeight - 40) / LOGICAL_HEIGHT;
                const newScale = Math.min(wRatio, hRatio, 1); // Не увеличиваем больше 1
                setScale(newScale);
            }
        };

        // ResizeObserver следит за изменением размера контейнера
        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) observer.observe(containerRef.current);

        // Начальный вызов
        handleResize();

        return () => observer.disconnect();
    }, []);


    const selectedElement = elements.find(el => el.id === selectedElementId);

    const updateElement = (id: string, updates: Partial<LayoutElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    // --- ОБРАБОТЧИКИ НАЧАЛА ДЕЙСТВИЯ ---

    const handleStart = (clientX: number, clientY: number, id: string, mode: DragMode, direction?: string) => {
        const element = elements.find(el => el.id === id);
        if (!element) return;

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
        e.stopPropagation(); // Не даем клику уйти на фон (чтобы не сбросить выделение)
        e.preventDefault();
        // Левая кнопка мыши
        if (e.button === 0) {
            handleStart(e.clientX, e.clientY, id, 'move');
        }
    };

    const handleResizeMouseDown = (e: ReactMouseEvent, id: string, direction: string) => {
        e.stopPropagation();
        e.preventDefault();
        handleStart(e.clientX, e.clientY, id, 'resize', direction);
    };

    const handleTouchStart = (e: ReactTouchEvent, id: string) => {
        e.stopPropagation(); // Важно! Чтобы не сработал клик по контейнеру
        // Здесь e.preventDefault() не нужен, так как touch-action: none в CSS сделает своё дело для элемента
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, id, 'move');
    };

    // --- ОБРАБОТЧИКИ ДВИЖЕНИЯ ---

    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (!dragState.current) return;

        const { id, mode, startX, startY, initialX, initialY, initialWidth, initialHeight, resizeDirection } = dragState.current;

        // КОРРЕКЦИЯ НА МАСШТАБ
        // Если экран уменьшен (scale=0.5), движение мыши на 10px должно двигать объект на 20px логических.
        const deltaX = (clientX - startX) / scale;
        const deltaY = (clientY - startY) / scale;

        if (mode === 'move') {
            updateElement(id, {
                x: initialX + deltaX,
                y: initialY + deltaY
            });
        } else if (mode === 'resize' && resizeDirection) {
            // Логика ресайза (упрощенная для центральной точки)
            let newWidth = initialWidth;
            let newHeight = initialHeight;

            if (resizeDirection.includes('e')) newWidth = Math.max(20, initialWidth + deltaX * 2); // *2 т.к. центр фиксирован
            if (resizeDirection.includes('w')) newWidth = Math.max(20, initialWidth - deltaX * 2);
            if (resizeDirection.includes('s')) newHeight = Math.max(20, initialHeight + deltaY * 2);
            if (resizeDirection.includes('n')) newHeight = Math.max(20, initialHeight - deltaY * 2);

            // Для простоты UI мы меняем размеры относительно центра
            updateElement(id, { width: newWidth, height: newHeight });
        }
    }, [scale]); // scale в зависимостях важен!

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
        // passive: false нужно для некоторых браузеров, чтобы работали preventDefault при драге, если понадобится
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleEnd);
        };
    }, [handleMouseMove, handleTouchMove, handleEnd]);


    // --- УПРАВЛЕНИЕ UI ---

    const addElement = (type: any) => {
        const newId = `el-${Date.now()}`;
        // Добавляем в центр логического холста
        const startX = LOGICAL_WIDTH / 2;
        const startY = LOGICAL_HEIGHT / 2;

        let newElement: LayoutElement;
        const base = { id: newId, x: startX, y: startY, floorId: activeFloorId };

        if (type.startsWith('table')) {
            const count = elements.filter(e => e.type === 'table').length;
            newElement = { ...base, type: 'table', width: 80, height: 80, seats: 4, shape: type === 'table-square' ? 'square' : 'circle', label: (count + 1).toString() } as TableElement;
        } else if (type === 'text') {
            newElement = { ...base, type: 'text', width: 150, height: 50, label: 'Текст', fontSize: 24 } as TextElement;
        } else {
            const isV = type === 'wall' || type === 'window';
            newElement = { ...base, type: type, width: isV ? 15 : (type === 'bar' ? 200 : 60), height: isV ? 200 : 60 } as DecoElement;
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

    const ToolBtn = ({ label, onClick }: { label: string, onClick: () => void }) => (
        <button onClick={onClick} className="bg-brand-accent hover:bg-[#c27d3e] text-white text-xs px-3 py-2 rounded whitespace-nowrap shadow-sm border border-brand-primary/20">
            {label}
        </button>
    );

    const inputStyle = "w-full bg-white text-gray-900 p-1.5 rounded border border-gray-300 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue";

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-80px)]">

            {/* --- ЛЕВАЯ ПАНЕЛЬ (Инструменты) --- */}
            <div className="lg:w-64 flex flex-col gap-4 shrink-0">
                <div className="bg-brand-primary p-3 rounded-lg shadow border border-brand-accent">
                    <h3 className="font-bold text-white mb-2">Инструменты</h3>
                    <div className="flex lg:grid lg:grid-cols-2 gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
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

                {/* Свойства (Только Desktop) */}
                <div className="hidden lg:block bg-brand-primary p-3 rounded-lg shadow border border-brand-accent flex-grow">
                    <h3 className="font-bold text-white mb-2">Свойства</h3>
                    {selectedElement ? (
                        <div className="space-y-3 text-sm">
                            {(selectedElement.type === 'table' || selectedElement.type === 'text') && (
                                <div>
                                    <label className="text-gray-400 block">Название / Текст</label>
                                    <input type="text" value={(selectedElement as any).label} onChange={e => updateElement(selectedElement.id, { label: e.target.value } as any)} className="w-full bg-brand-secondary p-1 rounded border border-gray-600 text-gray-600" />
                                </div>
                            )}
                            {selectedElement.type === 'table' && (
                                <div>
                                    <label className="text-gray-400 block">Мест</label>
                                    <input type="number" value={(selectedElement as TableElement).seats} onChange={e => updateElement(selectedElement.id, { seats: parseInt(e.target.value) } as any)} className="w-full bg-brand-secondary p-1 rounded border border-gray-600 text-gray-600" />
                                </div>
                            )}
                            <div>
                                <label className="text-gray-400 block">Ширина</label>
                                <input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} className="w-full bg-brand-secondary p-1 rounded border border-gray-600 text-gray-600" />
                            </div>
                            <div>
                                <label className="text-gray-400 block">Высота</label>
                                <input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="w-full bg-brand-secondary p-1 rounded border border-gray-600 text-gray-600" />
                            </div>
                            <button onClick={deleteSelectedElement} className="w-full bg-brand-red/20 text-brand-red border border-brand-red/50 py-2 rounded mt-4 uppercase text-xs font-bold">Удалить</button>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-xs">Выберите элемент для редактирования</p>
                    )}
                </div>
            </div>

            {/* --- ЦЕНТРАЛЬНАЯ ЧАСТЬ (Холст) --- */}
            <div className="flex-grow flex flex-col h-full overflow-hidden">
                {/* Панель этажей */}
                <div className="bg-brand-secondary p-2 rounded-t-md border-b border-brand-accent">
                    <div className="flex flex-wrap gap-2">
                        {floors.map(f => (
                            <button key={f.id} onClick={() => setActiveFloorId(f.id)} className={`px-3 py-1.5 rounded text-sm font-medium ${activeFloorId === f.id ? 'bg-brand-blue text-white' : 'bg-brand-primary text-gray-300'}`}>
                                {f.name}
                            </button>
                        ))}
                        <button onClick={addFloor} className="px-3 py-1.5 rounded bg-brand-accent/30 text-brand-blue font-bold text-sm">+</button>
                    </div>
                </div>

                {/* КОНТЕЙНЕР ХОЛСТА */}
                <div
                    ref={containerRef}
                    // На мобильном - auto (скролл), на десктопе - hidden (все влезает scale)
                    className={`flex-grow bg-brand-secondary relative border-2 border-brand-accent bg-grid ${isMobile ? 'overflow-auto' : 'overflow-hidden'}`}
                    // Клик по фону снимает выделение
                    onClick={() => setSelectedElementId(null)}
                >
                    {/* ТРАНСФОРМИРУЕМЫЙ СЛОЙ */}
                    <div
                        style={{
                            width: `${LOGICAL_WIDTH}px`,
                            height: `${LOGICAL_HEIGHT}px`,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            // На мобильном принудительно задаем размер, чтобы работал скролл
                            // На десктопе скейлится, но место занимает scale-зависимое
                            position: 'absolute',
                            left: 0,
                            top: 0
                        }}
                    >
                        {currentFloorElements.map(el => {
                            const isSelected = el.id === selectedElementId;

                            // Стилизация
                            let content = null;
                            let shapeClass = '';
                            let bgClass = '';
                            if (el.type === 'table') {
                                shapeClass = el.shape === 'circle' ? 'rounded-full' : 'rounded-md';
                                bgClass = 'bg-gray-500 text-white font-bold shadow-md';
                                content = (el as TableElement).label;
                            } else if (el.type === 'text') {
                                content = <span style={{ fontSize: (el as TextElement).fontSize, whiteSpace: 'nowrap', color: '#000000', fontWeight: 'bold' }}>{(el as TextElement).label}</span>;
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
                                        outline: isSelected ? '3px solid #3b82f6' : 'none',
                                        // ВАЖНО для мобильного скролла карты:
                                        // touch-action: none на ЭЛЕМЕНТЕ запрещает скролл браузера, когда тянешь элемент.
                                        touchAction: 'none'
                                    }}
                                    className={`absolute flex items-center justify-center cursor-move select-none ${shapeClass} ${bgClass}`}
                                    onClick={(e) => {
                                        e.stopPropagation(); // Гарантируем, что клик по элементу выберет его и не уйдет на контейнер
                                        setSelectedElementId(el.id);
                                    }}
                                >
                                    {content}

                                    {/* Уголки ресайза (Только Desktop) */}
                                    {isSelected && !isMobile && (
                                        <>
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'nw')} className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border border-blue-500 cursor-nw-resize z-20 rounded-full" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'ne')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-blue-500 cursor-ne-resize z-20 rounded-full" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border border-blue-500 cursor-sw-resize z-20 rounded-full" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border border-blue-500 cursor-se-resize z-20 rounded-full" />
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* --- Свойства (MOBILE - Bottom Sheet) --- */}
            {selectedElement && isMobile && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-brand-primary border-t-2 border-brand-blue p-4 pb-8 shadow-2xl z-50 animate-slide-up rounded-t-xl max-h-[50vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold">Настройки</h3>
                        <button onClick={deleteSelectedElement} className="bg-red-900/40 text-red-300 text-xs font-bold border border-red-500/50 px-3 py-1.5 rounded">Удалить</button>
                    </div>

                    <div className="space-y-4">
                        {(selectedElement.type === 'table' || selectedElement.type === 'text') && (
                            <div>
                                <label className="text-gray-400 text-xs block mb-1">Текст / Название</label>
                                <input type="text" value={(selectedElement as any).label} onChange={e => updateElement(selectedElement.id, { label: e.target.value } as any)} className={inputStyle} />
                            </div>
                        )}

                        {/* Размер: Слайдер + Input */}
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-gray-400 text-xs">Ширина</label>
                                <span className="text-gray-500 text-xs">{selectedElement.width}px</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <input type="range" min="20" max="500" step="5" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} className="flex-1" />
                                <input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} className="w-16 bg-brand-secondary text-white p-1 rounded text-center text-sm border border-gray-600" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-gray-400 text-xs">Высота</label>
                                <span className="text-gray-500 text-xs">{selectedElement.height}px</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <input type="range" min="20" max="500" step="5" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="flex-1" />
                                <input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="w-16 bg-brand-secondary text-white p-1 rounded text-center text-sm border border-gray-600" />
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

export default ConstructorView;