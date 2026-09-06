'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Mic, User, Bot } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FluidButton } from '@/components/ui/FluidButton';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const quickPrompts = [
  "How's my savings rate this month?",
  "Can I afford a $500 purchase?",
  "What should I invest in?",
  "Am I on track for FIRE?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Good morning! I'm your AI Financial Coach. How can I help you today?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nextMessageId = useRef(1);
  const responseTimerRef = useRef<number | undefined>(undefined);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);
  useEffect(() => () => {
    if (responseTimerRef.current) window.clearTimeout(responseTimerRef.current);
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: String(++nextMessageId.current), role: 'user', content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate streaming response
    responseTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
      const response: Message = {
        id: String(++nextMessageId.current),
        role: 'assistant',
        content: "Based on your current financial data, you're doing well! Your savings rate is 42% this month, which is above your average. Your net worth has grown by 2.4% this week. Would you like me to dive deeper into any specific area?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, response]);
    }, 2000);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-4xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="font-serif text-3xl font-bold text-text-primary">AI Financial Coach</h1>
        <p className="text-sm text-text-secondary mt-1">Your personal finance advisor, available 24/7.</p>
      </div>

      <GlassCard className="flex-1 flex flex-col overflow-hidden mb-4 p-0!">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-emerald-500 to-indigo-500'
                    : 'bg-white/[0.06] border border-border-subtle'
                }`}>
                  {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-accent-emerald" />}
                </div>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-accent-emerald/10 border border-accent-emerald/20 text-text-primary'
                    : 'bg-white/[0.03] border border-border-subtle text-text-secondary'
                }`}>
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-emerald-500/60 text-right' : 'text-text-muted'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-border-subtle flex items-center justify-center">
                <Bot size={14} className="text-accent-emerald" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-border-subtle">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="px-4 pb-4">
            <p className="text-xs text-text-muted mb-2">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1.5 rounded-full text-xs bg-white/[0.04] border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 border-t border-border-subtle bg-white/[0.01]">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-white/[0.05] transition-colors"
            >
              <Mic size={18} />
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your coach anything..."
                className="w-full h-12 pl-4 pr-10 rounded-full bg-white/[0.03] border border-border-subtle text-text-primary text-sm outline-none focus:border-accent-emerald/30 focus:bg-white/[0.05] transition-all"
              />
              <Sparkles size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-accent-emerald/50" />
            </div>
            <FluidButton
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-12 h-12 rounded-full !p-0 flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              <Send size={18} className="translate-x-[1px]" />
            </FluidButton>
          </form>
        </div>
      </GlassCard>
    </div>
  );
}
