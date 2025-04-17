# わいわいチャットらんど -AIもいるよ-

## 概要

「わいわいチャットらんど」は、AIキャラクターとユーザーがリアルタイムで会話できる楽しいコミュニケーションサービスです。  
Next.js + TypeScript + WebSocket + Tailwind CSSで構築され、AIキャラの個性を活かしたチャット体験を提供します。

---

## 特徴

- **AIキャラクター（一本道マリ）**  
  日本の深夜アニメ風キャラ設定で、親しみやすくも皮肉屋なAIと会話できます。
- **マルチキャラクター拡張設計**  
  キャラ追加・切り替え・スレッド風UIも容易に拡張可能。
- **リアルタイムWebSocketチャット**  
  ストリーミング応答でAIの返答が1文字ずつ流れるUX。
- **セキュアな設計**  
  .env.localやログなど秘匿ファイルは履歴から完全削除済み。

---

## ディレクトリ構成

```
waiwai-chat/
├── app/                # Next.jsフロントエンド
│   ├── src/
│   │   ├── app/        # ページ・グローバルCSS
│   │   ├── components/ # チャットUI
│   │   ├── types/      # 型定義
│   │   └── characters.ts # キャラクター設定
│   └── .env.local      # APIキー等（git管理外）
├── server/             # WebSocketサーバー (TypeScript)
│   ├── index.ts
│   └── package.json
├── docs/               # ドキュメント・タスク管理
├── logs/               # ログ（git管理外）
├── .gitignore
├── README.md
└── ...
```

---

## セットアップ

1. **依存インストール**
   ```sh
   pnpm install
   cd app && pnpm install
   cd ../server && pnpm install
   ```

2. **環境変数の設定**  
   `app/.env.local` に以下を記載（GROQのAPIキー・モデル名を取得して入力）
   ```
   GROQ_API_KEY="sk-xxxxxxx"
   GROQ_MODEL="llama3-8b-8192"
   ```

3. **開発サーバー起動**
   - WebSocketサーバー
     ```sh
     cd server
     pnpm dev
     ```
   - Next.jsフロントエンド
     ```sh
     cd app
     pnpm dev
     ```
   - ブラウザで [http://localhost:3000](http://localhost:3000) を開く

---

## 開発ヒント

- キャラクター追加・編集は `app/src/characters.ts` で一元管理
- .env.localやlogs/はgit履歴に残らない設計
- テスト・デプロイ・AIキャラ拡張も柔軟に対応可能

---

## ライセンス

MIT
