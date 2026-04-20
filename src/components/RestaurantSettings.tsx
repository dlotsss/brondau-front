import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useTranslation } from '../context/I18nContext';
import { Restaurant } from '../types';

interface RestaurantSettingsProps {
    restaurant: Restaurant;
}

const RestaurantSettings: React.FC<RestaurantSettingsProps> = ({ restaurant }) => {
    const { t } = useTranslation();
    const { updateRestaurantSettings } = useData();
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        name: restaurant.name || '',
        logoUrl: restaurant.logoUrl || '',
        photoUrl: restaurant.photoUrl || '',
        address: restaurant.address || '',
        city: restaurant.city || '',
        bookingRestriction: restaurant.bookingRestriction || 120,
        ageRestriction: restaurant.age_restriction || '',
        ageRestrictionKz: restaurant.age_restriction_kz || '',
        deposit: restaurant.deposit || '',
        depositKz: restaurant.deposit_kz || ''
    });

    useEffect(() => {
        setForm({
            name: restaurant.name || '',
            logoUrl: restaurant.logoUrl || '',
            photoUrl: restaurant.photoUrl || '',
            address: restaurant.address || '',
            city: restaurant.city || '',
            bookingRestriction: restaurant.bookingRestriction || 120,
            ageRestriction: restaurant.age_restriction || '',
            ageRestrictionKz: restaurant.age_restriction_kz || '',
            deposit: restaurant.deposit || '',
            depositKz: restaurant.deposit_kz || ''
        });
    }, [restaurant]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSuccess(false);
        try {
            await updateRestaurantSettings(restaurant.id, form as any);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            alert(t('common.error'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-[#1a1c23] rounded-xl border border-brand-accent/30 p-6 shadow-xl animate-fadeIn">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {t('constructor.restaurantSettings.title')}
            </h2>

            <form onSubmit={handleSave} className="space-y-8">
                {/* General Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.nameLabel')}</label>
                            <input 
                                type="text" 
                                value={form.name} 
                                onChange={e => setForm({...form, name: e.target.value})}
                                className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.addressLabel')}</label>
                            <input 
                                type="text" 
                                value={form.address} 
                                onChange={e => setForm({...form, address: e.target.value})}
                                className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.cityLabel')}</label>
                            <input 
                                type="text" 
                                value={form.city} 
                                onChange={e => setForm({...form, city: e.target.value})}
                                className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-black/20 rounded-xl border border-gray-700/50 flex flex-col justify-center">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 text-center">Preview</p>
                        <div className="flex flex-col items-center gap-4">
                             {form.logoUrl && (
                                <div className="text-center">
                                    <p className="text-[10px] text-gray-400 mb-2">{t('constructor.restaurantSettings.previewLogo')}</p>
                                    <img src={form.logoUrl} alt="Logo" className="w-20 h-20 rounded-full object-contain border-2 border-brand-blue shadow-lg bg-white/5" />
                                </div>
                             )}
                             <h3 className="text-xl font-bold text-white">{form.name || 'Restaurant Name'}</h3>
                             <p className="text-sm text-gray-400">{form.city}{form.address ? `, ${form.address}` : ''}</p>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-700/50" />

                {/* Branding Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.logoLabel')}</label>
                        <input 
                            type="text" 
                            placeholder="https://example.com/logo.png"
                            value={form.logoUrl} 
                            onChange={e => setForm({...form, logoUrl: e.target.value})}
                            className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors mb-2"
                        />
                        <p className="text-[10px] text-gray-500">Square or circular image recommended</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.photoLabel')}</label>
                        <input 
                            type="text" 
                            placeholder="https://example.com/photo.jpg"
                            value={form.photoUrl} 
                            onChange={e => setForm({...form, photoUrl: e.target.value})}
                            className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors mb-2"
                        />
                        <p className="text-[10px] text-gray-500">Wide landscape image works best</p>
                    </div>
                </div>

                <hr className="border-gray-700/50" />

                {/* Restrictions Section */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                         <svg className="w-5 h-5 text-brand-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                         {t('constructor.restaurantSettings.restrictionsTitle')}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.ageLabelRu')}</label>
                                <textarea 
                                    value={form.ageRestriction} 
                                    onChange={e => setForm({...form, ageRestriction: e.target.value})}
                                    rows={2}
                                    className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.depositLabelRu')}</label>
                                <textarea 
                                    value={form.deposit} 
                                    onChange={e => setForm({...form, deposit: e.target.value})}
                                    rows={2}
                                    className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors resize-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.ageLabelKz')}</label>
                                <textarea 
                                    value={form.ageRestrictionKz} 
                                    onChange={e => setForm({...form, ageRestrictionKz: e.target.value})}
                                    rows={2}
                                    className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">{t('constructor.restaurantSettings.depositLabelKz')}</label>
                                <textarea 
                                    value={form.depositKz} 
                                    onChange={e => setForm({...form, depositKz: e.target.value})}
                                    rows={2}
                                    className="w-full bg-brand-primary border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-brand-blue outline-none transition-colors resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className={`px-8 py-3 rounded-lg font-bold text-white transition-all transform active:scale-95 flex items-center gap-2 ${success ? 'bg-brand-green shadow-green-500/20' : 'bg-brand-blue hover:bg-brand-blue/80 shadow-lg shadow-brand-blue/20'}`}
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                {t('common.saving')}
                            </>
                        ) : success ? (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                {t('constructor.restaurantSettings.saveSuccess')}
                            </>
                        ) : (
                            t('common.save')
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RestaurantSettings;
