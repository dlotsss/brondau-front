import React, { useState, useRef, MouseEvent as ReactMouseEvent, useCallback, useEffect, TouchEvent as ReactTouchEvent } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, DecoElement, TextElement, Floor } from '../types';
import { useApp } from '../context/AppContext';

// Константы логического размера холста (виртуальные единицы)
const LOGICAL_WIDTH = 1500;
const LOGICAL_HEIGHT = 1000;

type DragMode = 'move' | 'resize' | 'rotate' | 'select';
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
    initialPositions?: { id: string, x: number, y: number }[];
};

const ConstructorView: React.FC = () => {
    const { selectedRestaurantId } = useApp();
    const { getRestaurant, updateRestaurantSettings } = useData();
    const restaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;

    const [elements, setElements] = useState<LayoutElement[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [activeFloorId, setActiveFloorId] = useState<string>('');
    const [bookingRestriction, setBookingRestriction] = useState<number>(-1);
    const [isInitialized, setIsInitialized] = useState(false);

    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

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
            setBookingRestriction(restaurant.bookingRestriction ?? -1);
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
                setScale(0.8);
            } else {
                const { clientWidth, clientHeight } = containerRef.current;
                const wRatio = (clientWidth - 40) / LOGICAL_WIDTH;
                const hRatio = (clientHeight - 40) / LOGICAL_HEIGHT;
                const newScale = Math.min(wRatio, hRatio, 1);
                setScale(newScale);
            }
        };

        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) observer.observe(containerRef.current);

        handleResize();

        return () => observer.disconnect();
    }, []);


    const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
    const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;

    const updateElement = (id: string, updates: Partial<LayoutElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    // --- ОБРАБОТЧИКИ НАЧАЛА ДЕЙСТВИЯ ---

    const handleStart = (clientX: number, clientY: number, id: string, mode: DragMode, direction?: string, isShift?: boolean) => {
        const element = elements.find(el => el.id === id);
        if (!element && mode !== 'select') return;

        let newSelectedIds = [...selectedElementIds];
        if (mode !== 'select') {
            if (isShift) {
                if (newSelectedIds.includes(id)) {
                    // We don't remove on mouse down if it's already selected and we're just dragging
                    // But if we want to toggle, we do it here. 
                    // Actually, standard behavior: don't remove on mousedown, wait for click to remove? 
                    // Let's just do toggle on click, and ensure mousedown keeps it selected if dragging.
                    // Wait, simplest is:
                } else {
                    newSelectedIds.push(id);
                }
            } else if (!newSelectedIds.includes(id)) {
                newSelectedIds = [id];
            }
            setSelectedElementIds(newSelectedIds);
        }

        dragState.current = {
            id,
            mode,
            startX: clientX,
            startY: clientY,
            initialX: element?.x || 0,
            initialY: element?.y || 0,
            initialWidth: element?.width || 0,
            initialHeight: element?.height || 0,
            resizeDirection: direction
        };

        if (mode === 'move' && newSelectedIds.length > 0) {
            dragState.current.initialPositions = elements.filter(el => newSelectedIds.includes(el.id)).map(el => ({ id: el.id, x: el.x, y: el.y }));
        }

        if (mode === 'rotate') {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const centerX = rect.left + (element.x * scale);
                const centerY = rect.top + (element.y * scale);
                dragState.current.startX = centerX;
                dragState.current.startY = centerY;
            }
        }
    };

    const handleCanvasMouseDown = (e: ReactMouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.layout-element')) return; // handled by the element's onMouseDown

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;

        if (!e.shiftKey) {
            setSelectedElementIds([]);
        }
        setSelectionBox({ x, y, width: 0, height: 0 });

        dragState.current = {
            id: 'canvas',
            mode: 'select',
            startX: e.clientX,
            startY: e.clientY,
            initialX: x,
            initialY: y,
            initialWidth: 0,
            initialHeight: 0
        };
    };

    const handleMouseDown = (e: ReactMouseEvent, id: string) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button === 0) {
            handleStart(e.clientX, e.clientY, id, 'move', undefined, e.shiftKey);
        }
    };

    const handleResizeMouseDown = (e: ReactMouseEvent, id: string, direction: string) => {
        e.stopPropagation();
        e.preventDefault();
        handleStart(e.clientX, e.clientY, id, 'resize', direction);
    };

    const handleTouchStart = (e: ReactTouchEvent, id: string) => {
        e.stopPropagation();
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, id, 'move');
    };

    // --- ОБРАБОТЧИКИ ДВИЖЕНИЯ ---

    const handleMove = useCallback((clientX: number, clientY: number) => {
        if (!dragState.current) return;

        const { id, mode, startX, startY, initialX, initialY, initialWidth, initialHeight, resizeDirection, initialPositions } = dragState.current;

        const deltaX = (clientX - startX) / scale;
        const deltaY = (clientY - startY) / scale;

        if (mode === 'move') {
            if (initialPositions) {
                setElements(prev => prev.map(el => {
                    const pos = initialPositions.find(p => p.id === el.id);
                    if (pos) {
                        return { ...el, x: pos.x + deltaX, y: pos.y + deltaY };
                    }
                    return el;
                }));
            } else {
                updateElement(id, {
                    x: initialX + deltaX,
                    y: initialY + deltaY
                });
            }
        } else if (mode === 'select') {
            const currentLogicalX = initialX + deltaX;
            const currentLogicalY = initialY + deltaY;
            const x = Math.min(initialX, currentLogicalX);
            const y = Math.min(initialY, currentLogicalY);
            const w = Math.abs(currentLogicalX - initialX);
            const h = Math.abs(currentLogicalY - initialY);

            setSelectionBox({ x, y, width: w, height: h });

            setElements(prev => {
                const currentFloorElements = prev.filter(el => el.floorId === activeFloorId);
                const newlyEnclosedIds = currentFloorElements.filter(el => {
                    return (
                        el.x + el.width / 2 > x &&
                        el.x - el.width / 2 < x + w &&
                        el.y + el.height / 2 > y &&
                        el.y - el.height / 2 < y + h
                    );
                }).map(el => el.id);

                // Optional: we can aggregate with existing selections if shift key was used,
                // but for simplicity let's just use newlyEnclosedIds.
                // Wait, if we want additive selection to persist during drag:
                // If dragging selection, we need to know what was selected BEFORE the drag started.
                // Let's just set the new selection to the enclosed ids. 
                setSelectedElementIds(prevIds => {
                    // if shift is held (we'd need to track it), we could add them.
                    // For now, let's just replace.
                    return newlyEnclosedIds;
                });
                return prev;
            });
        } else if (mode === 'resize' && resizeDirection) {
            let newWidth = initialWidth;
            let newHeight = initialHeight;

            if (resizeDirection.includes('e')) newWidth = Math.max(20, initialWidth + deltaX * 2);
            if (resizeDirection.includes('w')) newWidth = Math.max(20, initialWidth - deltaX * 2);
            if (resizeDirection.includes('s')) newHeight = Math.max(20, initialHeight + deltaY * 2);
            if (resizeDirection.includes('n')) newHeight = Math.max(20, initialHeight - deltaY * 2);

            updateElement(id, { width: newWidth, height: newHeight });
        } else if (mode === 'rotate') {
            const dx = clientX - startX;
            const dy = clientY - startY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
            updateElement(id, { rotation: angle });
        }
    }, [scale, activeFloorId]);

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
        if (dragState.current?.mode === 'select') {
            setSelectionBox(null);
        }
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


    // --- УПРАВЛЕНИЕ UI ---

    const addElement = (type: any) => {
        const newId = `el-${Date.now()}`;
        const startX = LOGICAL_WIDTH / 2;
        const startY = LOGICAL_HEIGHT / 2;

        let newElement: LayoutElement;
        const base = { id: newId, x: startX, y: startY, floorId: activeFloorId };

        if (type.startsWith('table')) {
            const count = elements.filter(e => e.type === 'table').length;
            newElement = { ...base, type: 'table', width: 80, height: 80, seats: 4, shape: type === 'table-square' ? 'square' : 'circle', label: (count + 1).toString() } as TableElement;
        } else if (type === 'text') {
            newElement = { ...base, type: 'text', width: 150, height: 50, label: 'Текст', fontSize: 24 } as TextElement;
        } else if (type === 'stairs') {
            newElement = { ...base, type: 'stairs', width: 100, height: 100 } as DecoElement;
        } else if (type === 'plant') {
            newElement = { ...base, type: 'plant', width: 60, height: 60 } as DecoElement;
        } else {
            const isV = type === 'wall' || type === 'window';
            newElement = { ...base, type: type, width: isV ? 15 : (type === 'bar' ? 200 : 60), height: isV ? 200 : 60 } as DecoElement;
        }
        setElements(prev => [...prev, newElement]);
        setSelectedElementIds([newId]);
    };

    const deleteSelectedElement = () => {
        if (selectedElementIds.length === 0) return;
        setElements(prev => prev.filter(el => !selectedElementIds.includes(el.id)));
        setSelectedElementIds([]);
    };

    const handleSaveLayout = () => {
        if (!selectedRestaurantId) return;
        updateRestaurantSettings(selectedRestaurantId, { 
            layout: elements, 
            floors: floors,
            bookingRestriction: bookingRestriction
        });
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

    const deleteFloor = (floorId: string) => {
        if (floors.length <= 1) {
            alert('Нельзя удалить единственный зал.');
            return;
        }
        if (confirm('Вы уверены, что хотите удалить этот зал и все его элементы?')) {
            setFloors(prev => {
                const updated = prev.filter(f => f.id !== floorId);
                if (activeFloorId === floorId) {
                    setActiveFloorId(updated[0]?.id || '');
                }
                return updated;
            });
            setElements(prev => prev.filter(el => el.floorId !== floorId));
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

                {/* Настройки ресторана (Только для Owner) */}
                <div className="bg-brand-primary p-3 rounded-lg shadow border border-brand-accent">
                    <h3 className="font-bold text-white mb-2 text-sm">Настройки времени</h3>
                    <div className="space-y-2">
                        <label className="text-gray-400 text-xs block">Ограничение по умолчанию (мин)</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                value={bookingRestriction} 
                                onChange={e => setBookingRestriction(parseInt(e.target.value))} 
                                className="w-full bg-brand-secondary p-1.5 rounded border border-gray-600 text-white text-sm"
                                placeholder="-1 (нет)"
                            />
                            <span className="text-gray-500 text-[10px] whitespace-nowrap">{bookingRestriction === -1 ? 'Без огр.' : `${bookingRestriction} мин`}</span>
                        </div>
                        <p className="text-[10px] text-gray-500">Установите -1 для отключения ограничений.</p>
                    </div>
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
                    ) : selectedElements.length > 1 ? (
                        <div className="space-y-3 text-sm">
                            <p className="text-gray-400">Выделено элементов: {selectedElements.length}</p>
                            <button onClick={deleteSelectedElement} className="w-full bg-brand-red/20 text-brand-red border border-brand-red/50 py-2 rounded mt-4 uppercase text-xs font-bold">Удалить выбранные</button>
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
                            <div key={f.id} className="relative group">
                                <button onClick={() => setActiveFloorId(f.id)} className={`px-3 py-1.5 rounded text-sm font-medium pr-8 ${activeFloorId === f.id ? 'bg-brand-blue text-white' : 'bg-brand-primary text-gray-300'}`}>
                                    {f.name}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteFloor(f.id); }}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/20 text-white/50 hover:text-white transition-colors"
                                    title="Удалить зал"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                        <button onClick={addFloor} className="px-3 py-1.5 rounded bg-brand-accent/30 text-brand-blue font-bold text-sm">+</button>
                    </div>
                </div>

                {/* КОНТЕЙНЕР ХОЛСТА */}
                <div
                    ref={containerRef}
                    className={`flex-grow bg-brand-secondary relative border-2 border-brand-accent bg-grid canvas-container ${isMobile ? 'overflow-auto' : 'overflow-hidden'}`}
                    onMouseDown={handleCanvasMouseDown}
                >
                    {/* ТРАНСФОРМИРУЕМЫЙ СЛОЙ */}
                    <div
                        style={{
                            width: `${LOGICAL_WIDTH}px`,
                            height: `${LOGICAL_HEIGHT}px`,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                            position: 'absolute',
                            left: 0,
                            top: 0
                        }}
                    >
                        {currentFloorElements.map(el => {
                            const isSelected = selectedElementIds.includes(el.id);

                            // Стилизация
                            let content = null;
                            let shapeClass = '';
                            let bgClass = '';

                            if (el.type === 'table') {
                                shapeClass = el.shape === 'circle' ? 'rounded-full' : 'rounded-md';
                                bgClass = 'bg-gray-500 text-white font-bold shadow-md';
                                const fontSize = Math.min(el.width, el.height) * 0.4;
                                content = <span style={{ fontSize: `${fontSize}px` }}>{(el as TableElement).label}</span>;

                            } else if (el.type === 'text') {
                                content = <span style={{ fontSize: (el as TextElement).fontSize, whiteSpace: 'nowrap', color: '#000000', fontWeight: 'bold' }}>{(el as TextElement).label}</span>;

                            } else if (el.type === 'stairs') {
                                // ОБНОВЛЕННАЯ ЛОГИКА ДЛЯ ЛЕСТНИЦЫ (как в UserView)
                                bgClass = 'bg-gray-300';
                                content = (
                                    <div className="w-full h-full flex flex-col justify-evenly">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="w-full h-px bg-gray-500"></div>
                                        ))}
                                    </div>
                                );

                            } else if (el.type === 'plant') {
                                // ОБНОВЛЕННАЯ ЛОГИКА ДЛЯ РАСТЕНИЯ (как в UserView)
                                bgClass = 'bg-transparent';
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

                            } else if (el.type === 'arrow') {
                                bgClass = 'text-black';
                                content = (
                                    <svg viewBox={`0 0 ${el.width} ${el.height}`} fill="none" stroke="currentColor" strokeWidth="2.5" className="w-full h-full">
                                        <path d={`M 5 ${el.height / 2} H ${el.width - 15}`} strokeLinecap="round" />
                                        <path d={`M ${el.width - 25} ${el.height / 2 - 10} L ${el.width - 5} ${el.height / 2} L ${el.width - 25} ${el.height / 2 + 10}`} strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                );
                            } else {
                                // Wall, Window, Bar
                                const map: any = {
                                    wall: 'bg-gray-600',
                                    window: 'bg-sky-200/50 border-2 border-sky-300',
                                    bar: 'bg-yellow-800 border-b-4 border-yellow-900'
                                };
                                bgClass = map[el.type] || 'bg-brand-accent';
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
                                        transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg)`,
                                        outline: isSelected ? '3px solid #3b82f6' : 'none',
                                        touchAction: 'none'
                                    }}
                                    className={`layout-element absolute flex items-center justify-center cursor-move select-none ${shapeClass} ${bgClass}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (e.shiftKey) {
                                            setSelectedElementIds(prev => prev.includes(el.id) ? prev.filter(id => id !== el.id) : [...prev, el.id]);
                                        } else {
                                            // Handled by mouse down for selection, but we can enforce strict selection
                                            if (selectedElementIds.length > 1) {
                                                setSelectedElementIds([el.id]);
                                            }
                                        }
                                    }}
                                >
                                    {content}

                                    {/* Уголки ресайза (Только Desktop) */}
                                    {isSelected && !isMobile && (
                                        <>
                                            {/* Ручка вращения */}
                                            <div
                                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleStart(e.clientX, e.clientY, el.id, 'rotate'); }}
                                                className="absolute -top-10 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-accent border-2 border-white rounded-full cursor-alias z-30"
                                                title="Повернуть"
                                            >
                                                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-brand-accent" />
                                            </div>

                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'nw')} className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-white border border-blue-500 cursor-nw-resize z-20 rounded-full" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'ne')} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-blue-500 cursor-ne-resize z-20 rounded-full" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-4 h-4 bg-white border border-blue-500 cursor-sw-resize z-20 rounded-full" />
                                            <div onMouseDown={(e) => handleResizeMouseDown(e, el.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-white border border-blue-500 cursor-se-resize z-20 rounded-full" />
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {selectionBox && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: `${selectionBox.x}px`,
                                    top: `${selectionBox.y}px`,
                                    width: `${selectionBox.width}px`,
                                    height: `${selectionBox.height}px`,
                                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.8)',
                                    pointerEvents: 'none',
                                    zIndex: 100
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* --- Свойства (MOBILE - Bottom Sheet) --- */}
            {selectedElements.length > 0 && isMobile && (
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-brand-primary border-t-2 border-brand-blue p-4 pb-8 shadow-2xl z-50 animate-slide-up rounded-t-xl max-h-[50vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold">{selectedElements.length > 1 ? `Выделено: ${selectedElements.length}` : 'Настройки'}</h3>
                        <button onClick={deleteSelectedElement} className="bg-red-900/40 text-red-300 text-xs font-bold border border-red-500/50 px-3 py-1.5 rounded">Удалить</button>
                    </div>

                    {selectedElement ? (
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
                                    <input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: parseInt(e.target.value) })} className="w-16 bg-brand-secondary text-white p-1 rounded text-center text-sm border border-gray-600 text-gray-600" />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="text-gray-400 text-xs">Высота</label>
                                    <span className="text-gray-500 text-xs">{selectedElement.height}px</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input type="range" min="20" max="500" step="5" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="flex-1" />
                                    <input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: parseInt(e.target.value) })} className="w-16 bg-brand-secondary text-white p-1 rounded text-center text-sm border border-gray-600 text-gray-600" />
                                </div>
                            </div>
                        </div>
                    ) : null}
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
