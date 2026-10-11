const { fireEvent, render, screen } = require('@testing-library/react');

jest.mock('./context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./components/Navbar', () => ({
  __esModule: true,
  default: function MockNavbar({ onProfileClick, onHomeClick }) {
    return (
      <nav>
        <button onClick={onProfileClick}>Profile navigation</button>
        <button onClick={onHomeClick}>Home navigation</button>
      </nav>
    );
  },
}));
jest.mock('./components/Hero', () => function MockHero() { return <div>Home hero</div>; });
jest.mock('./components/MainContent', () => function MockMainContent() { return <div>Home content</div>; });
jest.mock('./components/Footer', () => function MockFooter() { return <div>Footer</div>; });
jest.mock('./components/Profile', () => function MockProfile() { return <div>Edit profile</div>; });
jest.mock('./components/ProfileView', () => function MockProfileView({ onBack }) {
  return (
    <div>
      Profile details
      <button onClick={onBack}>Profile back</button>
    </div>
  );
});
jest.mock('./components/JobList', () => function MockJobList() { return <div>Job list</div>; });
jest.mock('./components/JobDetail', () => function MockJobDetail() { return <div>Job details</div>; });

const App = require('./App').default;
const { useAuth } = require('./context/AuthContext');

describe('App profile navigation', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: { name: 'Jane Doe' },
      isAuthenticated: true,
      saveProfile: jest.fn(),
    });
  });

  it('keeps profile-only content off the home view and opens the profile view', () => {
    render(<App />);

    expect(screen.getByText('Home hero')).toBeInTheDocument();
    expect(screen.getByText('Home content')).toBeInTheDocument();
    expect(screen.queryByText('Profile details')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Profile navigation' }));
    expect(screen.getByText('Profile details')).toBeInTheDocument();
    expect(screen.queryByText('Home hero')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Profile back' }));
    expect(screen.getByText('Home hero')).toBeInTheDocument();
  });
});
