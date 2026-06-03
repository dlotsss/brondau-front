import React, { useState } from 'react';
import { 
    CheckCircle2, 
    PlayCircle, 
    Phone, 
    Clock, 
    ShieldCheck, 
    ChevronRight, 
    Utensils, 
    AlertCircle, 
    UserX 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const LandingView: React.FC = () => {
    const navigate = useNavigate();
    
    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [venue, setVenue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        setIsSubmitting(true);
        
        try {
            await api.leads.create({ name, phone, venue });
            alert('Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
            setName('');
            setPhone('');
            setVenue('');
        } catch (error: any) {
            alert(error.message || 'Произошла ошибка при отправке заявки. Попробуйте еще раз.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
        e.preventDefault();
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-brand-secondary text-brand-primary font-sans selection:bg-brand-accent selection:text-brand-primary">
            
            {/* 1. NAVIGATION BAR */}
            <nav className="sticky top-0 z-50 bg-brand-secondary/90 backdrop-blur-md border-b border-brand-accent/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                            <Utensils className="h-8 w-8 text-brand-primary" />
                            <span className="text-2xl font-bold text-brand-primary tracking-tight">Brondau</span>
                        </div>
                        <div className="hidden md:flex space-x-8">
                            <a href="#reviews" onClick={(e) => scrollToSection(e, 'reviews')} className="text-brand-primary font-medium hover:text-brand-blue transition-colors cursor-pointer">Отзывы</a>
                            <a href="#turnkey" onClick={(e) => scrollToSection(e, 'turnkey')} className="text-brand-primary font-medium hover:text-brand-blue transition-colors cursor-pointer">Внедрение под ключ</a>
                            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')} className="text-brand-primary font-medium hover:text-brand-blue transition-colors cursor-pointer">Как это работает</a>
                        </div>
                        <div>
                            <a href="#cta-form" onClick={(e) => scrollToSection(e, 'cta-form')} className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent rounded-full shadow-sm text-sm font-medium text-brand-secondary bg-brand-primary hover:opacity-90 transition-opacity cursor-pointer">
                                Попробовать бесплатно
                            </a>
                        </div>
                    </div>
                </div>
            </nav>

            {/* 2. HERO SECTION */}
            <section className="relative pt-16 pb-24 overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 className="text-4xl md:text-6xl font-extrabold text-brand-primary tracking-tight mb-6 leading-tight">
                            Превратите схему вашего зала в <span className="text-brand-blue relative inline-block">генератор броней<div className="absolute -bottom-2 left-0 w-full h-1 bg-brand-accent/50 rounded-full"></div></span>
                        </h1>
                        <p className="mt-4 text-xl md:text-2xl text-brand-primary/80 mb-10 leading-relaxed">
                            Автономная интерактивная карта для управления посадкой. Заменяет бумажные блокноты, избавляет хостес от ошибок и приносит брони 24/7. Полная настройка «под ключ» всего за 1 день — без отрыва от работы заведения.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
                            <a href="#cta-form" onClick={(e) => scrollToSection(e, 'cta-form')} className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-full shadow-lg text-white bg-brand-blue hover:bg-brand-blue/90 hover:scale-105 transform transition-all duration-200">
                                Получить настройку под ключ
                                <ChevronRight className="ml-2 -mr-1 h-5 w-5" />
                            </a>
                            <a href="#demo" onClick={(e) => scrollToSection(e, 'demo')} className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border-2 border-brand-primary text-lg font-bold rounded-full text-brand-primary hover:bg-brand-primary hover:text-brand-secondary transition-all duration-200">
                                <PlayCircle className="mr-2 h-5 w-5" />
                                Смотреть демо карты
                            </a>
                        </div>
                        
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-brand-accent/20 text-brand-primary text-sm font-medium">
                            <span className="flex h-2 w-2 relative mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-blue"></span>
                            </span>
                            Дарим 2 недели бесплатного пилотного периода. Оцифровка и отрисовка вашей карты — 0 тенге.
                        </div>
                    </div>

                    {/* Visual Component Mockup */}
                    <div id="demo" className="mt-16 max-w-5xl mx-auto">
                        <div className="bg-brand-primary rounded-[2rem] p-4 shadow-2xl border-4 border-brand-primary/10">
                            <div className="bg-brand-secondary rounded-xl overflow-hidden aspect-[16/9] relative border border-brand-primary/20 flex items-center justify-center p-8">
                                <div className="absolute top-4 left-4 right-4 flex justify-between items-center border-b border-brand-primary/10 pb-4">
                                    <div className="font-bold text-xl">План зала VIP</div>
                                    <div className="flex gap-4">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-green"></div><span className="text-sm">Свободен</span></div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-red"></div><span className="text-sm">Занят</span></div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-brand-blue animate-pulse"></div><span className="text-sm">Выбран гостем</span></div>
                                    </div>
                                </div>
                                {/* Map Grid Mockup */}
                                <div className="grid grid-cols-4 gap-8 mt-12 w-full max-w-3xl">
                                    <div className="bg-brand-green/20 border-2 border-brand-green rounded-full h-24 flex items-center justify-center text-brand-green font-bold text-xl shadow-[0_0_15px_rgba(72,187,120,0.3)]">T1</div>
                                    <div className="bg-brand-red/20 border-2 border-brand-red rounded-full h-24 flex items-center justify-center text-brand-red font-bold text-xl">T2</div>
                                    <div className="bg-brand-blue/20 border-2 border-brand-blue rounded-lg h-24 flex items-center justify-center text-brand-blue font-bold text-xl animate-pulse shadow-[0_0_20px_rgba(194,125,62,0.5)]">VIP-1</div>
                                    <div className="bg-brand-green/20 border-2 border-brand-green rounded-full h-24 flex items-center justify-center text-brand-green font-bold text-xl shadow-[0_0_15px_rgba(72,187,120,0.3)]">T4</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. SOCIAL PROOF / CASE STUDY */}
            <section id="reviews" className="py-24 bg-brand-primary text-brand-secondary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">Результаты, которым доверяют</h2>
                    
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <div className="bg-brand-secondary/10 p-8 rounded-2xl border border-brand-accent/20">
                                <div className="text-5xl font-extrabold text-brand-accent mb-2">0 часов</div>
                                <div className="text-xl">Вашего времени на настройку системы. Всё делаем сами.</div>
                            </div>
                            <div className="bg-brand-secondary/10 p-8 rounded-2xl border border-brand-accent/20">
                                <div className="text-5xl font-extrabold text-brand-accent mb-2">100%</div>
                                <div className="text-xl">Точность посадки в часы-пик (забудьте про двойные брони).</div>
                            </div>
                        </div>
                        
                        <div className="bg-brand-secondary text-brand-primary p-10 rounded-3xl shadow-xl relative">
                            <div className="absolute -top-6 -left-6 text-7xl text-brand-blue opacity-50 font-serif">"</div>
                            <p className="text-xl italic leading-relaxed mb-8 relative z-10 font-medium">
                                Мы внедрили Brondau в Алматы. Раньше хостес разрывалась между звонками и директом, путала столы в пятничной запаре. Теперь гости сами выбирают столы через виджет, а мы просто видим это на экране. Ребята сами под ключ нарисовали карту нашего зала за день!
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-brand-primary rounded-full flex items-center justify-center text-brand-secondary font-bold text-xl">
                                    У
                                </div>
                                <div>
                                    <div className="font-bold text-lg">Управляющий заведением</div>
                                    <div className="text-brand-primary/70">Алматы</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. TURNKEY SETUP SECTION */}
            <section id="turnkey" className="py-24 bg-brand-secondary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold text-brand-primary mb-6">Полное внедрение «под ключ». Вы отдыхаете — мы работаем</h2>
                        <p className="text-xl text-brand-primary/80">
                            Вам не нужно тратить время на заполнение таблиц или изучение инструкций. Мы берём всю техническую работу на себя.
                        </p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-brand-accent/20 hover:-translate-y-2 transition-transform duration-300">
                            <div className="w-16 h-16 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6">
                                <Phone className="w-8 h-8 text-brand-blue" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">1. Вы отправляете схему</h3>
                            <p className="text-brand-primary/80 leading-relaxed">
                                Подойдет фото плана эвакуации, чертеж от руки на салфетке или старый набросок. Просто скиньте фото в WhatsApp.
                            </p>
                        </div>
                        
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-brand-accent/20 hover:-translate-y-2 transition-transform duration-300 relative">
                            <div className="hidden md:block absolute top-1/2 -left-4 w-8 border-t-2 border-dashed border-brand-accent"></div>
                            <div className="w-16 h-16 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6">
                                <Utensils className="w-8 h-8 text-brand-blue" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">2. Мы рисуем интерактивную карту</h3>
                            <p className="text-brand-primary/80 leading-relaxed">
                                Наши дизайнеры воссоздают точную цифровую копию вашего зала: столы, диваны, VIP-комнаты, бары и террасы.
                            </p>
                        </div>
                        
                        <div className="bg-white p-8 rounded-3xl shadow-xl border border-brand-accent/20 hover:-translate-y-2 transition-transform duration-300 relative">
                            <div className="hidden md:block absolute top-1/2 -left-4 w-8 border-t-2 border-dashed border-brand-accent"></div>
                            <div className="w-16 h-16 bg-brand-accent/20 rounded-2xl flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-8 h-8 text-brand-green" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">3. Вы принимаете брони</h3>
                            <p className="text-brand-primary/80 leading-relaxed">
                                Мы присылаем готовую ссылку. Хостес открывает её на любом планшете или телефоне и мгновенно видит актуальную интерактивную схему.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. PAIN POINTS VS SOLUTION */}
            <section id="how-it-works" className="py-24 bg-brand-secondary border-t border-brand-accent/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-5xl font-bold text-center text-brand-primary mb-16 max-w-4xl mx-auto">
                        Почему бумажные блокноты теряют вашу выручку?
                    </h2>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-brand-primary/10">
                            <div className="p-6 bg-brand-primary text-brand-secondary border-b border-brand-primary/10">
                                <h3 className="text-xl font-bold flex items-center gap-2"><UserX className="text-brand-red" /> Потерянные гости</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <div className="text-sm text-brand-red font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><AlertCircle size={16}/> Было</div>
                                    <p className="text-brand-primary/80">Линия занята, в Instagram отвечают по 20 минут. Клиент ушел.</p>
                                </div>
                                <div className="h-px bg-brand-primary/10"></div>
                                <div>
                                    <div className="text-sm text-brand-green font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle2 size={16}/> Стало</div>
                                    <p className="text-brand-primary/90 font-medium">Ссылка в шапке профиля. Клик — выбор стола на схеме — бронь подтверждена за 30 секунд.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-brand-primary/10">
                            <div className="p-6 bg-brand-primary text-brand-secondary border-b border-brand-primary/10">
                                <h3 className="text-xl font-bold flex items-center gap-2"><AlertCircle className="text-brand-yellow" /> Человеческий фактор</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <div className="text-sm text-brand-red font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><AlertCircle size={16}/> Было</div>
                                    <p className="text-brand-primary/80">Ошибка в блокноте, две компании записаны на один VIP-стол в пятницу. Скандал.</p>
                                </div>
                                <div className="h-px bg-brand-primary/10"></div>
                                <div>
                                    <div className="text-sm text-brand-green font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle2 size={16}/> Стало</div>
                                    <p className="text-brand-primary/90 font-medium">Brondau автоматически блокирует занятый стол. Овербукинг невозможен физически.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl overflow-hidden shadow-lg border border-brand-primary/10">
                            <div className="p-6 bg-brand-primary text-brand-secondary border-b border-brand-primary/10">
                                <h3 className="text-xl font-bold flex items-center gap-2"><Clock className="text-brand-primary/50" /> Сложное ПО</h3>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <div className="text-sm text-brand-red font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><AlertCircle size={16}/> Было</div>
                                    <p className="text-brand-primary/80">Долгие настройки, покупка дорогого оборудования, обучение персонала.</p>
                                </div>
                                <div className="h-px bg-brand-primary/10"></div>
                                <div>
                                    <div className="text-sm text-brand-green font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><CheckCircle2 size={16}/> Стало</div>
                                    <p className="text-brand-primary/90 font-medium">Полностью автономная система. Работает в браузере на любом устройстве. Персонал понимает всё за 2 минуты.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. MAFIA OFFER & FORM CTA */}
            <section id="cta-form" className="py-24 bg-brand-secondary">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-brand-primary rounded-[3rem] p-8 md:p-16 shadow-2xl border border-brand-accent relative overflow-hidden">
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-brand-accent/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-brand-blue/20 rounded-full blur-3xl"></div>
                        
                        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                            <div className="text-brand-secondary">
                                <h2 className="text-3xl md:text-5xl font-bold mb-6">Начните тест-драйв Brondau бесплатно</h2>
                                <p className="text-lg md:text-xl text-brand-secondary/80 mb-8">
                                    Оцифруем ваше заведение под ключ за 0 тенге. Оцените, как система разгрузит персонал на ближайших выходных.
                                </p>
                                
                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-start gap-3 text-lg">
                                        <CheckCircle2 className="w-6 h-6 text-brand-green flex-shrink-0 mt-1" />
                                        <span>2 недели полноценного тестового периода — абсолютно бесплатно</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-lg">
                                        <CheckCircle2 className="w-6 h-6 text-brand-green flex-shrink-0 mt-1" />
                                        <span>Индивидуальная отрисовка карты зала в подарок</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-lg">
                                        <CheckCircle2 className="w-6 h-6 text-brand-green flex-shrink-0 mt-1" />
                                        <span>Никаких скрытых платежей или привязок карт</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div className="bg-brand-secondary p-8 rounded-3xl shadow-xl">
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-brand-primary mb-1">Ваше имя</label>
                                        <input 
                                            type="text" 
                                            id="name" 
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-white text-brand-primary focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all"
                                            placeholder="Иван Иванов"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="phone" className="block text-sm font-medium text-brand-primary mb-1">Телефон (WhatsApp)</label>
                                        <input 
                                            type="tel" 
                                            id="phone" 
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-white text-brand-primary focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all"
                                            placeholder="+7 (___) ___-__-__"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="venue" className="block text-sm font-medium text-brand-primary mb-1">Название заведения / Город</label>
                                        <input 
                                            type="text" 
                                            id="venue" 
                                            required
                                            value={venue}
                                            onChange={(e) => setVenue(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-white text-brand-primary focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-all"
                                            placeholder="Ресторан 'Счастье', Алматы"
                                        />
                                    </div>
                                    <button 
                                        type="submit" 
                                        className="w-full mt-4 bg-brand-blue text-white font-bold text-lg uppercase tracking-wider py-4 rounded-xl shadow-[0_0_20px_rgba(194,125,62,0.4)] hover:shadow-[0_0_30px_rgba(194,125,62,0.6)] hover:bg-brand-blue/90 transition-all duration-300 animate-pulse-soft"
                                    >
                                        Получить бесплатную карту зала и 2 недели теста
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Footer */}
            <footer className="bg-brand-primary text-brand-secondary/60 py-8 border-t border-brand-accent/10">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p>© {new Date().getFullYear()} Brondau. Все права защищены.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingView;
