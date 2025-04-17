import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatWindow from './ChatWindow';
import charactersJson from '../../../server/characters.json';

describe('ChatWindow', () => {
  it('renders empty state', () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    expect(screen.getByText('メッセージはまだありません')).toBeInTheDocument();
  });

  it('renders user and ai messages', () => {
    render(
      <ChatWindow
        messages={[
          {
            id: '1',
            text: 'こんにちは',
            sender: 'user',
            timestamp: new Date().toISOString()
          },
          {
            id: '2',
            text: 'やあ、どうしたの？',
            sender: 'ai',
            timestamp: new Date().toISOString()
          }
        ]}
        onSendMessage={() => {}}
      />
    );
    expect(screen.getByText('こんにちは')).toBeInTheDocument();
    expect(screen.getByText('やあ、どうしたの？')).toBeInTheDocument();
  });

  it('サジェストにキャラクター名が表示される', () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    // inputに@を入力
    const input = screen.getByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    input.focus();
    input.value = '@';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // サジェストにcharacters.jsonのキャラ名が出る
    for (const char of charactersJson) {
      expect(screen.getByText(char.name)).toBeInTheDocument();
    }
  });

  it('メッセージ送信でonSendMessageが呼ばれる', () => {
    const onSend = jest.fn();
    render(<ChatWindow messages={[]} onSendMessage={onSend} />);
    const input = screen.getByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'テスト送信' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('テスト送信');
  });

  it('サジェスト選択でinputにmentionが入る', () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    const input = screen.getByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '@' } });
    const suggests = screen.getAllByText(charactersJson[0].name);
    // 2つ目がサジェスト側
    fireEvent.click(suggests[1]);
    expect(input.value).toContain(charactersJson[0].mention);
  });

  it('キャラ選択UIでinputにmentionが入る', () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: charactersJson[0].id } });
    const input = screen.getByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    expect(input.value).toContain(charactersJson[0].mention);
  });

  it('吹き出しクリックで返信先キャラが切り替わる', () => {
    render(
      <ChatWindow
        messages={[
          {
            id: '2',
            text: 'やあ、どうしたの？',
            sender: 'ai',
            timestamp: new Date().toISOString()
          }
        ]}
        onSendMessage={() => {}}
      />
    );
    const bubble = screen.getByText('やあ、どうしたの？').closest('div');
    if (bubble) {
      fireEvent.click(bubble);
      const input = screen.getByPlaceholderText('メッセージを入力...') as HTMLInputElement;
      expect(input.value).toContain(charactersJson[0].mention);
    }
  });
});

describe('characters.json', () => {
  it('全キャラにid, mention, name, prompt_fileが存在する', () => {
    for (const char of charactersJson) {
      expect(char.id).toBeTruthy();
      expect(char.mention).toBeTruthy();
      expect(char.name).toBeTruthy();
      expect(char.prompt_file).toBeTruthy();
    }
  });
});
