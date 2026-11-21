import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { type SharedIntelligenceProfile, defaultIntelligenceProfile } from '@shared/intelligenceProfile';

const isChatEnabled = import.meta.env.VITE_CHAT_ENABLED === 'true';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardContextType {
  chatHistories:          Record<string, any[]>;
  sendChatMessage:        (cardType: string, message: string, context?: any) => Promise<void>;
  updateChatHistory:      (cardType: string, messages: any[]) => void;
  intelligenceProfile:    SharedIntelligenceProfile;
  updateIntelligenceProfile: (
    section: keyof SharedIntelligenceProfile,
    data: Partial<SharedIntelligenceProfile[keyof SharedIntelligenceProfile]>
  ) => void;
  isLoading: boolean;
  error:     string | null;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};

// ─── Error helpers ────────────────────────────────────────────────────────────

function getErrorDetails(err: any) {
  if (err?.message?.includes('429') || err?.message?.includes('rate limit')) {
    return { title: 'Too many requests', description: 'Please wait a moment before sending another message.', shouldRetry: false };
  }
  if (err?.message?.includes('503') || err?.message?.includes('overloaded')) {
    return { title: 'Service busy', description: 'The AI service is temporarily busy. Retrying...', shouldRetry: true };
  }
  if (err?.message?.includes('401') || err?.message?.includes('403')) {
    return { title: 'Session expired', description: 'Please refresh the page to continue.', shouldRetry: false };
  }
  return { title: 'Message failed', description: 'Failed to send message. Please try again.', shouldRetry: false };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface DashboardProviderProps { children: ReactNode; }

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [chatHistories, setChatHistories]           = useState<Record<string, any[]>>({});
  const [intelligenceProfile, setIntelligenceProfile] = useState<SharedIntelligenceProfile>(defaultIntelligenceProfile);
  const [isLoading, setIsLoading]                   = useState(false);
  const [error, setError]                           = useState<string | null>(null);

  // Load chat histories on auth
  useEffect(() => {
    if (!isChatEnabled || !isAuthenticated || !user) return;
    setIsLoading(true);
    const cardTypes = ['menstrual', 'astrology', 'sleep', 'cosmic', 'rest', 'movement', 'general'];
    Promise.all(
      cardTypes.map(async (ct) => {
        try {
          const res = await apiRequest('GET', `/api/chat/${ct}`);
          if (res.ok) {
            const msgs = await res.json();
            return { ct, msgs: msgs || [] };
          }
        } catch {}
        return { ct, msgs: [] };
      })
    ).then((results) => {
      const histories: Record<string, any[]> = {};
      results.forEach(({ ct, msgs }) => { histories[ct] = msgs; });
      setChatHistories(histories);
    }).catch(() => setError('Failed to load chat history')).finally(() => setIsLoading(false));
  }, [isAuthenticated, user]);

  const updateChatHistory = (cardType: string, messages: any[]) => {
    setChatHistories((prev) => ({ ...prev, [cardType]: messages }));
  };

  const sendChatMessage = async (cardType: string, message: string, context?: any) => {
    if (!isChatEnabled || !isAuthenticated) return;
    const currentMessages = chatHistories[cardType] || [];

    if (message.trim().toLowerCase() === '/reset') {
      try {
        const res = await apiRequest('POST', `/api/chat/${cardType}/reset`);
        if (!res.ok) throw new Error('Failed to reset conversation');
        updateChatHistory(cardType, []);
      } catch {
        toast({ title: 'Reset failed', description: 'The conversation was not reset. Please try again.', variant: 'destructive' });
      }
      return;
    }

    const userMessage = { messageType: 'user', content: message, timestamp: new Date() };

    // Optimistic update
    updateChatHistory(cardType, [...currentMessages, userMessage]);

    const payload: any = { content: message, messageType: 'user' };
    if (context) {
      try { JSON.stringify(context); payload.context = context; } catch {}
    }

    try {
      const res = await apiRequest('POST', `/api/chat/${cardType}`, payload);
      if (!res.ok) throw new Error('Failed to send message');
      const { userMessage: saved, agentMessage } = await res.json();
      updateChatHistory(cardType, [...currentMessages, saved, agentMessage]);
    } catch (err) {
      // Rollback
      updateChatHistory(cardType, currentMessages);
      const { title, description, shouldRetry } = getErrorDetails(err);
      if (shouldRetry) {
        setTimeout(async () => {
          try {
            const retry = await apiRequest('POST', `/api/chat/${cardType}`, payload);
            if (retry.ok) {
              const { userMessage: saved, agentMessage } = await retry.json();
              updateChatHistory(cardType, [...currentMessages, saved, agentMessage]);
              toast({ title: 'Message sent', description: 'Your message was sent successfully after retry.' });
            }
          } catch {
            toast({ title: 'Message failed', description: 'Failed to send after retry. Please try again manually.', variant: 'destructive' });
          }
        }, 1500);
      } else {
        toast({ title, description, variant: 'destructive' });
      }
    }
  };

  const updateIntelligenceProfile = (
    section: keyof SharedIntelligenceProfile,
    data: Partial<SharedIntelligenceProfile[keyof SharedIntelligenceProfile]>
  ) => {
    setIntelligenceProfile((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }));
  };

  return (
    <DashboardContext.Provider value={{
      chatHistories,
      sendChatMessage,
      updateChatHistory,
      intelligenceProfile,
      updateIntelligenceProfile,
      isLoading,
      error,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};
