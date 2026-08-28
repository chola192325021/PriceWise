import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { LogOut, Edit2, ShoppingBag, Moon, Sun, Monitor, CheckCircle, RefreshCw, Camera } from 'lucide-react';

const ProfilePage: React.FC = () => {
  const { user, logout, updateProfile, theme, setTheme } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [editedEmail, setEditedEmail] = useState(user?.email || '');
  const [editedPhoto, setEditedPhoto] = useState(user?.profilePhoto || '');
  const [syncingAmazon, setSyncingAmazon] = useState(false);
  const [syncingFlipkart, setSyncingFlipkart] = useState(false);
  const [amazonSynced, setAmazonSynced] = useState(false);
  const [flipkartSynced, setFlipkartSynced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setEditedPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    await updateProfile(editedName, editedEmail, editedPhoto);
    setIsEditing(false);
  };

  const handleSync = async (provider: 'Amazon' | 'Flipkart') => {
    if (provider === 'Amazon') setSyncingAmazon(true);
    else setSyncingFlipkart(true);

    try {
      await apiClient.post('/sync-account', { userId: user.id, provider });
      if (provider === 'Amazon') setAmazonSynced(true);
      else setFlipkartSynced(true);
    } catch (err) {
      console.error(err);
    } finally {
      if (provider === 'Amazon') setSyncingAmazon(false);
      else setFlipkartSynced(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Your Profile</h1>
        <button
          onClick={logout}
          className="flex items-center text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 px-4 py-2 rounded-xl transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700/70 flex flex-col items-center text-center transition-colors">
            <div className="relative mb-4">
              {editedPhoto || user.profilePhoto || user.profilePhotoUrl || user.profile_photo ? (
                <img
                  src={editedPhoto || user.profilePhoto || user.profilePhotoUrl || user.profile_photo}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-blue-50 dark:border-slate-700"
                />
              ) : (
                <div className="w-24 h-24 bg-blue-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-3xl font-black">
                  {user.name.charAt(0)}
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => {
                  if (isEditing) {
                    fileInputRef.current?.click();
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="absolute bottom-0 right-0 bg-blue-600 dark:bg-blue-500 text-white p-2 rounded-full shadow-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                title={isEditing ? 'Upload Photo' : 'Edit Profile'}
              >
                {isEditing ? <Camera className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>

            {isEditing ? (
              <div className="w-full space-y-3 mt-4">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-none text-sm font-medium"
                  placeholder="Name"
                />
                <input
                  type="email"
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-none text-sm font-medium"
                  placeholder="Email"
                />
                <button
                  onClick={handleUpdateProfile}
                  className="w-full bg-blue-600 dark:bg-blue-500 text-white py-2 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm"
                >
                  Save Changes
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{user.email}</p>
                <div className="bg-slate-50 dark:bg-slate-700/60 px-4 py-1 rounded-full text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">
                  {user.memberSince || 'Member since 2024'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Settings & Linked Accounts */}
        <div className="md:col-span-2 space-y-8">
          {/* Linked Accounts */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Linked Accounts</h3>
            <div className="space-y-4">
              {[
                { name: 'Amazon', synced: amazonSynced, syncing: syncingAmazon },
                { name: 'Flipkart', synced: flipkartSynced, syncing: syncingFlipkart }
              ].map((account) => (
                <div
                  key={account.name}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/70 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center mr-4 text-xl font-black text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-700">
                      {account.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">{account.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {account.synced ? 'History synced' : 'Not connected'}
                      </div>
                    </div>
                  </div>
                  {account.synced ? (
                    <div className="flex items-center text-green-600 dark:text-green-400 font-bold text-sm">
                      <CheckCircle className="w-5 h-5 mr-1" />
                      Connected
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSync(account.name as 'Amazon' | 'Flipkart')}
                      disabled={account.syncing}
                      className="bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 px-6 py-2 rounded-xl font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50 text-sm border border-blue-200 dark:border-blue-900/60"
                    >
                      {account.syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Sync'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* App Settings */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">App Settings</h3>
            <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/70">
              <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center mr-4 text-slate-400 dark:text-slate-500">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">Price Alerts</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Push notifications enabled</div>
                  </div>
                </div>
                <div className="w-12 h-6 bg-blue-600 dark:bg-blue-500 rounded-full relative p-1 cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full absolute right-1"></div>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center mr-4 text-slate-400 dark:text-slate-500">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">Display Theme</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {theme === 'light' ? 'Light Mode' : theme === 'dark' ? 'Dark Mode' : 'Follow system settings'}
                    </div>
                  </div>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'light'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    title="Light Mode"
                  >
                    <Sun className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    title="Dark Mode"
                  >
                    <Moon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'system'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                    title="System Default"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
