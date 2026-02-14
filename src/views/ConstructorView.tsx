import React, { useState, useRef, MouseEvent as ReactMouseEvent, useCallback, useEffect, TouchEvent as ReactTouchEvent } from 'react';
import { useData } from '../context/DataContext';
import { LayoutElement, TableElement, DecoElement, TextElement, Floor } from '../types';
import { useApp } from '../context/AppContext';

type DraggableItem = {
    id: string;
    offsetX: number;
    offsetY: number;
};

type ResizableItem = {
    id: string;
    direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    startMouseX: number;
    startMouseY: number;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
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

    const draggableRef = useRef<DraggableItem | null>(null);
    const resizableRef = useRef<ResizableItem | null>(null);
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

    // MOUSE EVENTS
    const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const targetElement = e.currentTarget;
        const rect = targetElement.getBoundingClientRect();
        draggableRef.current = { id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
        setSelectedElementId(id);
    };

    // TOUCH EVENTS (Mobile)
    const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>, id: string) => {
        // e.preventDefault(); // Sometimes needed, but might block scroll.
        e.stopPropagation();
        const targetElement = e.currentTarget;
        const rect = targetElement.getBoundingClientRect();
        const touch = e.touches[0];
        draggableRef.current = { id, offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
        setSelectedElementId(id);
    };

    const handleResizeStart = (e: ReactMouseEvent<HTMLDivElement>, id: string, direction: ResizableItem['direction']) => {
        e.preventDefault();
        e.stopPropagation();
        const element = elements.find(el => el.id === id);
        if (!element) return;
        resizableRef.current = {
            id, direction,
            startMouseX: e.clientX, startMouseY: e.clientY,
            startWidth: element.width, startHeight: element.height,
            startX: element.x, startY: element.y
        };
    };

    // Shared Move Logic
    const moveElement = (clientX: number, clientY: number) => {
        if (resizableRef.current && canvasRef.current) {
            // Resizing logic (Mouse only typically for precision, but could map to touch)
            const { id, direction, startMouseX, startMouseY, startWidth, startHeight, startX, startY } = resizableRef.current;
            const deltaX = clientX - startMouseX;
            const deltaY = clientY - startMouseY;

            setElements(prev => prev.map(el => {
                if (el.id !== id) return el;
                let newWidth = startWidth, newHeight = startHeight, newX = startX, newY = startY;

                if (direction.includes('e')) { newWidth = Math.max(20, startWidth + deltaX); newX = startX + (newWidth - startWidth) / 2; }
                if (direction.includes('w')) { newWidth = Math.max(20, startWidth - deltaX); newX = startX - (newWidth - startWidth) / 2; }
                if (direction.includes('s')) { newHeight = Math.max(20, startHeight + deltaY); newY = startY + (newHeight - startHeight) / 2; }
                if (direction.includes('n')) { newHeight = Math.max(20, startHeight - deltaY); newY = startY - (newHeight - startHeight) / 2; }

                return { ...el, width: newWidth, height: newHeight, x: newX, y: newY };
            }));
            return;
        }

        if (draggableRef.current && canvasRef.current) {
            const { id, offsetX, offsetY } = draggableRef.current;
            const canvasRect = canvasRef.current.getBoundingClientRect();
            // Calculate relative to scrollable canvas content if needed, 
            // but here we just need relative to viewport minus canvas offset

            // Adjust for scroll? If the container scrolls, clientX relative to viewport is fine, 
            // but we need the element position relative to the container.

            // Note: If canvas has overflow, getBoundingClientRect returns the visible box.
            // But 'scrollLeft' matters for the coordinate inside.
            const scrollLeft = canvasRef.current.scrollLeft || 0;
            const scrollTop = canvasRef.current.scrollTop || 0;

            let newX = clientX - canvasRect.left + scrollLeft;
            let newY = clientY - canvasRect.top + scrollTop;

            setElements(prev => prev.map(el => {
                if (el.id !== id) return el;
                const pivotX = el.width / 2;
                const pivotY = el.height / 2;
                return { ...el, x: newX - offsetX + pivotX, y: newY - offsetY + pivotY };
            }));
        }
    };

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (draggableRef.current || resizableRef.current) moveElement(e.clientX, e.clientY);
    }, []);

    const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
        if (draggableRef.current) {
            const touch = e.touches[0];
            moveElement(touch.clientX, touch.clientY);
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        draggableRef.current = null;
        resizableRef.current = null;
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp, handleTouchMove]);

    const addElement = (type: any) => {
        const newId = `el-${Date.now()}`;
        // Default center of visible area approx
        const startX = (canvasRef.current?.scrollLeft || 0) + 150;
        const startY = (canvasRef.current?.scrollTop || 0) + 150;

        let newElement: LayoutElement;
        if (type === 'table-square' || type === 'table-circle') {
            const tableCount = elements.filter(e => e.type === 'table').length;
            newElement = { id: newId, type: 'table', x: startX, y: startY, width: 60, height: 60, seats: 4, shape: type === 'table-square' ? 'square' : 'circle', label: (tableCount + 1).toString(), floorId: activeFloorId } as TableElement;
        } else if (type === 'text') {
            newElement = { id: newId, type: 'text', x: startX, y: startY, width: 100, height: 40, label: 'Текст', fontSize: 16, floorId: activeFloorId } as TextElement;
        } else {
            const isVertical = type === 'wall' || type === 'window';
            newElement = { id: newId, type: type, x: startX, y: startY, width: isVertical ? 10 : (type === 'bar' ? 150 : 40), height: isVertical ? 100 : 40, floorId: activeFloorId } as DecoElement;
        }
        setElements(prev => [...prev, newElement]);
    };

    const updateSelectedElement = (prop: string, value: any) => {
        if (!selectedElementId) return;
        setElements(prev => prev.map(el => el.id === selectedElementId ? { ...el, [prop]: value } : el));
    };

    const deleteSelectedElement = () => {
        if (!selectedElementId) return;
        setElements(prev => prev.filter(el => el.id !== selectedElementId));
        setSelectedElementId(null);
    };

    const addFloor = () => {
        const name = prompt('Название зала:', `Зал ${floors.length + 1}`);
        if (name) {
            const newFloor = { id: `floor-${Date.now()}`, name };
            setFloors(prev => [...prev, newFloor]);
            setActiveFloorId(newFloor.id);
        }
    };

    const handleSaveLayout = () => {
        if (!selectedRestaurantId) return;
        updateLayout(selectedRestaurantId, elements, floors);
        alert('План зала сохранен!');
    };

    if (!restaurant) return <div className="text-center text-gray-400">Загрузка...</div>;

    const currentFloorElements = elements.filter(el => el.floorId === activeFloorId);

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#2c1f14' }}>Конструктор</h2>
                <div className="flex items-center space-x-2 bg-brand-secondary p-1 rounded-md border border-brand-accent overflow-x-auto max-w-full">
                    {floors.map(f => (
                        <button key={f.id} onClick={() => setActiveFloorId(f.id)} className={`px-3 py-1 rounded text-sm font-medium whitespace-nowrap ${activeFloorId === f.id ? 'bg-brand-blue text-white' : 'text-gray-400'}`}>{f.name}</button>
                    ))}
                    <button onClick={addFloor} className="px-3 py-1 rounded text-sm font-medium text-brand-blue">+</button>
                </div>
            </div>

            {/* Tools Panel - Scrollable horizontally on mobile */}
            <div className="bg-brand-primary p-2 rounded-lg shadow border border-brand-accent overflow-x-auto">
                <div className="flex flex-row space-x-2 min-w-max pb-1">
                    <button onClick={() => addElement('table-square')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Квадрат</button>
                    <button onClick={() => addElement('table-circle')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Круг</button>
                    <button onClick={() => addElement('wall')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Стена</button>
                    <button onClick={() => addElement('window')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Окно</button>
                    <button onClick={() => addElement('bar')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Бар</button>
                    <button onClick={() => addElement('plant')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Цветок</button>
                    <button onClick={() => addElement('text')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Текст</button>
                    <button onClick={() => addElement('arrow')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Стрелка</button>
                    <button onClick={() => addElement('stairs')} className="bg-brand-accent px-3 py-2 rounded text-xs whitespace-nowrap hover:bg-[#c27d3e]">Лестница</button>
                    <div className="w-px bg-gray-600 mx-2"></div>
                    <button onClick={handleSaveLayout} className="bg-brand-blue text-white font-bold px-4 py-2 rounded text-xs shadow">Сохранить</button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 flex-grow overflow-hidden">
                {/* Canvas Container */}
                <div ref={canvasRef} className="flex-grow w-full bg-brand-secondary rounded-lg relative overflow-auto border-2 border-brand-accent bg-grid touch-none">
                    <div className="w-[1200px] h-[1200px] relative"> {/* Large workspace */}
                        {currentFloorElements.map(el => {
                            const isSelected = el.id === selectedElementId;
                            const baseStyles = {
                                left: `${el.x}px`, top: `${el.y}px`,
                                width: `${el.width}px`, height: `${el.height}px`,
                                zIndex: isSelected ? 10 : 1,
                                outline: isSelected ? '2px solid #d5b483' : 'none',
                            };

                            let content = null;
                            let classes = `absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move shadow-sm group flex items-center justify-center select-none`;

                            // ... (rendering logic same as original, omitted for brevity) ...
                            // Insert content rendering logic here from original file
                            if (el.type === 'table') {
                                classes += el.shape === 'circle' ? ' rounded-full bg-gray-500 text-white font-bold shadow-md' : ' rounded-md bg-gray-500 text-white font-bold shadow-md';
                                content = (el as TableElement).label;
                            } else if (el.type === 'text') {
                                classes += ' bg-transparent border-dashed border border-gray-400';
                                content = <div style={{ fontSize: `${(el as TextElement).fontSize}px` }}>{(el as TextElement).label}</div>;
                            } else {
                                classes += el.type === 'wall' ? ' bg-gray-600' : ' bg-brand-accent';
                            }

                            return (
                                <div
                                    key={el.id}
                                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                                    onTouchStart={(e) => handleTouchStart(e, el.id)}
                                    style={baseStyles}
                                    className={classes}
                                >
                                    {content}
                                    {/* Resizers only for mouse for now to keep mobile simple */}
                                    {isSelected && (
                                        <div className="hidden md:block">
                                            <div onMouseDown={(e) => handleResizeStart(e, el.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full cursor-se-resize z-20"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Properties Panel (Bottom on mobile, Side on desktop) */}
                {selectedElement && (
                    <div className="lg:w-64 bg-brand-primary p-4 rounded-lg shadow-lg overflow-y-auto max-h-[200px] lg:max-h-full">
                        <h4 className="font-bold mb-2 text-sm text-white">Свойства</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
                            {selectedElement.type === 'table' && (
                                <>
                                    <div><label className="text-gray-400 block">Название</label><input type="text" value={(selectedElement as TableElement).label} onChange={e => updateSelectedElement('label', e.target.value)} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" /></div>
                                    <div><label className="text-gray-400 block">Мест</label><input type="number" value={(selectedElement as TableElement).seats} onChange={e => updateSelectedElement('seats', parseInt(e.target.value))} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" /></div>
                                </>
                            )}
                            {'width' in selectedElement && <div><label className="text-gray-400 block">Ширина</label><input type="number" value={(selectedElement as any).width} onChange={e => updateSelectedElement('width', parseInt(e.target.value))} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" /></div>}
                            {'height' in selectedElement && <div><label className="text-gray-400 block">Высота</label><input type="number" value={(selectedElement as any).height} onChange={e => updateSelectedElement('height', parseInt(e.target.value))} className="w-full bg-brand-secondary p-1 rounded border border-gray-600" /></div>}
                        </div>
                        <button onClick={deleteSelectedElement} className="w-full bg-brand-red/20 text-brand-red border border-brand-red/50 py-2 rounded mt-4 text-xs font-bold uppercase">Удалить</button>
                    </div>
                )}
            </div>
            <style>{`
                .bg-grid { background-image: linear-gradient(to right, #d5b483 1px, transparent 1px), linear-gradient(to bottom, #d5b483 1px, transparent 1px); background-size: 40px 40px; }
            `}</style>
        </div>
    );
};

export default ConstructorView;