import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types/message';
type ChatCharacter = {
  id: string;
  mention: string;
  name: string;
  color: string;
  prompt_file: string;
};

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [characters, setCharacters] = useState<ChatCharacter[]>([]);
  const [replyTo, setReplyTo] = useState<ChatCharacter | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // characters.jsonをfetchで取得
  useEffect(() => {
    fetch('/characters.json')
      .then(res => res.json())
      .then((data: ChatCharacter[]) => {
        setCharacters(data);
        setReplyTo(data[0]);
      });
  }, []);

  // AI応答インジケーター制御
  useEffect(() => {
    // AI応答中かどうか判定
    const lastMsg = messages[messages.length - 1];
    setAiResponding(
      !!lastMsg &&
      lastMsg.sender === "ai" &&
      lastMsg.text === ""
    );
  }, [messages]);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputText(value);

    // 「@」が直近で入力されたらサジェスト表示
    setShowSuggest(value.endsWith('@'));
  };

  const handleSendClick = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
      setShowSuggest(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggest && (event.key === 'Tab' || event.key === 'Enter')) {
      event.preventDefault();
      if (characters.length > 0) {
        setInputText((prev) => prev.replace(/@$/, characters[0].mention + ' '));
        setReplyTo(characters[0]);
      }
      setShowSuggest(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendClick();
    }
  };

  const handleSuggestClick = (char: ChatCharacter) => {
    setInputText((prev) => prev.replace(/@$/, char.mention + ' '));
    setReplyTo(char);
    setShowSuggest(false);
  };

  if (characters.length === 0) {
    return <div className="flex items-center justify-center h-screen">キャラクター情報を読み込み中...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Message Display Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <p className="text-center text-gray-500">メッセージはまだありません</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow transition-all duration-150 ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 hover:ring-2 hover:ring-blue-400'
                }`}
                // 吹き出しクリックで返信先キャラを選択
                onClick={() => {
                  if (msg.sender === "ai" && characters.length > 0) {
                    setReplyTo(characters[0]);
                    setInputText(characters[0].mention + " ");
                  }
                }}
                style={{ cursor: msg.sender === "ai" ? "pointer" : undefined }}
                title={msg.sender === "ai" ? "このキャラに返信" : undefined}
              >
                <p>{msg.text}</p>
                <span className="text-xs text-gray-400 block text-right mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        {/* AI応答インジケーター */}
        {aiResponding && (
          <div className="flex justify-start">
            <span className="text-xs text-blue-400 animate-pulse ml-2">AI応答中…</span>
          </div>
        )}
      </div>

      {/* Message Input Form */}
      <div className="p-4 border-t border-gray-300 bg-white flex items-center relative">
        {/* キャラ選択UI */}
        <div className="mr-2">
          <select
            value={replyTo?.id}
            onChange={e => {
              const char = characters.find(c => c.id === e.target.value);
              setReplyTo(char || characters[0]);
              setInputText(char ? char.mention + " " : "");
            }}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            style={{
              minWidth: 120,
              background: "linear-gradient(90deg, oklch(85% 0.2 250) 0%, oklch(95% 0.15 210) 100%)",
              color: "#222",
              boxShadow: "0 2px 8px 0 oklch(70% 0.1 250 / 0.15)",
              fontWeight: 600,
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
              border: "none",
              outline: "none",
              paddingRight: 24,
              backgroundClip: "padding-box"
            }}
          >
            {characters.map(char => (
              <option key={char.id} value={char.id} style={{
                background: "oklch(98% 0.05 250)",
                color: "#222"
              }}>
                {char.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder="メッセージを入力..."
          className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleSendClick}
          className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={!inputText.trim()}
        >
          送信
        </button>
        {showSuggest && (
          <div className="absolute left-0 bottom-12 bg-white border border-gray-300 rounded shadow-md z-10 min-w-[260px] max-w-xs">
            {characters.map((char) => (
              <div
                key={char.mention}
                className="px-4 py-2 hover:bg-blue-100 cursor-pointer flex items-center"
                onClick={() => handleSuggestClick(char)}
                data-testid={`suggest-item-${char.id}`}
              >
                <span className="font-bold text-blue-600">{char.mention}</span>
                <span className="ml-2 text-gray-700">{char.name}</span>
                <span className="ml-2 text-xs text-gray-400">AIキャラにメンション</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
