/**
 * チャットメッセージの型定義
 */
export interface ChatMessage {
  /** ユニークなメッセージID */
  id: string;
  /** メッセージ本文 */
  text: string;
  /** 送信者 ('user' または 'ai') */
  sender: 'user' | 'ai';
  /** 送信タイムスタンプ (ISO 8601形式) */
  timestamp: string;
}
