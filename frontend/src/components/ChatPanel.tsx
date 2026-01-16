import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Loader2, AlertCircle } from 'lucide-react';
import { chatAboutAnalysis, checkChatStatus } from '../utils/api';
import type { ComparisonNode, NetworkStats } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  analysisData: ComparisonNode[];
  stats: NetworkStats;
  groupNames: string[];
  groupKeys: string[];
}

export function ChatPanel({
  analysisData,
  stats,
  groupNames,
  groupKeys,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if chat service is available on mount
  useEffect(() => {
    checkChatStatus()
      .then((status) => setIsAvailable(status.available))
      .catch(() => setIsAvailable(false));
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    // Add user message to UI
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await chatAboutAnalysis(
        userMessage,
        analysisData,
        stats,
        groupNames,
        groupKeys,
        messages
      );

      if (response.success && response.response) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.response! },
        ]);
        setTokensUsed((prev) => prev + (response.tokens_used || 0));
      } else {
        setError(response.error || 'Failed to get response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setTokensUsed(0);
    setError(null);
  };

  // Suggested questions
  const suggestions = [
    'What are the main differences between the groups?',
    'Which words are most important in this analysis?',
    'What themes emerge from this data?',
    'Summarize the key findings.',
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-primary-500 text-white p-4 rounded-full shadow-lg hover:bg-primary-600 transition-colors z-50"
        title="Chat about this analysis"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary-500 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">Chat about Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          {tokensUsed > 0 && (
            <span className="text-xs bg-primary-600 px-2 py-1 rounded">
              {tokensUsed} tokens
            </span>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-primary-600 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isAvailable === false ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
            <p className="font-medium">Chat not available</p>
            <p className="text-sm mt-1">
              Set OPENAI_API_KEY in your .env file to enable chat.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500">
                <p className="text-sm mb-4">
                  Ask questions about your analysis data.
                </p>
                <div className="space-y-2">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className="block w-full text-left text-sm px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about the analysis..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear conversation
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
