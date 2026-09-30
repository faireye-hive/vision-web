import React, { useState, useEffect } from 'react';
import { Sun, Moon, Palette, X, Check, UploadCloud, User, Image, Globe, MapPin, FileText, Save } from 'lucide-react';
import { getInitialTheme, applyTheme, ThemeMode } from '../../../utils/theme';
import { PROFILE_THEMES, ProfileTheme } from '../themes';
import { ProfileCustomStyle } from '../profileStyleTypes';

export interface ProfileMetadataForm {
  name: string;
  about: string;
  profile_image: string;
  cover_image: string;
  website: string;
  location: string;
}

interface ProfileCustomizerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  style: ProfileCustomStyle;
  onChange: (updated: ProfileCustomStyle) => void;
  initialProfile?: Partial<ProfileMetadataForm>;
  onSaveToBlockchain: (profileData?: ProfileMetadataForm) => Promise<void>;
  onSaveLocalDraft?: (profileData?: ProfileMetadataForm) => void;
  isSaving: boolean;
  saveMessage: { type: 'success' | 'error'; text: string } | null;
}

export const ProfileCustomizerDrawer: React.FC<ProfileCustomizerDrawerProps> = ({
  isOpen,
  onClose,
  style,
  onChange,
  initialProfile,
  onSaveToBlockchain,
  onSaveLocalDraft,
  isSaving,
  saveMessage
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [activeTab, setActiveTab] = useState<'themes' | 'profile'>('themes');
  
  const [profileForm, setProfileForm] = useState<ProfileMetadataForm>({
    name: initialProfile?.name || '',
    about: initialProfile?.about || '',
    profile_image: initialProfile?.profile_image || '',
    cover_image: initialProfile?.cover_image || '',
    website: initialProfile?.website || '',
    location: initialProfile?.location || ''
  });

  useEffect(() => {
    if (initialProfile) {
      setProfileForm({
        name: initialProfile.name || '',
        about: initialProfile.about || '',
        profile_image: initialProfile.profile_image || '',
        cover_image: initialProfile.cover_image || '',
        website: initialProfile.website || '',
        location: initialProfile.location || ''
      });
    }
  }, [initialProfile]);

  const handleToggleTheme = () => {
    const next: ThemeMode = currentTheme === 'dark' ? 'light' : 'dark';
    setCurrentTheme(next);
    applyTheme(next);
  };

  if (!isOpen) return null;

  const applyThemeToProfile = (theme: ProfileTheme) => {
    const baseline = currentTheme === 'dark' ? theme.dark : theme.light;
    onChange({
      ...baseline,
      themeId: theme.id,
      backgroundColor: '',
      cardBackgroundColor: '',
      headerBackgroundColor: '',
      textColor: '',
      textSecondaryColor: '',
      backgroundUrl: ''
    });
  };

  const handleFormChange = (key: keyof ProfileMetadataForm, val: string) => {
    setProfileForm(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 h-full flex flex-col shadow-2xl text-gray-900 dark:text-slate-100 animate-in slide-in-from-right duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg rotate-3 group-hover:rotate-0 transition-transform duration-300"
              style={{ backgroundColor: style.accentColor || '#3b82f6' }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Profile Studio</h2>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Customize & Blockchain</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleTheme}
              className="p-2 rounded-2xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-2 text-xs font-black"
              title={`Switch to ${currentTheme === 'dark' ? 'Light' : 'Dark'} mode preview`}
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-blue-500" />
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-100 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('themes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              activeTab === 'themes'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Theme Selection</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
              activeTab === 'profile'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Hive Profile</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'themes' ? (
            <>
              <div className="space-y-1">
                <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  Choose Your Identity
                </h3>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  Select a theme. Your choice is instantly cached and can be broadcast to the Hive blockchain.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {PROFILE_THEMES.map((theme) => {
                  const isSelected = style.themeId === theme.id;
                  return (
                    <div
                      key={theme.id}
                      className={`group relative p-5 rounded-[24px] border-2 transition-all duration-300 cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-500/5 shadow-xl shadow-blue-500/10 scale-[1.01]'
                          : 'border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                      }`}
                      onClick={() => applyThemeToProfile(theme)}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 animate-in zoom-in duration-200">
                          <div className="bg-blue-500 text-white rounded-full p-1.5 shadow-lg shadow-blue-500/40">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-xl shrink-0"
                          style={{ 
                            backgroundColor: theme.previewColor,
                            boxShadow: `0 8px 20px -4px ${theme.previewColor}44`
                          }}
                        >
                          {theme.badge.split(' ')[0] || '✨'}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md">
                              {theme.badge.split(' ').slice(1).join(' ') || 'Theme'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1">
                            {theme.name}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                            {theme.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                  Edit On-Chain Profile
                </h3>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  Update your public Hive metadata (<code className="text-blue-500 font-bold">posting_json_metadata</code>). The selected theme ID will also be linked to your account.
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  <span>Display Name</span>
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g. Satoshi Nakamoto"
                  className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* About / Bio */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>About / Bio</span>
                </label>
                <textarea
                  rows={3}
                  value={profileForm.about}
                  onChange={(e) => handleFormChange('about', e.target.value)}
                  placeholder="Tell the Hive community about yourself..."
                  className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              {/* Profile Avatar Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-purple-500" />
                  <span>Profile Avatar URL</span>
                </label>
                <input
                  type="url"
                  value={profileForm.profile_image}
                  onChange={(e) => handleFormChange('profile_image', e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Cover Banner Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cover Banner URL</span>
                </label>
                <input
                  type="url"
                  value={profileForm.cover_image}
                  onChange={(e) => handleFormChange('cover_image', e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                  className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Website URL</span>
                </label>
                <input
                  type="url"
                  value={profileForm.website}
                  onChange={(e) => handleFormChange('website', e.target.value)}
                  placeholder="https://mywebsite.com"
                  className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Location</span>
                </label>
                <input
                  type="text"
                  value={profileForm.location}
                  onChange={(e) => handleFormChange('location', e.target.value)}
                  placeholder="e.g. New York, USA"
                  className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky bottom-0 space-y-3">
          <div className="flex items-center gap-3">
            {onSaveLocalDraft && (
              <button
                type="button"
                onClick={() => onSaveLocalDraft(profileForm)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Save to Cache</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onSaveToBlockchain(profileForm)}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3.5 rounded-2xl text-xs font-black shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-[2px] border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Broadcasting to Hive...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Publish to Hive</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center font-bold">
            Drafts stay in local cache immediately; publishing broadcasts on-chain via Hive Keychain.
          </p>
          
          {saveMessage && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold text-center animate-in slide-in-from-bottom-2 ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
              }`}
            >
              {saveMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
