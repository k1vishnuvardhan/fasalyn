import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/auth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

type Message = { id: string; role: 'user' | 'model'; text: string };

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'model', text: 'Hello! I am your AI Agronomist. How can I help you with your crops today?' }
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore(state => state.token);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    <div className="app-page flex flex-col h-[calc(100vh-8rem)]">
      <header className="flex-shrink-0 mb-4">
        <p className="page-eyebrow">Ask Agronomist</p>
        <h1 className="page-title">AI Assistant</h1>
        <p className="page-subtitle">Chat with your personalized AI agronomist for expert advice.</p>
      </header>
      <div className="surface flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'model' ? 'bg-emeraldMain text-white' : 'bg-cardHover text-textSub'}`}>
                {msg.role === 'model' ? <Bot size={18} /> : <User size={18} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-sidebar text-[#fdfbf7] shadow-sm' : 'bg-cardHover text-textMain border border-subtle'}`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-emeraldMain text-white">
                <Bot size={18} />
              </div>
              <div className="bg-cardHover rounded-2xl px-5 py-3 border border-subtle flex items-center gap-2 text-textSub text-sm">
                <Loader2 size={16} className="animate-spin" /> Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-subtle bg-card">
          <form onSubmit={sendMessage} className="flex gap-3">
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Ask about pests, diseases, or weather..." 
              className="flex-1 bg-cardHover border border-subtle rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emeraldMain/50 text-textMain"
              disabled={busy}
            />
            <Button type="submit" disabled={!input.trim() || busy} className="px-6 rounded-xl">
              <Send size={18} className="mr-2"/> Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
