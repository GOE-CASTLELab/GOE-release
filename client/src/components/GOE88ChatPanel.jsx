// GOE Platform — © 2022–2026 Leah M Wilson
// Licensed under AGPL v3. See LICENSE in the repository root.
// Commercial licensing available — see COMMERCIAL.md

import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';

const formatConversationDate = (value, timeZone) => new Intl.DateTimeFormat([], {
  timeZone, month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date(value));

const formatMessageTime = (value, timeZone) => new Intl.DateTimeFormat([], {
  timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
}).format(new Date(value));

const CHAT_COMMANDS = [
  { command: '/history', description: 'View saved conversations from this card' },
  { command: '/reset', description: 'Archive this conversation and start a new one' },
];

const ChatMessages = ({ messages, timeZone }) => (
  <>
    {messages.map((msg, idx) => (
      <div key={msg.id || idx} className={`flex ${msg.messageType === 'user' ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-2xl px-3 py-2 rounded-lg ${
          msg.messageType === 'user'
            ? 'bg-gray-600 text-white rounded-br-sm'
            : msg.messageType === 'error'
            ? 'bg-red-100 text-red-800 border border-red-200 rounded-bl-sm'
            : 'bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-sm'
        }`}>
          <p className="text-sm leading-relaxed">{msg.content}</p>
          <p className="text-xs opacity-70 mt-1">
            {msg.timestamp ? formatMessageTime(msg.timestamp, timeZone) : ''}
          </p>
        </div>
      </div>
    ))}
  </>
);

const GOE88ChatPanel = ({ cardType = 'general', placeholder = 'Let’s talk it through…', gradient = null, onClose }) => {
  const { chatHistories, sendChatMessage } = useDashboard();
  const { user } = useAuth();
  const timeZone = user?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [chatInput, setChatInput] = useState('');
  const [chatProcessing, setChatProcessing] = useState(false);
  const [panelMode, setPanelMode] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [archivedMessages, setArchivedMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const inputRef = useRef(null);

  const chatMessages = chatHistories[cardType] || [];
  const savedConversations = conversations.filter((conversation) => conversation.messageCount > 0);
  const commandQuery = chatInput.trim().toLowerCase();
  const matchingCommands = commandQuery.startsWith('/') && !commandQuery.includes(' ')
    ? CHAT_COMMANDS.filter(({ command }) => command.startsWith(commandQuery))
    : [];
  const commandMenuOpen = panelMode === 'chat' && matchingCommands.length > 0;

  useEffect(() => {
    if (panelMode !== 'chat') return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [panelMode]);

  const showHistory = async () => {
    setHistoryLoading(true);
    setPanelMode('history');
    setChatInput('');
    try {
      const res = await apiRequest('GET', `/api/chat/${cardType}/conversations`);
      if (!res.ok) throw new Error('Failed to load conversations');
      setConversations(await res.json());
    } catch (error) {
      console.error('Error loading GOE88 conversation history:', error);
      setConversations([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const showArchivedConversation = async (conversation) => {
    setHistoryLoading(true);
    setSelectedConversation(conversation);
    setPanelMode('archive');
    try {
      const res = await apiRequest('GET', `/api/chat/${cardType}/conversations/${conversation.id}?limit=1000`);
      if (!res.ok) throw new Error('Failed to load conversation');
      setArchivedMessages(await res.json());
    } catch (error) {
      console.error('Error loading archived GOE88 conversation:', error);
      setArchivedMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const returnToCurrentConversation = () => {
    setPanelMode('chat');
    setSelectedConversation(null);
    setArchivedMessages([]);
  };

  const sendToAgent = async (data) => {
    if (typeof data !== 'string') return;
    if (data.trim().toLowerCase() === '/history') {
      await showHistory();
      return;
    }

    setChatProcessing(true);
    try {
      await sendChatMessage(cardType, data);
    } catch (error) {
      console.error('Error sending to GOE88 agent:', error);
    } finally {
      setChatProcessing(false);
      setChatInput('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const runCommand = (command) => {
    setChatInput('');
    setSelectedCommandIndex(0);
    sendToAgent(command);
  };

  const handleInputKeyDown = (event) => {
    if (commandMenuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedCommandIndex((current) => (current + 1) % matchingCommands.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedCommandIndex((current) => (current - 1 + matchingCommands.length) % matchingCommands.length);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runCommand(matchingCommands[selectedCommandIndex]?.command || matchingCommands[0].command);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setChatInput('');
        return;
      }
    }

    if (event.key === 'Enter' && !chatProcessing && chatInput.trim()) {
      sendToAgent(chatInput.trim());
    }
  };

  return (
    <div className="goe-glass relative rounded-xl p-4">
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600" aria-label="Close GOE88 chat">
          <X size={20} />
        </button>
      )}
      <div className="mb-3">
        <h4 className="font-light text-gray-700 text-base tracking-wide inline-flex items-center gap-1">Chat with GOE88</h4>
      </div>

      <div className="overflow-y-auto mb-3 space-y-3 h-[50vh] min-h-64 max-h-[36rem] border border-gray-100 rounded-xl p-4 bg-gray-50">
        {panelMode === 'chat' && (chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm flex items-center justify-center h-full">
            <p className="font-light">GOE88 reads and reflects across your cards. Your experience is the source; your instance holds the patterns.</p>
          </div>
        ) : <ChatMessages messages={chatMessages} timeZone={timeZone} />)}

        {panelMode === 'chat' && chatProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg rounded-bl-sm">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-xs text-gray-600">Guide is typing...</span>
              </div>
            </div>
          </div>
        )}

        {panelMode === 'history' && (
          <div className="space-y-3">
            <div className="pb-2">
              <h5 className="font-semibold text-gray-800">Conversation history</h5>
              <p className="text-sm text-gray-500">Saved conversations from this card</p>
            </div>
            {historyLoading ? (
              <p className="text-sm text-gray-500 text-center py-8">Loading conversations...</p>
            ) : savedConversations.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No saved conversations yet.</p>
            ) : savedConversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => showArchivedConversation(conversation)} className="w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-300">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-gray-800">{formatConversationDate(conversation.startedAt, timeZone)}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{conversation.messageCount} messages</span>
                </div>
                {conversation.preview && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{conversation.preview}</p>}
              </button>
            ))}
          </div>
        )}

        {panelMode === 'archive' && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-gray-200">
              <div>
                <h5 className="font-semibold text-gray-800">{selectedConversation ? formatConversationDate(selectedConversation.startedAt, timeZone) : 'Saved conversation'}</h5>
                <p className="text-sm text-gray-500">{cardType === 'cosmic' ? 'Astrology conversation' : 'GOE88 conversation'}</p>
              </div>
              {selectedConversation?.archivedAt && (
                <span className="rounded-full border border-gray-300 px-2 py-1 text-[11px] uppercase tracking-wide text-gray-500">Archived</span>
              )}
            </div>
            {historyLoading ? <p className="text-sm text-gray-500 text-center py-8">Loading conversation...</p> : <ChatMessages messages={archivedMessages} timeZone={timeZone} />}
          </div>
        )}
      </div>

      {panelMode === 'chat' ? (
        <>
          <div className="relative mb-2">
            {commandMenuOpen && (
              <div id="goe88-chat-commands" className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg" role="listbox" aria-label="Chat commands">
                {matchingCommands.map(({ command, description }, index) => (
                  <button
                    key={command}
                    type="button"
                    role="option"
                    aria-selected={index === selectedCommandIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runCommand(command)}
                    className={`block w-full px-4 py-3 text-left ${index === selectedCommandIndex ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <span className="block text-sm font-medium text-gray-800">{command}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-sm bg-white shadow-sm transition-all duration-200"
                value={chatInput}
                onChange={(event) => {
                  setChatInput(event.target.value);
                  setSelectedCommandIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                disabled={chatProcessing}
                aria-controls={commandMenuOpen ? 'goe88-chat-commands' : undefined}
                aria-expanded={commandMenuOpen}
              />
              <button
                onClick={() => commandMenuOpen ? runCommand(matchingCommands[selectedCommandIndex]?.command || matchingCommands[0].command) : chatInput.trim() && sendToAgent(chatInput.trim())}
                disabled={chatProcessing || !chatInput.trim()}
                className="btn-send"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500 text-center">
            {chatProcessing ? <span className="text-gray-600 font-light">Connecting to GOE88 agent...</span> : (
              <div className="font-normal text-xs leading-relaxed max-w-full">GOE reflects patterns, not prescriptions. Even mirrors can lie, darling. For creative entertainment only — not medical, financial, or professional advice.</div>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={returnToCurrentConversation}
          className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors bg-gradient-to-r ${gradient || 'from-purple-400 to-violet-600'} text-white hover:opacity-90`}
        >
          Return to the current conversation
        </button>
      )}
    </div>
  );
};

export default GOE88ChatPanel;
