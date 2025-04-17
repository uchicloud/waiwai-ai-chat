import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatWindow from './ChatWindow';
import charactersJson from '../../characters.json';

beforeEach(() => {
  // fetchをモック
  global.fetch = jest.fn().mockImplementation((url) =>
    Promise.resolve({
      json: () => Promise.resolve(charactersJson)
    })
  ) as any;
});

describe('ChatWindow', () => {
  it('renders empty state', async () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    await waitFor(() => expect(screen.getByText('メッセージはまだありません')).toBeInTheDocument());
  });

  it('renders user and ai messages', async () => {
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
    await waitFor(() => expect(screen.getByText('こんにちは')).toBeInTheDocument());
    expect(screen.getByText('やあ、どうしたの？')).toBeInTheDocument();
  });

  it('サジェストにキャラクター名が表示される', async () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    const input = await screen.findByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: '@' } });
    // サジェストにcharacters.jsonのキャラ名が出る
    for (const char of charactersJson) {
      await waitFor(() => expect(screen.getByTestId(`suggest-item-${char.id}`)).toBeInTheDocument());
    }
  });

  it('メッセージ送信でonSendMessageが呼ばれる', async () => {
    const onSend = jest.fn();
    render(<ChatWindow messages={[]} onSendMessage={onSend} />);
    const input = await screen.findByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'テスト送信' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('テスト送信');
  });

  it('サジェスト選択でinputにmentionが入る', async () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    const input = await screen.findByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '@' } });
    const suggestItem = await screen.findByTestId(`suggest-item-${charactersJson[0].id}`);
    fireEvent.click(suggestItem);
    expect(input.value).toContain(charactersJson[0].mention);
  });

  it('キャラ選択UIでinputにmentionが入る', async () => {
    render(<ChatWindow messages={[]} onSendMessage={() => {}} />);
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: charactersJson[0].id } });
    const input = screen.getByPlaceholderText('メッセージを入力...') as HTMLInputElement;
    expect(input.value).toContain(charactersJson[0].mention);
  });

  it('吹き出しクリックで返信先キャラが切り替わる', async () => {
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
    const bubble = await screen.findByText('やあ、どうしたの？');
    const bubbleDiv = bubble.closest('div');
    if (bubbleDiv) {
      fireEvent.click(bubbleDiv);
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
