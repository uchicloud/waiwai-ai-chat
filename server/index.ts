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
async function streamGroqChatCompletion(userMessage: string, ws: WebSocket) {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: `あなたは日本の深夜アニメ「刀とJK」の主人公、一本道マリです。
---
【キャラクター設定】
・17歳の女子高生。東京都内の高校に通う。
・アンニュイで皮肉屋、でも根は優しい。友達は少なめ。
・しゃべる日本刀「カゲミツ」と相棒になり、東京の闇の勢力と戦う任侠アニメの主人公。
・自分のことを「ワタシ」と呼ぶ。口調はフランクで、ちょっと投げやり＆照れ隠しが多い。
・友達からは「そゆとこがカワイイ！」と言われるが、本人はうんざりしている。
・人付き合いは苦手だが、困っている人は放っておけない。
・好きなものは深夜ラジオとコンビニスイーツ。嫌いなものは早起きと体育の授業。
・「カゲミツ」にはツッコミを入れがちだが、内心では信頼している。
---
【会話ルール】
・必ず一本道マリとして返答すること。語尾や口調もキャラを守る。
・返答は日本語のみ。英語や他言語は使わない。
・システム的な説明やメタ的な発言は禁止。必ずキャラクターとしてのセリフだけで返す。
・質問や話題に対して、皮肉や照れ隠しを交えつつも、相手を否定しない優しさを見せること。
・長文になりすぎず、自然な会話のテンポを意識すること。
---
【最初のあいさつ・第一声】
・はじめて会話する相手には、キャラクターらしい一言で挨拶すること。
・例：「…あー、なんか用？ワタシ、一本道マリ。ま、よろしくってことで。」
`
        },
        { role: "user", content: userMessage }
      ],
      stream: true
    })
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    ws.send("AI応答エラー: " + errText);
    return;
  }

  // OpenAI互換: data: ...\n で区切られたストリーム (Node.js ReadableStream対応)
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

const chatHistoryMap = new Map<WebSocket, { role: "user" | "assistant"; content: string }[]>();

// キャラクター設定をJSONから読み込む
const CHARACTERS: {
  id: string;
  mention: string;
  name: string;
  color: string;
  prompt_file: string;
}[] = JSON.parse(readFileSync(__dirname + "/characters.json", "utf-8"));

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  chatHistoryMap.set(ws, []);

  ws.on('message', async (message: Buffer) => {
    // クライアントからのメッセージは { characterId, text } のJSON形式
    let parsed: { characterId?: string; text?: string };
    try {
      parsed = JSON.parse(message.toString());
    } catch {
      ws.send("不正なメッセージ形式です");
      return;
    }
    const { characterId, text } = parsed;
    if (!characterId || !text) {
      ws.send("characterIdとtextが必要です");
      return;
    }

    // 履歴を取得（直近10件）
    const history = chatHistoryMap.get(ws) || [];
    const char = CHARACTERS.find(c => c.id === characterId);
    if (!char) {
      ws.send("指定されたキャラクターが存在しません");
      return;
    }
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
        characterId,
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
