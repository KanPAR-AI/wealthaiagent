import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Index from '../Index';

// Mock the Logo component
jest.mock('@/components/ui/logo', () => {
  return function MockLogo() {
    return <div data-testid="logo">Logo</div>;
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Index Page', () => {
  it('renders welcome message', () => {
    renderWithRouter(<Index />);
    
    expect(screen.getByText('Welcome to AI Chat')).toBeInTheDocument();
    expect(screen.getByText('Your intelligent conversation partner.')).toBeInTheDocument();
  });

  it('renders logo component', () => {
    renderWithRouter(<Index />);
    
    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('renders start new chat button', () => {
    renderWithRouter(<Index />);
    
    const startButton = screen.getByRole('link', { name: /start new chat/i });
    expect(startButton).toBeInTheDocument();
    expect(startButton).toHaveAttribute('href', '/new');
  });

  it('renders user avatar', () => {
    renderWithRouter(<Index />);
    
    const userAvatar = screen.getByText('U');
    expect(userAvatar).toBeInTheDocument();
  });

  it('renders footer with current year', () => {
    renderWithRouter(<Index />);
    
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} Your Company Name. All rights reserved.`)).toBeInTheDocument();
  });
});
