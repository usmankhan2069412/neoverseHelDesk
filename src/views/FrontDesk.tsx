import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Send, ThumbsUp, ThumbsDown, Activity, Zap, Users, Bot, User, Paperclip, Smile, Sparkles, ClipboardCheck } from 'lucide-react';
import type { Message } from '@/types';
import { initialMessages, mockAIResponses } from '@/data/mockData';

const quickPrompts = ['Reset a locked account', 'Investigate API latency', 'Diagnose deployment failure'];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
      <span className="ml-1 text-xs text-muted-foreground">AI is thinking</span>
    </div>
  );
}

export default function FrontDesk() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasConversation = messages.length > 1;
  const showIntro = !hasConversation;

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = mockAIResponses[Math.floor(Math.random() * mockAIResponses.length)];

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: 'ai', text: response, timestamp: new Date() },
      ]);
      setIsTyping(false);
    }, 1200 + Math.random() * 700);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    setFeedbackMap((prev) => ({ ...prev, [msgId]: type }));
  };

  const usePrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mx-auto flex h-[calc(100vh-100px)] sm:h-[calc(100vh-112px)] w-full max-w-4xl flex-col overflow-hidden sm:rounded-[28px] sm:border border-border/60 bg-card sm:shadow-[0_16px_50px_-30px_rgba(0,0,0,0.35)]">
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          showIntro
            ? 'max-h-[360px] opacity-100 translate-y-0'
            : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="sm:border-b border-border/60 px-4 py-4 sm:px-7 sm:py-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
                <Sparkles size={12} className="text-primary" />
                Guided support
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1">
                  <Activity size={11} className="text-emerald-500" /> 34ms
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1">
                  <Zap size={11} className="text-primary" /> Neo-GPT-4o
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1">
                  <Users size={11} className="text-muted-foreground" /> 1.2k active
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Front Desk
              </h2>
              <p className="mt-1 sm:mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed sm:leading-6 text-muted-foreground">
                Tell us what happened. We will extract the key facts, suggest the safest next step, and keep you moving.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <ClipboardCheck size={14} className="text-primary" />
                Summaries focus on actions
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <Bot size={14} className="text-primary" />
                Clarifying questions only if needed
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <Users size={14} className="text-primary" />
                Ready to hand off to a human
              </div>
            </div>

            <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 no-scrollbar">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => usePrompt(prompt)}
                  className="rounded-full border border-border bg-background px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-3 sm:px-7 sm:py-5 overflow-hidden">

        <div ref={scrollRef} className="flex-1 space-y-4 sm:space-y-5 overflow-y-auto pr-1">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animation: 'fadeInUp 0.3s ease-out forwards', animationDelay: `${index * 25}ms` }}
            >
              <div className={`flex max-w-[92%] gap-2 sm:max-w-[72%] sm:gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-full border ${msg.sender === 'ai' ? 'border-border bg-background text-primary' : 'border-primary/20 bg-primary text-primary-foreground'}`}>
                  {msg.sender === 'ai' ? <Bot size={14} className="sm:w-[15px] sm:h-[15px]" /> : <User size={14} className="sm:w-[15px] sm:h-[15px]" />}
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5">
                  <div className={`rounded-[20px] px-3 py-2 sm:rounded-2xl sm:px-4 sm:py-3 text-[13px] sm:text-sm leading-relaxed sm:leading-6 ${msg.sender === 'ai' ? 'border border-border bg-background text-foreground' : 'bg-primary text-primary-foreground'}`}>
                    {msg.text}
                  </div>

                  <div className={`flex items-center gap-2 px-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                    {msg.sender === 'ai' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleFeedback(msg.id, 'up')}
                          className={`rounded-md p-1 transition ${feedbackMap[msg.id] === 'up' ? 'text-emerald-500' : 'text-muted-foreground hover:text-emerald-500'}`}
                          aria-label="Helpful"
                        >
                          <ThumbsUp size={12} />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, 'down')}
                          className={`rounded-md p-1 transition ${feedbackMap[msg.id] === 'down' ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
                          aria-label="Not helpful"
                        >
                          <ThumbsDown size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start" style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}>
              <div className="flex gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-primary">
                  <Bot size={15} />
                </div>
                <div className="rounded-2xl border border-border bg-background">
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sm:border-t border-border/60 px-3 py-3 sm:px-7 sm:py-4">
        <div className="flex items-end gap-1 sm:gap-2 rounded-[20px] sm:rounded-2xl border border-border bg-background p-1.5 sm:p-2 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
          <button className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full sm:rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Attach file">
            <Paperclip size={18} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the issue..."
            rows={1}
            className="min-h-[40px] max-h-[120px] flex-1 resize-none bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <button className="hidden h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground sm:flex" aria-label="Emoji">
            <Smile size={18} />
          </button>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full sm:rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send size={15} className="sm:w-4 sm:h-4" />
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-muted-foreground hidden sm:block">
          Press <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[9px]">Enter</kbd> to send,{' '}
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[9px]">Shift+Enter</kbd> for a new line
        </p>
        <p className="mt-2 text-center text-[10px] text-muted-foreground sm:hidden">
          AI can make mistakes. Please double-check responses.
        </p>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
