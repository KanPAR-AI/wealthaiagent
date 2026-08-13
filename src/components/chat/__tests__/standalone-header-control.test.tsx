/**
 * The memory control in the chat top bar.
 *
 * `standalone` is fixed when a chat is CREATED — PATCH /chats/{id} renames and
 * nothing more. So an on/off switch on an open conversation would be a lie:
 * by the time you flip it the earlier turns have already read your profile,
 * and nothing can retract that. Three states, each honest about what it does.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StandaloneHeaderControl } from '../standalone-toggle';

const setStandaloneMode = jest.fn();
let standaloneMode = false;

jest.mock('@/store/chat', () => ({
  useChatStore: (sel: (s: unknown) => unknown) =>
    sel({ standaloneMode, setStandaloneMode }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderControl = (props: { chatId?: string; isStandalone: boolean }) =>
  render(
    <MemoryRouter>
      <StandaloneHeaderControl {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  setStandaloneMode.mockClear();
  mockNavigate.mockClear();
  standaloneMode = false;
});

test('no chat open: the real toggle, arming the chat about to be started', () => {
  renderControl({ isStandalone: false });
  const btn = screen.getByRole('button');
  fireEvent.click(btn);
  expect(setStandaloneMode).toHaveBeenCalledWith(true);
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('inside a standalone chat: a badge, because the state is settled', () => {
  renderControl({ chatId: 'c1', isStandalone: true });
  expect(screen.queryByRole('button')).toBeNull();
  expect(
    screen.getByText(/not using or updating your memory/i),
  ).toBeInTheDocument();
});

test('ordinary chat open: offers a NEW standalone chat, never a fake retro-seal', () => {
  renderControl({ chatId: 'c1', isStandalone: false });
  const btn = screen.getByRole('button', { name: /new standalone chat/i });
  // It must not claim to change the CURRENT chat.
  expect(btn.getAttribute('title')).toMatch(/cannot be undone|NEW standalone/i);
  fireEvent.click(btn);
  expect(setStandaloneMode).toHaveBeenCalledWith(true);
  expect(mockNavigate).toHaveBeenCalledWith('/new');
});
