'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    id: number | string;
    role: 'user' | 'assistant';
    content: string;
}

export default function CoachPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/api/coach')
            .then(res => res.json())
            .then(data => {
                if (data.messages) {
                    setMessages(data.messages);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { id: Date.now(), role: 'user' as const, content: input.trim() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content }),
            });

            if (!res.ok) throw new Error('Failed to get response');
            
            const data = await res.json();
            if (data.response) {
                setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: data.response }]);
            }
        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: 'Sorry, I encountered an error. Please try again later.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[calc(100vh-80px)] lg:h-screen flex flex-col max-w-[1000px] mx-auto p-4 lg:p-8 pb-24 lg:pb-8 page-enter">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-white/5 shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                    <span className="material-symbols-outlined text-indigo-500 text-2xl">smart_toy</span>
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">AI Financial Coach</h1>
                    <p className="text-sm font-medium text-gray-500">Ask about your budget, get investment tips, or seek advice.</p>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                        <span className="material-symbols-outlined text-6xl mb-4 opacity-50">waving_hand</span>
                        <p className="text-lg font-medium text-gray-500 dark:text-gray-400 max-w-md">
                            Hi! I'm your AI financial coach. I know about your transactions and goals. Ask me anything!
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 mt-6">
                            {['How am I doing on my budget?', 'What are some ways I can save more?', 'Should I invest in index funds?'].map(q => (
                                <button key={q} onClick={() => setInput(q)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`max-w-[85%] lg:max-w-[75%] rounded-3xl p-5 ${msg.role === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white rounded-bl-sm shadow-sm'}`}>
                            {msg.role === 'assistant' ? (
                                <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-white/10 max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-sm font-medium">{msg.content}</p>
                            )}
                        </div>
                    </motion.div>
                ))}

                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 rounded-3xl rounded-bl-sm p-5 shadow-sm">
                            <div className="flex gap-1.5 items-center h-5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="shrink-0 pt-4 mt-2">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ask your coach anything..."
                        disabled={isLoading}
                        className="w-full bg-white dark:bg-[#161b22] border-2 border-gray-100 dark:border-white/10 rounded-2xl pl-6 pr-14 py-4 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-indigo-500 shadow-sm disabled:opacity-50 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 bottom-2 w-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-500"
                    >
                        <span className="material-symbols-outlined text-[20px]">send</span>
                    </button>
                </form>
                <p className="text-center text-[10px] text-gray-400 mt-3">
                    AI can make mistakes. Consider verifying important financial advice.
                </p>
            </div>
        </div>
    );
}
