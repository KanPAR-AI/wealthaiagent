/**
 * Suggestion tiles (bug 52eddbb0: "Tiles are clumsy beautify this page").
 *
 * The mobile empty-state tiles were rounded-full pills with centre-wrapped
 * 3-line text. They are now card tiles: any trailing emoji in a campaign
 * title is lifted out into its own glyph, the remaining text is left-aligned,
 * and clicking still sends the FULL original title (emoji included) so the
 * chat message the backend sees is unchanged.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionTiles } from '../chat-suggestion-tiles';

const tiles = [
  { id: 1, title: "I'm feeling overwhelmed — help me find calm 💛", description: '' },
  { id: 2, title: 'Should I buy this house? Lets crunch the numbers 🏠', description: '' },
  { id: 3, title: 'What are my top holdings?', description: '', useMockService: true },
];

describe('SuggestionTiles', () => {
  it('lifts a trailing emoji out of the mobile card text', () => {
    render(<SuggestionTiles tiles={tiles} onSuggestionClick={jest.fn()} />);
    // Card text is the title without the emoji…
    expect(
      screen.getByText("I'm feeling overwhelmed — help me find calm"),
    ).toBeInTheDocument();
    // …and the emoji renders as its own (decorative) glyph.
    expect(screen.getByText('💛')).toHaveAttribute('aria-hidden');
  });

  it('renders an emoji-free title unchanged', () => {
    render(<SuggestionTiles tiles={tiles} onSuggestionClick={jest.fn()} />);
    // Desktop pill + mobile card both carry the plain title.
    expect(screen.getAllByText('What are my top holdings?').length).toBeGreaterThan(0);
  });

  it('reports the FULL original title on click, emoji included', () => {
    const onClick = jest.fn();
    render(<SuggestionTiles tiles={tiles} onSuggestionClick={onClick} />);
    fireEvent.click(screen.getByText("I'm feeling overwhelmed — help me find calm"));
    expect(onClick).toHaveBeenCalledWith(
      "I'm feeling overwhelmed — help me find calm 💛",
      undefined,
    );
  });

  it('passes useMockService through', () => {
    const onClick = jest.fn();
    render(<SuggestionTiles tiles={tiles} onSuggestionClick={onClick} />);
    // Two matches (mobile card + desktop pill); either fires the same handler.
    fireEvent.click(screen.getAllByText('What are my top holdings?')[0]);
    expect(onClick).toHaveBeenCalledWith('What are my top holdings?', true);
  });

  it('disables every tile when disabled', () => {
    render(<SuggestionTiles tiles={tiles} onSuggestionClick={jest.fn()} disabled />);
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});
