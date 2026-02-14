
import React, { useState, useRef, MouseEvent as ReactMouseEvent, useCallback, useEffect } from 'react';
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
    const [scale, setScale] = useState(1);
    const containerRef = React.useRef<HTMLDivElement>(null);

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

    React.useLayoutEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const containerWidth = entry.contentRect.width;
                const newScale = Math.min(1, containerWidth / 800);
                setScale(newScale);
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const selectedElement = elements.find(el => el.id === selectedElementId);

    const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>, id: string) => {
        e.preventDefault();
        const targetElement = e.currentTarget;
        const rect = targetElement.getBoundingClientRect();

        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;

        draggableRef.current = { id, offsetX, offsetY };
        setSelectedElementId(id);
    };

    const handleResizeStart = (e: ReactMouseEvent<HTMLDivElement>, id: string, direction: ResizableItem['direction']) => {
        e.preventDefault();
        e.stopPropagation();
        const element = elements.find(el => el.id === id);
        if (!element) return;

        resizableRef.current = {
            id,
            direction,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startWidth: element.width,
            startHeight: element.height,
            startX: element.x,
            startY: element.y
        };
    };

    const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
        if (resizableRef.current && canvasRef.current) {
            const { id, direction, startMouseX, startMouseY, startWidth, startHeight, startX, startY } = resizableRef.current;
            const deltaX = e.clientX - startMouseX;
            const deltaY = e.clientY - startMouseY;

            setElements(prev => prev.map(el => {
                if (el.id !== id) return el;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newX = startX;
                let newY = startY;

                if (direction.includes('e')) {
                    newWidth = Math.max(20, startWidth + deltaX);
                    newX = startX + (newWidth - startWidth) / 2;
                }
                if (direction.includes('w')) {
                    newWidth = Math.max(20, startWidth - deltaX);
                    newX = startX - (newWidth - startWidth) / 2;
                }
                if (direction.includes('s')) {
                    newHeight = Math.max(20, startHeight + deltaY);
                    newY = startY + (newHeight - startHeight) / 2;
                }
                if (direction.includes('n')) {
                    newHeight = Math.max(20, startHeight - deltaY);
                    newY = startY - (newHeight - startHeight) / 2;
                }

                // Maintain Aspect Ratio for Plants if needed, or just let them stretch
                // For now, free stretching is requested "stretching with mouse"

                return { ...el, width: newWidth, height: newHeight, x: newX, y: newY };
            }));
            return;
        }

        if (!draggableRef.current || !canvasRef.current) return;

        const { id, offsetX, offsetY } = draggableRef.current;
        const canvasRect = canvasRef.current.getBoundingClientRect();

        let newX = e.clientX - canvasRect.left;
        let newY = e.clientY - canvasRect.top;

        setElements(prev => prev.map(el => {
            if (el.id !== id) return el;
            const pivotX = el.width / 2;
            const pivotY = el.height / 2;
            return { ...el, x: newX - offsetX + pivotX, y: newY - offsetY + pivotY };
        }));
    }, []);

    const handleMouseUp = useCallback(() => {

        draggableRef.current = null;
        resizableRef.current = null;
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const addElement = (type: 'table-square' | 'table-circle' | 'wall' | 'bar' | 'plant' | 'window' | 'text' | 'arrow' | 'stairs') => {
        const newId = `el-${Date.now()}`;
        let newElement: LayoutElement;

        if (type === 'table-square' || type === 'table-circle') {
            const tableCount = elements.filter(e => e.type === 'table').length;
            newElement = {
                id: newId,
                type: 'table',
                x: 100, y: 100,
                width: 60, height: 60,
                seats: 4,
                shape: type === 'table-square' ? 'square' : 'circle',
                label: (tableCount + 1).toString(),
                floorId: activeFloorId
            } as TableElement;
        } else if (type === 'text') {
            newElement = {
                id: newId,
                type: 'text',
                x: 100, y: 100,
                width: 100, height: 40,
                label: 'Новый текст',
                fontSize: 16,
                floorId: activeFloorId
            } as TextElement;
        } else {
            const isVertical = type === 'wall' || type === 'window';
            newElement = {
                id: newId,
                type: type as any,
                x: 100, y: 100,
                width: isVertical ? 10 : (type === 'bar' ? 150 : (type === 'plant' ? 60 : (type === 'stairs' ? 80 : (type === 'arrow' ? 80 : 40)))),
                height: isVertical ? 100 : (type === 'bar' ? 50 : (type === 'plant' ? 60 : (type === 'stairs' ? 80 : (type === 'arrow' ? 40 : 40)))),
                floorId: activeFloorId
            } as DecoElement;
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

    if (!restaurant) {
        return <div className="text-center text-gray-400">Загрузка данных ресторана...</div>;
    }

    const currentFloorElements = elements.filter(el => el.floorId === activeFloorId);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8 p-4 md:p-0">
            <div className="lg:col-span-1 bg-brand-primary p-4 rounded-lg shadow-lg flex flex-col">
                <h3 className="font-bold text-xl mb-4">Инструменты</h3>
                <div className="grid grid-cols-2 gap-2 mb-6">
                    <button onClick={() => addElement('table-square')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Квадратный стол</button>
                    <button onClick={() => addElement('table-circle')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Круглый стол</button>
                    <button onClick={() => addElement('wall')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Стена</button>
                    <button onClick={() => addElement('window')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Окно</button>
                    <button onClick={() => addElement('bar')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Бар</button>
                    <button onClick={() => addElement('plant')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Растение</button>
                    <button onClick={() => addElement('text')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Текст</button>
                    <button onClick={() => addElement('arrow')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Стрелка</button>
                    <button onClick={() => addElement('stairs')} className="bg-brand-accent p-3 rounded text-sm transition-colors" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c27d3e'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Лестница</button>
                </div>

                <div className="flex-grow">
                    {selectedElement && (
                        <div className="border-t border-brand-accent pt-4 animate-fade-in">
                            <h4 className="font-bold text-lg mb-2">Свойства</h4>
                            <div className="space-y-3 text-sm">
                                {selectedElement.type === 'table' && (
                                    <>
                                        <div><label className="text-gray-400">Название</label><input type="text" value={(selectedElement as TableElement).label} onChange={e => updateSelectedElement('label', e.target.value)} className="w-full bg-brand-secondary p-2 rounded mt-1 border border-gray-600" /></div>
                                        <div><label className="text-gray-400">Мест</label><input type="number" value={(selectedElement as TableElement).seats} onChange={e => updateSelectedElement('seats', parseInt(e.target.value))} className="w-full bg-brand-secondary p-2 rounded mt-1 border border-gray-600" /></div>
                                    </>
                                )}
                                {'width' in selectedElement && <div><label className="text-gray-400">Ширина</label><input type="number" value={(selectedElement as DecoElement).width} onChange={e => updateSelectedElement('width', parseInt(e.target.value))} className="w-full bg-brand-secondary p-2 rounded mt-1 border border-gray-600" /></div>}
                                {'height' in selectedElement && <div><label className="text-gray-400">Высота</label><input type="number" value={(selectedElement as DecoElement).height} onChange={e => updateSelectedElement('height', parseInt(e.target.value))} className="w-full bg-brand-secondary p-2 rounded mt-1 border border-gray-600" /></div>}

                                <button onClick={deleteSelectedElement} className="w-full bg-brand-red/20 text-brand-red border border-brand-red/50 py-2 rounded-md hover:bg-brand-red hover:text-white transition-all mt-4 font-semibold uppercase text-xs tracking-wider">Удалить элемент</button>
                            </div>
                        </div>
                    )}
                    {selectedElement && selectedElement.type === 'text' && (
                        <div className="border-t border-brand-accent pt-4 mt-4 animate-fade-in">
                            <h4 className="font-bold text-lg mb-2">Свойства текста</h4>
                            <div className="space-y-3 text-sm">
                                <div><label className="text-gray-400">Содержимое</label><input type="text" value={(selectedElement as TextElement).label} onChange={e => updateSelectedElement('label', e.target.value)} className="w-full bg-brand-secondary p-2 rounded mt-1 border border-gray-600" /></div>
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={handleSaveLayout} className="w-full bg-brand-blue text-white font-bold py-3 mt-8 rounded-lg transition-colors shadow-lg" onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d5b483'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>Сохранить план</button>
            </div>

            <div className="lg:col-span-3">
                <div className="flex flex-col h-full">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                        <h2 className="text-xl md:text-2xl font-bold" style={{ color: '#2c1f14' }}>Конструктор {restaurant.name}</h2>
                        <div className="flex flex-wrap items-center gap-2 bg-brand-secondary p-1 rounded-md border border-brand-accent w-full md:w-auto overflow-x-auto">
                            {floors.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setActiveFloorId(f.id)}
                                    className={`px-3 md:px-4 py-1.5 rounded text-sm font-medium transition-all whitespace-nowrap ${activeFloorId === f.id ? 'bg-brand-blue text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {f.name}
                                </button>
                            ))}
                            <button onClick={addFloor} className="px-3 py-1.5 rounded text-sm font-medium text-brand-blue hover:bg-brand-blue/10 transition-colors shrink-0">+</button>
                        </div>
                    </div>

                    <div
                        ref={containerRef}
                        className="w-full bg-grid relative overflow-hidden border-2 border-brand-accent rounded-xl flex justify-center shadow-inner"
                        style={{ backgroundColor: '#f5efe6', height: `${600 * scale}px` }}
                    >
                        <div
                            className="absolute origin-top"
                            style={{
                                width: '800px',
                                height: '600px',
                                transform: `scale(${scale})`
                            }}
                        >
                            {currentFloorElements.map(el => {
                                const isSelected = el.id === selectedElementId;
                                const baseStyles = {
                                    left: `${el.x}px`, top: `${el.y}px`,
                                    width: `${el.width}px`, height: `${el.height}px`,
                                    zIndex: isSelected ? 10 : 1,
                                    outline: isSelected ? '2px solid #d5b483' : 'none',
                                    outlineOffset: '2px'
                                };

                                let content = null;
                                let classes = `absolute transform -translate-x-1/2 -translate-y-1/2 cursor-move shadow-sm group flex items-center justify-center pointer-events-auto`;

                                if (el.type === 'table') {
                                    const shapeClasses = el.shape === 'circle' ? 'rounded-full' : 'rounded-md';
                                    classes += ` font-bold text-white bg-gray-500 shadow-md ${shapeClasses}`;
                                    content = (el as TableElement).label;
                                } else if (el.type === 'text') {
                                    classes += ` bg-transparent border-dashed border border-gray-400 hover:border-solid`;
                                    content = <div style={{ fontSize: `${(el as TextElement).fontSize || 16}px`, color: '#2c1f14' }} className="text-center w-full h-full overflow-hidden leading-tight flex items-center justify-center p-1">{(el as TextElement).label}</div>;
                                } else if (el.type === 'arrow') {
                                    classes += ` text-[#2c1f14]`;
                                    content = (
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                                            <path d="M12 2L12 22M12 2L5 9M12 2L19 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    );
                                } else if (el.type === 'stairs') {
                                    classes += ` bg-gray-300`;
                                    content = (
                                        <div className="w-full h-full flex flex-col justify-evenly">
                                            {[...Array(5)].map((_, i) => <div key={i} className="w-full h-px bg-gray-500"></div>)}
                                        </div>
                                    );
                                } else if (el.type === 'plant') {
                                    classes += ` bg-transparent`;
                                    content = (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <div className="absolute w-2/3 h-2/3 bg-emerald-800 rounded-full"></div>
                                            <div className="absolute w-full h-full flex items-center justify-center">
                                                {/* Leaves */}
                                                <div className="w-full h-1/3 bg-green-500 absolute top-0 rounded-full opacity-75 transform rotate-45"></div>
                                                <div className="w-full h-1/3 bg-green-500 absolute top-0 rounded-full opacity-75 transform -rotate-45"></div>
                                                <div className="w-1/3 h-full bg-green-500 absolute left-0 rounded-full opacity-75 transform rotate-45"></div>
                                                <div className="w-1/3 h-full bg-green-500 absolute left-0 rounded-full opacity-75 transform -rotate-45"></div>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const decoStyles: { [key: string]: string } = {
                                        wall: 'bg-gray-600',
                                        bar: 'bg-yellow-800 border-b-4 border-yellow-900',
                                        window: 'bg-sky-200/40 border-2 border-sky-300'
                                    };
                                    classes += ` ${decoStyles[el.type] || 'bg-gray-400'}`;
                                    if (el.type === 'window') {
                                        content = <div className="w-full h-full flex items-center justify-center"><div className="w-0.5 h-full bg-sky-300/50"></div></div>;
                                    }
                                }

                                return (
                                    <div
                                        key={el.id}
                                        onMouseDown={(e) => handleMouseDown(e, el.id)}
                                        style={baseStyles}
                                        className={classes}
                                    >
                                        {content}

                                        {isSelected && (
                                            <>
                                                {/* Corners */}
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'nw')} className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full cursor-nw-resize z-20"></div>
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'ne')} className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full cursor-ne-resize z-20"></div>
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'sw')} className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full cursor-sw-resize z-20"></div>
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'se')} className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 rounded-full cursor-se-resize z-20"></div>

                                                {/* Edges */}
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'n')} className="absolute -top-1 left-1/2 -translate-x-1/2 w-full h-2 cursor-n-resize z-10"></div>
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 's')} className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-full h-2 cursor-s-resize z-10"></div>
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'w')} className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-full cursor-w-resize z-10"></div>
                                                <div onMouseDown={(e) => handleResizeStart(e, el.id, 'e')} className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-full cursor-e-resize z-10"></div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .bg-grid {
                    background-image: linear-gradient(to right, #d5b483 1px, transparent 1px), linear-gradient(to bottom, #d5b483 1px, transparent 1px);
                    background-size: 40px 40px;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default ConstructorView;
