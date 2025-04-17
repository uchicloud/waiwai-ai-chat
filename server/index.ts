import WebSocket, { WebSocketServer } from 'ws';
import * as dotenv from 'dotenv';
import * as path from 'path';
import fetch from 'node-fetch';
import { appendFile } from 'fs/promises';
import { readFileSync } from 'fs';

// .env.localをルートから読み込む
dotenv.config({ path: path.resolve(__dirname, '../app/.env.local') });

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 8080;
const HOST = process.env.WS_HOST || "0.0.0.0";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama3-8b-8192";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY is not set in .env.local");
}

const wss = new WebSocketServer({ port: PORT, host: HOST });

console.log(`WebSocket server started on ws://${HOST}:${PORT}`);

/**
 * OpenAI互換APIでAI応答をストリームで取得し、部分ごとにws.sendする
 */

const chatHistoryMap = new Map<WebSocket, { role: "user" | "assistant"; content: string }[]>();

// キャラクター設定をJSONから読み込む
const CHARACTERS: {
  id: string;
  mention: string;
  name: string;
  color: string;
  prompt_file: string;
}[] = JSON.parse(readFileSync(__dirname + "/characters.json", "utf-8"));

const mentionToChar = new Map<string, typeof CHARACTERS[0]>();
for (const char of CHARACTERS) {
  mentionToChar.set(char.mention, char);
}

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  chatHistoryMap.set(ws, []);

  ws.on('message', async (message: Buffer) => {
    // クライアントからのメッセージは { characterId, text } のJSON形式 or 旧来のtextのみ
    let parsed: { characterId?: string; text?: string } | null = null;
    let characterId: string | undefined;
    let text: string | undefined;

    try {
      parsed = JSON.parse(message.toString());
      characterId = parsed?.characterId;
      text = parsed?.text;
    } catch {
      // プレーンテキストの場合
      text = message.toString();
    }

    // characterIdがなければ@コマンドでキャラ特定
    let char = characterId ? CHARACTERS.find(c => c.id === characterId) : undefined;
    if (!char && text) {
      // 例: "@ai こんにちは"
      const mentionMatch = text.match(/^@(\w+)/);
      if (mentionMatch) {
        const mention = '@' + mentionMatch[1];
        char = mentionToChar.get(mention);
      }
    }
    if (!char || !text) {
      ws.send("characterIdまたは@コマンドでキャラクターを指定してください");
      return;
    }

    // 履歴を取得（直近10件）
    const history = chatHistoryMap.get(ws) || [];
    ws.send("AIに問い合わせ中...");

    // プロンプトファイルを都度読み込む
    let promptMd = "";
    try {
      promptMd = readFileSync(path.resolve(char.prompt_file), "utf-8");
    } catch (e) {
      ws.send("キャラクタープロンプトファイルの読み込みに失敗しました");
      return;
    }

    // OpenAI互換: messages = [system, ...history, user]
    const systemPrompt = { role: "system" as const, content: promptMd };
    const messages = [
      systemPrompt,
      ...history.slice(-10),
      { role: "user" as const, content: text }
    ];

    // ログファイルに問い合わせ内容をappend（ディレクトリなければ作成）
    const fs = await import("fs/promises");
    await fs.mkdir("logs", { recursive: true });
    await appendFile(
      "logs/groq_api.log",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        characterId: char.id,
        characterName: char.name,
        messages
      }) + "\n"
    );

    try {
      // ストリームAI応答
      let aiReply = "";
      await streamGroqChatCompletionWithMessages(messages, ws, (delta) => {
        aiReply += delta;
      });
      // 履歴にuser, assistantを追加
      chatHistoryMap.set(ws, [
        ...history,
        { role: "user", content: text },
        { role: "assistant", content: aiReply }
      ]);
    } catch (err: any) {
      console.error('AI応答エラー:', err);
      ws.send("AI応答エラー: " + (err?.message ?? String(err)));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    chatHistoryMap.delete(ws);
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });

  ws.send('Welcome to the WebSocket server!');
});

/**
 * OpenAI互換APIでAI応答をストリームで取得し、部分ごとにws.sendする（messages配列を渡す版）
 */
async function streamGroqChatCompletionWithMessages(
  messages: { role: string; content: string }[],
  ws: WebSocket,
  onDelta?: (delta: string) => void
) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    ws.send("AI応答エラー: " + errText);
    return;
  }

  const stream = res.body;
  let buffer = "";
  try {
    for await (const chunk of stream as any as AsyncIterable<Buffer>) {
      buffer += chunk.toString("utf-8");
      let eol;
      while ((eol = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 1);
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.replace(/^data:\s*/, "");
        if (jsonStr === "[DONE]") {
          ws.send("__AI_STREAM_END__");
          return;
        }
        try {
          const delta = JSON.parse(jsonStr);
          const content = delta.choices?.[0]?.delta?.content;
          if (content) {
            ws.send(content);
            if (onDelta) onDelta(content);
          }
        } catch (e) {
          // パース失敗は無視
        }
      }
    }
    ws.send("__AI_STREAM_END__");
  } catch (err: any) {
    ws.send("AI応答エラー: " + err.message);
  }
}

wss.on('error', (error: Error) => {
  console.error('WebSocket server error:', error);
});
