import React, { useState } from 'react';
import {
    CheckCircle2,
    ChevronRight,
    Utensils,
    Gift,
    Rocket,
    Diamond,
    Users,
    Copy,
    Check,
    Menu,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SPECIALTIES = [
    'SMM-специалист',
    'Маркетолог',
    'Таргетолог',
    'Консультант',
    'Управляющий',
    'Другое',
];

const ReferalLandingView: React.FC = () => {
    const navigate = useNavigate();

    // Form
    const [name, setName] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Success state
    const [promoCode, setPromoCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Mobile menu
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        setIsMenuOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await api.referalLeads.create({ name, specialty, email, phone });
            setPromoCode(res.promoCode);
        } catch (err: any) {
            alert(err.message || 'Ошибка. Попробуйте еще раз.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = () => {
        if (promoCode) {
            navigator.clipboard.writeText(promoCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-brand-secondary text-brand-primary font-sans selection:bg-brand-accent selection:text-brand-primary">

            {/* NAV */}
            <nav className="sticky top-0 z-50 bg-brand-secondary/90 backdrop-blur-md border-b border-brand-accent/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                            <Utensils className="h-8 w-8 text-brand-primary" />
                            <span className="text-2xl font-bold tracking-tight">Brondau</span>
                        </div>
                        <div className="hidden md:flex space-x-8">
                            <a href="#about-product" onClick={(e) => scrollToSection(e, 'about-product')} className="font-medium hover:text-brand-blue transition-colors cursor-pointer">О продукте</a>
                            <a href="#how" onClick={(e) => scrollToSection(e, 'how')} className="font-medium hover:text-brand-blue transition-colors cursor-pointer">План выплат</a>
                            <a href="#value" onClick={(e) => scrollToSection(e, 'value')} className="font-medium hover:text-brand-blue transition-colors cursor-pointer">Почему это работает</a>
                        </div>
                        <div className="hidden md:block">
                            <a href="#form" onClick={(e) => scrollToSection(e, 'form')} className="inline-flex items-center px-6 py-2.5 rounded-full text-sm font-medium text-brand-secondary bg-brand-primary hover:opacity-90 transition-opacity cursor-pointer">
                                Стать партнером
                            </a>
                        </div>
                        <div className="md:hidden">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="hover:text-brand-blue focus:outline-none">
                                {isMenuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
                            </button>
                        </div>
                    </div>
                </div>
                {isMenuOpen && (
                    <div className="md:hidden bg-brand-secondary border-b border-brand-accent/20 px-4 py-4 space-y-4 shadow-lg absolute w-full left-0 top-20">
                        <a href="#about-product" onClick={(e) => scrollToSection(e, 'about-product')} className="block font-medium text-lg hover:text-brand-blue">О продукте</a>
                        <a href="#how" onClick={(e) => scrollToSection(e, 'how')} className="block font-medium text-lg hover:text-brand-blue">План выплат</a>
                        <a href="#value" onClick={(e) => scrollToSection(e, 'value')} className="block font-medium text-lg hover:text-brand-blue">Почему это работает</a>
                        <a href="#form" onClick={(e) => scrollToSection(e, 'form')} className="block text-center mt-4 w-full px-6 py-3 rounded-full text-lg font-medium text-brand-secondary bg-brand-primary hover:opacity-90">Стать партнером</a>
                    </div>
                )}
            </nav>

            {/* 1. HERO */}
            <section className="pt-10 md:pt-20 pb-16 md:pb-24">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="max-w-4xl mx-auto">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-brand-accent/20 text-sm font-medium mb-8">
                            <Users className="w-4 h-4 mr-2 text-brand-blue" />
                            Реферальная программа Brondau
                        </div>
                        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
                            Зарабатывайте до <span className="text-brand-blue">25 000 ₸</span> с каждого знакомого ресторана или клуба
                        </h1>
                        <p className="text-lg md:text-2xl text-brand-primary/80 leading-relaxed mb-10 px-2">
                            Вы приводите заведение — мы платим вам за рекомендацию. Ресторан получает бонусы, вы — честные выплаты. Без лимитов на количество приглашений.
                        </p>
                        <a href="#form" onClick={(e) => scrollToSection(e, 'form')} className="inline-flex items-center px-8 py-4 text-base md:text-lg font-bold rounded-full shadow-lg text-white bg-brand-blue hover:bg-brand-blue/90 hover:scale-105 transform transition-all duration-200 cursor-pointer">
                            Стать партнером и получить промокод
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </a>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl mx-auto">
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-brand-accent/20">
                            <div className="text-3xl md:text-4xl font-extrabold text-brand-blue mb-1">До 25 000 ₸</div>
                            <div className="text-brand-primary/70">Выплата за 1 заведение</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-brand-accent/20">
                            <div className="text-3xl md:text-4xl font-extrabold text-brand-green mb-1">0 ₸</div>
                            <div className="text-brand-primary/70">Рисков для ресторана</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-brand-accent/20">
                            <div className="text-3xl md:text-4xl font-extrabold text-brand-accent mb-1">∞</div>
                            <div className="text-brand-primary/70">Нет лимита на приглашения</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 1.5. ABOUT PRODUCT */}
            <section id="about-product" className="py-16 md:py-24 bg-brand-secondary border-t border-brand-accent/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold text-brand-primary mb-6">
                            Что такое Brondau?
                        </h2>
                        <p className="text-xl text-brand-primary/80 leading-relaxed">
                            <strong>Brondau</strong> — это современная интерактивная система онлайн-бронирования столов и управления залом для ресторанов, баров и клубов. Мы заменяем бумажные блокноты и сложные, дорогие CRM-системы простым и красивым решением.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-brand-accent/10 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200">
                            <div>
                                <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center mb-6">
                                    <Utensils className="w-6 h-6 text-brand-blue" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">Интерактивный зал</h3>
                                <p className="text-brand-primary/70 text-sm leading-relaxed">
                                    Гости видят точную и красивую цифровую схему заведения и могут сами выбрать понравившийся свободный стол (у окна, на террасе, в VIP-зоне).
                                </p>
                            </div>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-brand-accent/10 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200">
                            <div>
                                <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-6 h-6 text-brand-green" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">Бронирование 24/7</h3>
                                <p className="text-brand-primary/70 text-sm leading-relaxed">
                                    Клиенты бронируют столы напрямую через виджет в Instagram, 2ГИС или на сайте. Система работает автоматически, исключая овербукинг и пропущенные звонки.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-brand-accent/10 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200">
                            <div>
                                <div className="w-12 h-12 bg-brand-accent/10 rounded-2xl flex items-center justify-center mb-6">
                                    <Gift className="w-6 h-6 text-brand-accent" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">WhatsApp рассылки</h3>
                                <p className="text-brand-primary/70 text-sm leading-relaxed">
                                    Гости мгновенно получают подтверждения бронирования, напоминания о визите и удобную ссылку для отмены прямо в WhatsApp.
                                </p>
                            </div>
                        </div>

                        {/* Feature 4 */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-brand-accent/10 flex flex-col justify-between hover:-translate-y-1 transition-transform duration-200">
                            <div>
                                <div className="w-12 h-12 bg-brand-blue/10 rounded-2xl flex items-center justify-center mb-6">
                                    <Users className="w-6 h-6 text-brand-blue" />
                                </div>
                                <h3 className="text-xl font-bold mb-3">CRM & Аналитика</h3>
                                <p className="text-brand-primary/70 text-sm leading-relaxed">
                                    Автоматический сбор базы гостей, история визитов, статистика заполняемости зала по часам и отчеты по эффективности работы персонала.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-16 bg-brand-primary text-brand-secondary rounded-3xl p-8 md:p-12 shadow-xl border border-brand-accent/20">
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                            <div>
                                <h3 className="text-2xl font-bold mb-4">Главное преимущество — внедрение «под ключ»</h3>
                                <p className="text-brand-secondary/80 leading-relaxed mb-6">
                                    Рестораторам не нужно ничего настраивать самостоятельно. Мы берём чертеж зала (даже нарисованный от руки на салфетке), оцифровываем его и выдаем готовую ссылку на виджет за 1 день.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-brand-green"></div>
                                        <span>Без сложного обучения персонала</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-brand-green"></div>
                                        <span>Работает на любом планшете, телефоне или ПК</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-brand-green"></div>
                                        <span>2 недели пробного периода + отрисовка карты бесплатно</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#FAF6F0] text-brand-primary rounded-2xl p-6 relative overflow-hidden border border-brand-accent/10">
                                <div className="font-bold text-lg mb-4 text-[#C27D3E]">Результат для заведения:</div>
                                <ul className="space-y-4 text-sm text-brand-primary/95">
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-brand-green font-bold">✓</span>
                                        <span>Хостес больше не тратит 80% времени на звонки</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-brand-green font-bold">✓</span>
                                        <span>Рост выручки за счет автономных ночных бронирований</span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <span className="text-brand-green font-bold">✓</span>
                                        <span>Снижение no-show (неприходов) благодаря автонапоминаниям</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. HOW IT WORKS & THE MATH */}
            <section id="how" className="py-16 md:py-24 border-t border-brand-accent/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-5xl font-bold text-center mb-4">
                        Прозрачная математика
                    </h2>
                    <p className="text-center text-xl text-brand-primary/70 mb-16 max-w-2xl mx-auto">
                        Сколько и за что вы получаете?
                    </p>

                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {/* Step 1 */}
                        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-brand-accent/20 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-14 h-14 bg-brand-blue/20 rounded-2xl flex items-center justify-center">
                                        <Rocket className="w-7 h-7 text-brand-blue" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-brand-blue font-bold uppercase tracking-wider">Шаг 1</div>
                                        <div className="text-xl font-bold">Быстрый старт</div>
                                    </div>
                                </div>
                                <div className="text-4xl md:text-5xl font-extrabold text-brand-blue mb-4">5 000 ₸</div>
                                <p className="text-brand-primary/80 leading-relaxed text-lg">
                                    Как только рекомендованный вами ресторан регистрируется по вашему промокоду, наши дизайнеры бесплатно настраивают им систему под ключ. Заведение проходит 2-недельный онбординг и активно работает в процессе него — вы сразу получаете <strong>5 000 ₸</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-brand-accent/20 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-14 h-14 bg-brand-accent/20 rounded-2xl flex items-center justify-center">
                                        <Diamond className="w-7 h-7 text-brand-accent" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-brand-accent font-bold uppercase tracking-wider">Шаг 2</div>
                                        <div className="text-xl font-bold">Стабильный бонус</div>
                                    </div>
                                </div>
                                <div className="text-4xl md:text-5xl font-extrabold text-brand-accent mb-4">20 000 ₸</div>
                                <p className="text-brand-primary/80 leading-relaxed text-lg">
                                    Если ресторан оценивает пользу Brondau и остается с нами работать дальше на 3 месяца (переходит на платную подписку) — мы выплачиваем вам еще <strong>20 000 ₸</strong> сверху.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. VALUE FOR RESTAURANT */}
            <section id="value" className="py-16 md:py-24 bg-brand-primary text-brand-secondary">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl md:text-5xl font-bold text-center mb-6">
                        Почему рестораны будут просить у&nbsp;вас&nbsp;промокод?
                    </h2>
                    <p className="text-center text-xl text-brand-secondary/80 mb-12 max-w-3xl mx-auto leading-relaxed">
                        Мы не предлагаем вам "впаривать" софт. Вы дарите выгоду. При использовании вашего промокода заведение получает:
                    </p>

                    <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
                        <div className="bg-brand-secondary/10 p-8 rounded-2xl border border-brand-accent/20">
                            <CheckCircle2 className="w-8 h-8 text-brand-green mb-4" />
                            <h3 className="text-xl font-bold mb-2">2 недели бесплатного пилота</h3>
                            <p className="text-brand-secondary/80">Полноценная отрисовка карты зала под ключ — стандартно для всех клиентов.</p>
                        </div>
                        <div className="bg-brand-secondary/10 p-8 rounded-2xl border border-brand-accent/20 relative">
                            <div className="absolute -top-3 -right-3 bg-brand-blue text-white text-xs font-bold px-3 py-1 rounded-full">БОНУС</div>
                            <Gift className="w-8 h-8 text-brand-accent mb-4" />
                            <h3 className="text-xl font-bold mb-2">+1 месяц бесплатно</h3>
                            <p className="text-brand-secondary/80">Дополнительный месяц бесплатного использования после окончания пилота. Только по промокоду.</p>
                        </div>
                    </div>

                    <div className="text-center">
                        <div className="inline-block bg-brand-accent/20 px-8 py-4 rounded-2xl border border-brand-accent/30">
                            <p className="text-xl md:text-2xl font-bold text-brand-accent">
                                Ресторану выгодно прийти именно от вас.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. FORM */}
            <section id="form" className="py-16 md:py-24">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="bg-brand-primary rounded-3xl md:rounded-[3rem] p-8 md:p-16 shadow-2xl border border-brand-accent relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-brand-accent/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-brand-blue/20 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            {promoCode ? (
                                /* SUCCESS STATE */
                                <div className="text-center text-brand-secondary">
                                    <div className="w-20 h-20 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="w-10 h-10 text-brand-green" />
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Поздравляем, вы в команде!</h2>
                                    <p className="text-lg text-brand-secondary/80 mb-8">Ваш персональный промокод:</p>

                                    <div className="bg-brand-secondary/10 border-2 border-brand-accent rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                                        <span className="text-3xl md:text-4xl font-extrabold tracking-widest text-brand-accent">{promoCode}</span>
                                        <button
                                            onClick={handleCopy}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors"
                                        >
                                            {copied ? <><Check className="w-5 h-5" /> Скопировано</> : <><Copy className="w-5 h-5" /> Скопировать</>}
                                        </button>
                                    </div>

                                    <p className="text-brand-secondary/70">
                                        Ваш промокод также отправлен на почту <strong className="text-brand-secondary">{email}</strong>. Проверьте папку Спам, если письмо не пришло в течение 2 минут.
                                    </p>
                                </div>
                            ) : (
                                /* FORM STATE */
                                <div className="text-brand-secondary">
                                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-center">Начните зарабатывать прямо сейчас</h2>
                                    <p className="text-center text-lg text-brand-secondary/80 mb-10">
                                        Заполните форму, чтобы сгенерировать ваш личный промокод. Мы отправим его вам на почту.
                                    </p>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        <div>
                                            <label htmlFor="ref-name" className="block text-sm font-medium mb-1">ФИО</label>
                                            <input
                                                type="text" id="ref-name" required
                                                value={name} onChange={(e) => setName(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-brand-secondary text-brand-primary focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                                placeholder="Иван Иванов"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="ref-specialty" className="block text-sm font-medium mb-1">Ваша специальность</label>
                                            <select
                                                id="ref-specialty" required
                                                value={specialty} onChange={(e) => setSpecialty(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-brand-secondary text-brand-primary focus:ring-2 focus:ring-brand-blue outline-none transition-all appearance-none"
                                            >
                                                <option value="" disabled>Выберите специальность</option>
                                                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="ref-email" className="block text-sm font-medium mb-1">Email</label>
                                            <input
                                                type="email" id="ref-email" required
                                                value={email} onChange={(e) => setEmail(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-brand-secondary text-brand-primary focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                                placeholder="name@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="ref-phone" className="block text-sm font-medium mb-1">Телефон / WhatsApp</label>
                                            <input
                                                type="tel" id="ref-phone" required
                                                value={phone} onChange={(e) => setPhone(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-brand-primary/20 bg-brand-secondary text-brand-primary focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                                                placeholder="+7 (707) 123-4567"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full mt-4 bg-brand-blue text-white font-bold text-lg uppercase tracking-wider py-4 rounded-xl shadow-[0_0_20px_rgba(194,125,62,0.4)] hover:shadow-[0_0_30px_rgba(194,125,62,0.6)] hover:bg-brand-blue/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? 'Генерируем промокод...' : 'Сгенерировать промокод'}
                                        </button>
                                    </form>
                                </div>
                            )}
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

export default ReferalLandingView;
