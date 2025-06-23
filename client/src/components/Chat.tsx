import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/game';
import { CardIcon, createCardFromCode } from './CardIcon';

interface ChatProps {
  messages: ChatMessage[];
  myPlayerId: string;
  onSendMessage: (message: string) => void;
  children?: React.ReactNode;
}

export const Chat: React.FC<ChatProps> = ({ messages, myPlayerId, onSendMessage, children }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSystemMessageClass = (messageType?: string) => {
    switch (messageType) {
      case 'success':
        return 'alert-success';
      case 'warning':
        return 'alert-warning';
      case 'error':
        return 'alert-error';
      default:
        return 'alert-info';
    }
  };

  return (
    <div className="flex flex-col h-full p-2">
      <h3 className="text-sm font-bold mb-2">Chat</h3>
      <div className="flex-1 overflow-y-auto mb-2 space-y-1 min-h-0 max-h-[calc(100vh-20rem)]">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.isSystem ? (
              <div className={`alert ${getSystemMessageClass(msg.messageType)} py-1 px-2`}>
                <span className="text-xs">{msg.message}</span>
              </div>
            ) : (
              <div className={`chat ${msg.playerId === myPlayerId ? 'chat-end' : 'chat-start'}`}>
                <div className="chat-header">
                  {msg.playerName}
                  <time className="text-xs opacity-50 ml-1">{formatTime(msg.timestamp)}</time>
                </div>
                <div className={`chat-bubble ${
                  msg.playerId === myPlayerId ? 'chat-bubble-primary' : ''
                }`}>
                  {msg.message.startsWith('(played)') ? (
                    <span className="text-sm flex items-center flex-wrap">
                      <span className="opacity-60 mr-2">played</span>
                      {msg.message.substring(9).split(' ').filter(code => code).map((cardCode, idx) => {
                        const card = createCardFromCode(cardCode);
                        return card ? (
                          <span key={idx} className="inline-block mr-1">
                            <CardIcon card={card} size="xs" />
                          </span>
                        ) : null;
                      })}
                    </span>
                  ) : msg.message.startsWith('(passed)') ? (
                    <span className="text-sm opacity-60">passed</span>
                  ) : (
                    msg.message
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="join w-full">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message..."
          maxLength={200}
          className="input input-bordered join-item flex-1"
        />
        <button type="submit" className="btn btn-primary join-item">
          Send
        </button>
      </form>

      { children  && 
        <div className="mt-2">
          {children}
        </div>
      }
    </div>
  );
};
