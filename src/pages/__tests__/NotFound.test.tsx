import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotFound from '../NotFound';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('NotFound Page', () => {
  it('renders 404 message', () => {
    renderWithRouter(<NotFound />);
    
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('renders go to homepage button', () => {
    renderWithRouter(<NotFound />);
    
    const goBackButton = screen.getByRole('link', { name: /go to homepage/i });
    expect(goBackButton).toBeInTheDocument();
    expect(goBackButton).toHaveAttribute('href', '/');
  });
});
