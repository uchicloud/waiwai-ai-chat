"use client";

import React, { useEffect, useRef, useState } from "react";
import ChatWindow from "../components/ChatWindow";
import { ChatMessage } from "../types/message";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket接続
  useEffect(() => {
    const ws = new window.WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      // サーバー接続時の初期メッセージ
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          text: "WebSocketサーバーに接続しました",
          sender: "ai",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // ストリームAI応答対応
    let aiStreamId: string | null = null;
    ws.onmessage = (event) => {
      const data = event.data as string;
      // ストリームAI応答開始
      if (data === "AIに問い合わせ中...") {
        aiStreamId = crypto.randomUUID();
        setMessages((msgs) => [
          ...msgs,
          {
            id: aiStreamId!,
            text: "",
            sender: "ai",
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }
      // ストリームAI応答終了
      if (data === "__AI_STREAM_END__") {
        aiStreamId = null;
        return;
      }
      // ストリームAI応答中
      if (aiStreamId) {
        setMessages((msgs) =>
          msgs.map((msg) =>
            msg.id === aiStreamId
              ? { ...msg, text: msg.text + data }
              : msg
          )
        );
        return;
      }
      // 通常メッセージ
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          text: data,
          sender: "ai",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    ws.onclose = () => {
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          text: "サーバーとの接続が切断されました",
          sender: "ai",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    ws.onerror = (err) => {
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          text: "WebSocketエラーが発生しました",
          sender: "ai",
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    return () => {
      ws.close();
    };
  }, []);

  // メッセージ送信
  const handleSendMessage = (text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(text);
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          text,
          sender: "user",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-xl shadow-lg rounded-lg bg-white">
        <ChatWindow messages={messages} onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
}
