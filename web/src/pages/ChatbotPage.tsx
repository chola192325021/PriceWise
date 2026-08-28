import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  matchFaq,
  getAllCategories,
  getFaqsByCategory,
  getSuggestedQuestions,
  FaqMatchResult,
  RelatedAction
} from '../utils/faqEngine';
import {
  HelpCircle,
  Send,
  ArrowLeft,
  Trash2,
  User as UserIcon,
  ExternalLink,
  Search,
  Bell,
  LogIn,
  KeyRound,
  Bookmark,
  Mail
} from 'lucide-react';

interface ChatBubbleItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  matchResult?: FaqMatchResult;
}

const ChatbotPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatBubbleItem[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content:
        "Welcome to the PriceWise Help Center & FAQ Assistant! Select a topic or ask any question about price tracking, stores, alerts, or predictions."
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleUserQuery = (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const userMsg: ChatBubbleItem = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed
    };

    const match = matchFaq(trimmed);

    const assistantMsg: ChatBubbleItem = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      content: match.answer,
      matchResult: match
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputText('');
  };

  const handleActionClick = (action: RelatedAction) => {
    if (action.type === 'INTERNAL_ROUTE') {
      switch (action.route) {
        case 'LOGIN':
          navigate('/login');
          break;
        case 'FORGOT_PASSWORD':
          navigate('/forgot-password');
          break;
        case 'SEARCH':
          navigate('/');
          break;
        case 'WATCHLIST':
          navigate('/watchlist');
          break;
        case 'PRICE_ALERT_HELP':
        case 'NOTIFICATIONS_SETTINGS':
          navigate('/alerts');
          break;
        case 'SUPPORT':
          navigate('/profile');
          break;
        default:
          navigate('/');
          break;
      }
    }
  };

  const getActionIcon = (route: string) => {
    switch (route) {
      case 'LOGIN':
        return <LogIn className="w-3.5 h-3.5 mr-1" />;
      case 'FORGOT_PASSWORD':
        return <KeyRound className="w-3.5 h-3.5 mr-1" />;
      case 'SEARCH':
        return <Search className="w-3.5 h-3.5 mr-1" />;
      case 'WATCHLIST':
        return <Bookmark className="w-3.5 h-3.5 mr-1" />;
      case 'PRICE_ALERT_HELP':
      case 'NOTIFICATIONS_SETTINGS':
        return <Bell className="w-3.5 h-3.5 mr-1" />;
      case 'SUPPORT':
        return <Mail className="w-3.5 h-3.5 mr-1" />;
      default:
        return <ExternalLink className="w-3.5 h-3.5 mr-1" />;
    }
  };

  const categories = ['All', ...getAllCategories()];
  const suggestedQuestions = getSuggestedQuestions();

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content:
          "Chat cleared. Select a suggested topic below or ask any question about PriceWise features."
      }
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-10rem)] bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/70 overflow-hidden transition-colors">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 p-4 sm:p-6 text-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">PriceWise Help Center & FAQ</h1>
            <p className="text-xs text-blue-100">
              Deterministic Instant FAQ Knowledge Base • Offline Ready
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center text-xs font-medium text-blue-100 hover:text-white"
          title="Clear Conversation"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* FAQ Categories Filter */}
      <div className="p-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center space-x-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-2 uppercase tracking-wider">
          Topics:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${
                isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {isUser ? <UserIcon className="w-4 h-4" /> : <HelpCircle className="w-4 h-4" />}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 dark:bg-blue-500 text-white rounded-tr-none'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700/70 rounded-tl-none'
                }`}
              >
                <div>{msg.content}</div>

                {/* Related Actions */}
                {msg.matchResult?.relatedActions && msg.matchResult.relatedActions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap gap-2">
                    {msg.matchResult.relatedActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleActionClick(action)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors border border-blue-200 dark:border-blue-900/60"
                      >
                        {getActionIcon(action.route)}
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Category Question List or Suggested Prompts */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-700/70 flex items-center space-x-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">
          Suggested:
        </span>
        {(selectedCategory === 'All'
          ? suggestedQuestions
          : getFaqsByCategory(selectedCategory).map((f) => f.question)
        ).map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleUserQuery(q)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60 rounded-full text-xs font-medium whitespace-nowrap hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors flex-shrink-0"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700/70">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUserQuery(inputText);
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your question about price tracking, alerts, or stores..."
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatbotPage;
