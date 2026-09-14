import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Loader2, Languages } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth';
import { translateText } from '../services/multilingual';
import { useI18n } from '../i18n/I18nProvider';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type Message = { id: string; role: 'user' | 'model'; text: string; translatedText?: string };

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Hello! I am your AI Agronomist. How can I help you with your crops today?' }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore(state => state.token);
  const { language } = useI18n();

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const translateMessage = async (index: number) => {
    if (language === 'en') return;
    setBusy(true);
    try {
      const { translatedText } = await translateText(messages[index].text, 'en', language);
      setMessages(prev => {
        const next = [...prev];
        next[index] = { ...next[index], translatedText };
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setBusy(true);

    try {
      const history = messages.slice(1).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: userMessage.text, history })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Chat failed');
      
      const botMessage: Message = { id: Date.now().toString(), role: 'model', text: data.text };
      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: 'Sorry, I encountered an error: ' + err.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] max-w-4xl flex-col rounded-xl border border-subtle bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b border-subtle p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emeraldMain/10 text-emeraldMain">
          <Bot size={20} />
        </div>
        <div>
          <h2 className="font-semibold">AI Agronomist</h2>
          <p className="text-xs text-textSub">Always here to help</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-emeraldMain/10 text-emeraldMain'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-cardHover text-textMain'}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              {msg.translatedText && (
                <div className="mt-3 border-t border-subtle/50 pt-2 text-emeraldMain">
                  <p className="whitespace-pre-wrap leading-relaxed" lang={language}>{msg.translatedText}</p>
                </div>
              )}
              {msg.role === 'model' && language !== 'en' && !msg.translatedText && (
                <button type="button" onClick={() => translateMessage(i)} disabled={busy} className="mt-2 flex items-center text-xs font-medium text-emeraldMain hover:underline disabled:opacity-50">
                  <Languages size={12} className="mr-1" /> Translate
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="border-t border-subtle p-4">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder="Type your question..."
            className="h-12 w-full rounded-full border border-subtle bg-background pl-4 pr-12 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
