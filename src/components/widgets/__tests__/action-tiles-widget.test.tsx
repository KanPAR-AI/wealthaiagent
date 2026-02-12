/**
 * CUJ Test: Confirmation Button Flow
 *
 * Critical User Journey:
 *   User sees confirmation message -> clicks "Confirm & Calculate" ->
 *   message "yes" is dispatched -> button disappears
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionTilesWidget } from '../action-tiles-widget';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const CONFIRM_WIDGET_PROPS = {
  id: 'confirm_action',
  title: 'Confirm & Calculate',
  data: {
    actions: [{ label: 'Confirm & Calculate', message: 'yes' }],
  },
};

describe('CUJ: Confirmation Button', () => {
  let dispatchedEvents: CustomEvent[] = [];

  beforeEach(() => {
    dispatchedEvents = [];
    const origDispatch = window.dispatchEvent.bind(window);
    jest.spyOn(window, 'dispatchEvent').mockImplementation((event: Event) => {
      if (event.type === 'chat-quick-reply') {
        dispatchedEvents.push(event as CustomEvent);
      }
      return origDispatch(event);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders confirm button, dispatches "yes" on click, then hides', async () => {
    render(<ActionTilesWidget {...CONFIRM_WIDGET_PROPS} />);

    // 1. Button renders with correct label
    const button = screen.getByRole('button', { name: 'Confirm & Calculate' });
    expect(button).toBeInTheDocument();

    // 2. Click the button
    fireEvent.click(button);

    // 3. CustomEvent dispatched with message "yes"
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].detail).toEqual({ text: 'yes' });

    // 4. Button disappears, replaced by "Confirmed" text
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('ignores double-clicks (no duplicate dispatch)', () => {
    render(<ActionTilesWidget {...CONFIRM_WIDGET_PROPS} />);

    const button = screen.getByRole('button', { name: 'Confirm & Calculate' });
    fireEvent.click(button);
    fireEvent.click(button); // second click should be ignored

    expect(dispatchedEvents).toHaveLength(1);
  });
});
