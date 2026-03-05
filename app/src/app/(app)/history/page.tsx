'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Session { session_id: string; latest_content: string; latest_time: string; message_count: number; }
interface Message { id: number; role: string; content: string; mode: string; created_at: string; }

export default function HistoryPage() {
    const router = useRouter();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/chat/history').then(r => r.json()).then(d => { setSessions(d.sessions || []); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const loadMessages = (sessionId: string) => {
        setSelected(sessionId);
        fetch(`/api/chat/messages?sessionId=${sessionId}`).then(r => r.json()).then(d => setMessages(d.messages || []));
    };

    const filtered = sessions.filter(s => !search || s.latest_content?.toLowerCase().includes(search.toLowerCase()));

    const groupByDate = (items: Session[]) => {
        const groups: Record<string, Session[]> = {};
        items.forEach(s => {
            const d = new Date(s.latest_time);
            const today = new Date();
            const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
            let label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            if (d.toDateString() === today.toDateString()) label = 'Today';
            else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
            if (!groups[label]) groups[label] = [];
            groups[label].push(s);
        });
        return groups;
    };

    const grouped = groupByDate(filtered);

    return (
        <div className="flex h-screen">
            {/* Sessions List */}
            <div className="w-72 lg:w-80 bg-white dark:bg-bg-dark border-r border-gray-200 dark:border-[#30363d] flex flex-col shrink-0">
                <div className="p-4 border-b border-gray-200 dark:border-[#30363d]">
                    <h2 className="text-gray-900 dark:text-white text-lg font-bold mb-4">Chat Archives</h2>
                    <div className="relative">
                        <span className="absolute left-3 top-2.5 material-symbols-outlined text-gray-400">search</span>
                        <input value={search} onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-100 dark:bg-surface-dark border-transparent rounded-lg text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-primary"
                            placeholder="Search conversations..." />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {loading ? <p className="text-gray-400 text-sm text-center py-4">Loading...</p> :
                        Object.entries(grouped).map(([label, items]) => (
                            <div key={label}>
                                <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h3>
                                <div className="space-y-1">
                                    {items.map(s => (
                                        <button key={s.session_id} onClick={() => loadMessages(s.session_id)}
                                            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg transition-all ${selected === s.session_id ? 'bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d]' : 'hover:bg-gray-50 dark:hover:bg-surface-dark'}`}>
                                            <div className={`shrink-0 mt-0.5 p-1.5 rounded-md ${selected === s.session_id ? 'text-primary bg-primary/10' : 'text-gray-400'}`}>
                                                <span className="material-symbols-outlined text-[18px]">chat</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <h4 className="text-gray-700 dark:text-gray-200 text-sm font-medium truncate">{s.latest_content?.substring(0, 30) || 'Chat'}</h4>
                                                    <span className="text-[10px] text-gray-400 shrink-0">{new Date(s.latest_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <p className="text-gray-400 text-xs truncate">{s.message_count} messages</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Chat Transcript */}
            <div className="flex-1 flex flex-col bg-bg-light dark:bg-bg-dark">
                {!selected ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <span className="material-symbols-outlined text-6xl mb-4">forum</span>
                            <p className="text-lg font-medium">Select a conversation</p>
                            <p className="text-sm mt-1">Choose from the left panel to view chat history</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <header className="h-16 border-b border-gray-200 dark:border-[#30363d] flex items-center justify-between px-6 bg-white/50 dark:bg-bg-dark/95 backdrop-blur sticky top-0 z-10">
                            <div>
                                <h1 className="text-gray-900 dark:text-white text-lg font-bold">Conversation</h1>
                                <p className="text-xs text-gray-400">{messages.length} Messages</p>
                            </div>
                            <button
                                onClick={() => router.push(`/chat?session_id=${selected}`)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-primary/20"
                            >
                                Continue Chat
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                            {messages.map(m => (
                                <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gradient-to-br from-primary to-purple-600'}`}>
                                        <span className="material-symbols-outlined text-lg text-white">{m.role === 'user' ? 'person' : 'smart_toy'}</span>
                                    </div>
                                    <div className={`flex flex-col max-w-2xl ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="text-xs font-medium text-gray-500">{m.role === 'user' ? 'You' : 'Wealth AI'}</span>
                                        </div>
                                        <div className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-primary text-white rounded-tr-sm' : 'bg-gray-100 dark:bg-surface-dark border border-gray-200 dark:border-[#30363d] text-gray-700 dark:text-gray-200 rounded-tl-sm'
                                            }`}>
                                            <p className="whitespace-pre-wrap">{m.content}</p>
                                        </div>
                                        {m.mode && <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${m.mode === 'chat' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                            {m.mode === 'chat' ? '💬 Conversational' : '🔇 Silent'}
                                        </span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
