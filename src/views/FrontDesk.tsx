import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Send, ThumbsUp, ThumbsDown, Activity, Zap, Bot, User, Paperclip, Smile, Sparkles, AlertCircle } from 'lucide-react';
import type { Message } from '@/types';
import { sendMessage, submitFeedback, type ChatResult } from '@/services/api';

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

// Extended message type to hold RAG metadata
interface ChatMessage extends Message {
  intent?: string;
  sources?: string[];
  docs_passed?: number;
  top_score?: number;
  apiMessageId?: string; // Supabase message UUID (for feedback)
}


// Speed: characters revealed per tick (ms)
const STREAM_TICK_MS = 18;
// Chars revealed per tick (speeds up for long messages)
const charsPerTick = (totalLen: number) => (totalLen > 500 ? 4 : totalLen > 200 ? 3 : 2);

export default function FrontDesk() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasConversation = messages.length > 0;
  const showIntro = !hasConversation;

  // Typewriter streaming state
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [displayedLen, setDisplayedLen] = useState(0);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, displayedLen, scrollToBottom]);

  // Typewriter effect: progressively reveal characters
  useEffect(() => {
    if (!streamingMsgId) return;

    const targetMsg = messages.find((m) => m.id === streamingMsgId);
    if (!targetMsg) { setStreamingMsgId(null); return; }

    const fullLen = targetMsg.text.length;
    const step = charsPerTick(fullLen);

    streamTimerRef.current = setInterval(() => {
      setDisplayedLen((prev) => {
        const next = prev + step;
        if (next >= fullLen) {
          // Done streaming
          if (streamTimerRef.current) clearInterval(streamTimerRef.current);
          setStreamingMsgId(null);
          return fullLen;
        }
        return next;
      });
    }, STREAM_TICK_MS);

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [streamingMsgId, messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setError(null);

    try {
      const result: ChatResult = await sendMessage(userText, sessionId);

      // Store session ID from first response
      if (!sessionId) {
        setSessionId(result.session_id);
      }

      const aiMsgId = (Date.now() + 1).toString();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: result.answer,
        timestamp: new Date(),
        intent: result.intent,
        sources: result.sources,
        docs_passed: result.docs_passed,
        top_score: result.top_score,
        apiMessageId: result.message_id,
      };

      setMessages((prev) => [...prev, aiMsg]);
      // Start typewriter streaming
      setDisplayedLen(0);
      setStreamingMsgId(aiMsgId);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to reach AI backend';
      setError(errMsg);

      // Show error as a system message
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: `⚠️ Sorry, I couldn't process your request. Please make sure the backend server is running on port 8000.\n\nError: ${errMsg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFeedback = async (msgId: string, type: 'up' | 'down') => {
    setFeedbackMap((prev) => ({ ...prev, [msgId]: type }));

    // Find the message to get its API ID
    const msg = messages.find((m) => m.id === msgId);
    if (msg?.apiMessageId) {
      try {
        await submitFeedback(msg.apiMessageId, type);
      } catch (err) {
        console.error('Feedback submission failed:', err);
      }
    }
  };

  const usePrompt = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mx-auto flex h-[calc(100vh-100px)] sm:h-[calc(100vh-112px)] w-full max-w-4xl flex-col overflow-hidden sm:rounded-[32px] glass-strong shadow-2xl">
      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          showIntro
            ? 'max-h-[360px] opacity-100 translate-y-0'
            : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="border-b border-border/30 px-6 py-6 sm:px-10 sm:py-8 backdrop-blur-md">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/50 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-foreground uppercase tracking-widest">
                <Sparkles size={12} className="text-foreground" />
                Neoverse
              </div>
              <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground uppercase tracking-widest">
                <span className="inline-flex items-center gap-1.5">
                  <Activity size={12} className="text-foreground" /> RAG Pipeline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap size={12} className="text-foreground" /> Core AI
                </span>
              </div>
            </div>

            <div className="text-center mt-2 sm:mt-4">
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tighter text-foreground">
                Neoverse Help Desk
              </h2>
              <p className="mt-3 mx-auto max-w-xl text-sm sm:text-base leading-relaxed text-muted-foreground">
                Tell me your Problem I will resolve them.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 overflow-x-auto pb-2 pt-4 justify-center no-scrollbar">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => usePrompt(prompt)}
                  className="rounded-full border border-foreground/10 bg-background/30 backdrop-blur-sm px-5 py-2.5 text-sm text-foreground transition-all hover:bg-foreground hover:text-background hover:scale-105"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-4 sm:px-8 sm:py-6 overflow-hidden bg-background/20">

        <div ref={scrollRef} className="flex-1 space-y-6 sm:space-y-8 overflow-y-auto pr-2">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{ animation: 'fadeInUp 0.4s ease-out forwards', animationDelay: `${index * 50}ms` }}
            >
              <div className={`flex max-w-[90%] gap-3 sm:max-w-[75%] sm:gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full shadow-sm ${msg.sender === 'ai' ? 'bg-background border border-foreground/10 text-foreground' : 'bg-foreground text-background'}`}>
                  {msg.sender === 'ai' ? <Bot size={18} /> : <User size={18} />}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className={`px-5 py-3.5 text-[14px] sm:text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.sender === 'ai' ? 'rounded-2xl rounded-tl-sm glass border-foreground/10 text-foreground' : 'rounded-2xl rounded-tr-sm bg-foreground text-background'}`}>
                    {msg.sender === 'ai' && streamingMsgId === msg.id
                      ? <>{msg.text.slice(0, displayedLen)}<span className="inline-block w-[2px] h-[1em] bg-foreground ml-0.5 animate-pulse align-text-bottom" /></>
                      : msg.text
                    }
                  </div>

                  {/* Metadata row — hidden while this message is still streaming */}
                  {streamingMsgId !== msg.id && (
                    <div className={`flex items-center gap-3 px-1 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                      style={{ animation: msg.sender === 'ai' ? 'fadeInUp 0.3s ease-out forwards' : undefined }}
                    >
                      <span className="text-[11px] text-muted-foreground font-medium tracking-wide">{formatTime(msg.timestamp)}</span>

                      {/* Show intent badge for AI messages */}
                      {msg.sender === 'ai' && msg.intent && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full bg-foreground/5 text-foreground border border-foreground/10">
                          {msg.intent}
                        </span>
                      )}

                      {/* Show sources count for AI messages */}
                      {msg.sender === 'ai' && msg.sources && msg.sources.length > 0 && (
                        <span className="text-[11px] text-muted-foreground font-medium" title={msg.sources.join(', ')}>
                          {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''}
                        </span>
                      )}

                      {msg.sender === 'ai' && msg.id !== 'welcome' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleFeedback(msg.id, 'up')}
                            className={`rounded-full p-1.5 transition-all ${feedbackMap[msg.id] === 'up' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}`}
                            aria-label="Helpful"
                          >
                            <ThumbsUp size={13} />
                          </button>
                          <button
                            onClick={() => handleFeedback(msg.id, 'down')}
                            className={`rounded-full p-1.5 transition-all ${feedbackMap[msg.id] === 'down' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}`}
                            aria-label="Not helpful"
                          >
                            <ThumbsDown size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start" style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border border-foreground/10 text-foreground shadow-sm">
                  <Bot size={18} />
                </div>
                <div className="rounded-2xl rounded-tl-sm glass border-foreground/10 shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/30 px-4 py-4 sm:px-8 sm:py-6 bg-background/40 backdrop-blur-xl">
        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-foreground/20 bg-background px-4 py-3 text-sm text-foreground shadow-sm">
            <AlertCircle size={16} />
            <span className="font-medium">Backend connection failed. Is the FastAPI server running?</span>
            <button onClick={() => setError(null)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">✕</button>
          </div>
        )}
        <div className="flex items-end gap-2 sm:gap-3 rounded-2xl sm:rounded-3xl border border-foreground/10 bg-background/50 backdrop-blur-md p-2 sm:p-2.5 shadow-sm focus-within:border-foreground/30 focus-within:ring-4 focus-within:ring-foreground/5 transition-all">
          <button className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground" aria-label="Attach file">
            <Paperclip size={20} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the issue..."
            rows={1}
            className="min-h-[44px] max-h-[140px] flex-1 resize-none bg-transparent py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          <button className="hidden h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground sm:flex" aria-label="Emoji">
            <Smile size={20} />
          </button>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-foreground text-background transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 shadow-md"
            aria-label="Send message"
          >
            <Send size={18} className="sm:w-5 sm:h-5 ml-1" />
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground tracking-wide uppercase hidden sm:block">
          Press <kbd className="rounded border border-foreground/20 bg-background/50 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd> to send,{' '}
          <kbd className="rounded border border-foreground/20 bg-background/50 px-1.5 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for a new line
        </p>
        <p className="mt-3 text-center text-[11px] text-muted-foreground tracking-wide uppercase sm:hidden">
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
