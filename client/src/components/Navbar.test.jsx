const { fireEvent, render, screen } = require('@testing-library/react');

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const Navbar = require('./Navbar').default;
const { useAuth } = require('../context/AuthContext');

describe('Navbar sign up role selection', () => {
  let register;
  let login;

  beforeEach(() => {
    register = jest.fn().mockResolvedValue({});
    login = jest.fn().mockResolvedValue({ user: { email: 'new@example.com', role: 'recruiter' } });
    useAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      login,
      register,
      logout: jest.fn(),
    });
  });

  it('defaults to job seeker and lets a user choose recruiter when signing up', async () => {
    const onSignUpSuccess = jest.fn();
    render(
      <Navbar
        onLoginSuccess={jest.fn()}
        onSignUpSuccess={onSignUpSuccess}
        onLogout={jest.fn()}
        onProfileClick={jest.fn()}
        onHomeClick={jest.fn()}
        onJobsClick={jest.fn()}
        onDashboardClick={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Switch to Sign Up'));

    const roleSelect = screen.getByLabelText('Sign up as');
    expect(roleSelect.value).toBe('job_seeker');
    fireEvent.change(roleSelect, { target: { value: 'recruiter' } });

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Secure123!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'Secure123!' } });

    fireEvent.click(screen.getByText('Sign Up'));

    await Promise.resolve();
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith('new@example.com', 'Secure123!', 'Secure123!', 'recruiter');
  });
});

describe('Navbar authenticated recruiter', () => {
  it('shows a Dashboard link for recruiters but not for job seekers', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'recruiter@example.com', role: 'recruiter' },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    render(
      <Navbar
        onLoginSuccess={jest.fn()}
        onSignUpSuccess={jest.fn()}
        onLogout={jest.fn()}
        onProfileClick={jest.fn()}
        onHomeClick={jest.fn()}
        onJobsClick={jest.fn()}
        onDashboardClick={jest.fn()}
      />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('hides the Dashboard link for job seekers', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'seeker@example.com', role: 'job_seeker' },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    render(
      <Navbar
        onLoginSuccess={jest.fn()}
        onSignUpSuccess={jest.fn()}
        onLogout={jest.fn()}
        onProfileClick={jest.fn()}
        onHomeClick={jest.fn()}
        onJobsClick={jest.fn()}
        onDashboardClick={jest.fn()}
      />
    );

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('Navbar My Applications link', () => {
  const props = {
    onLoginSuccess: jest.fn(),
    onSignUpSuccess: jest.fn(),
    onLogout: jest.fn(),
    onProfileClick: jest.fn(),
    onHomeClick: jest.fn(),
    onJobsClick: jest.fn(),
    onDashboardClick: jest.fn(),
  };

  it('shows My Applications to job seekers and opens the page when clicked', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'seeker@example.com', role: 'job_seeker' },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });
    const onApplicationsClick = jest.fn();

    render(<Navbar {...props} onApplicationsClick={onApplicationsClick} />);

    fireEvent.click(screen.getByText('My Applications'));
    expect(onApplicationsClick).toHaveBeenCalled();
  });

  it('hides My Applications from recruiters', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      user: { email: 'recruiter@example.com', role: 'recruiter' },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });

    render(<Navbar {...props} onApplicationsClick={jest.fn()} />);

    expect(screen.queryByText('My Applications')).not.toBeInTheDocument();
  });
});