import React, { useEffect, useState, useRef } from 'react';
import { Bell, TrendingDown, ExternalLink, CheckCheck, Clock, X, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { AppNotification, NotificationsResponse } from '../types';
import { useAuth } from '../context/AuthContext';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, onUnreadCountChange }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiClient.get<NotificationsResponse>(`/user/notifications?userId=${user.id}`);
      if (res.data.status === 'success' && Array.isArray(res.data.data)) {
        setNotifications(res.data.data);
        const unread = res.data.data.filter(n => !n.isRead).length;
        if (onUnreadCountChange) onUnreadCountChange(unread);
      }
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Poll every 30 seconds for real-time notifications
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await apiClient.post('/user/notifications/mark-read', { userId: user.id });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (e) {
      console.error('Failed to mark notifications read:', e);
    }
  };

  const handleMarkOneRead = async (notificationId: string) => {
    if (!user) return;
    try {
      await apiClient.post('/user/notifications/mark-read', { userId: user.id, notificationId });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
      const remainingUnread = notifications.filter(n => n.id !== notificationId && !n.isRead).length;
      if (onUnreadCountChange) onUnreadCountChange(remainingUnread);
    } catch (e) {
      console.error('Failed to mark notification read:', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {loading && notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
              <Bell className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">No price drop notifications yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Set target price alerts on products to get notified when prices reach your target.
            </p>
          </div>
        ) : (
          notifications.map(item => (
            <div
              key={item.id}
              onClick={() => !item.isRead && handleMarkOneRead(item.id)}
              className={`p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start space-x-3 ${
                !item.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  {item.isMock || item.type === 'mock_price_drop' ? (
                    <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded flex items-center">
                      MOCK / DEMO ALERT
                    </span>
                  ) : (
                    <span className="text-xs font-black uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center">
                      Target Reached
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1 leading-snug">
                  {item.message}
                </p>

                <div className="flex items-center space-x-3 mt-2.5">
                  <Link
                    to={item.isMock ? "/alerts" : `/product/${item.productId}`}
                    onClick={onClose}
                    className="inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1" /> {item.isMock ? "View Alert" : "View Product"}
                  </Link>

                  {!item.isMock && item.productUrl && (
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> {item.platformName || 'Store Link'}
                    </a>
                  )}
                </div>
              </div>
              {!item.isRead && (
                <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 text-center">
          <Link
            to="/alerts"
            onClick={onClose}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Manage all Price Alerts &rarr;
          </Link>
        </div>
      )}
    </div>
  );
};
