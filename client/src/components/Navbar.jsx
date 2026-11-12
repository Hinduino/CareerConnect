import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Navbar({
  currentView,
  onLoginSuccess,
  onSignUpSuccess,
  onLogout,
  onProfileClick,
  onHomeClick,
  onJobsClick,
  onSavedJobsClick,
  onDashboardClick,
  onPostingsClick,
  onRecruiterApplicationsClick,
  onApplicationsClick,
}) {
  const { isAuthenticated, user, login, register, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('job_seeker');

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      await register(email, password, confirmPassword, role);
      const data = await login(email, password);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setRole('job_seeker');
      onSignUpSuccess(data.user);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogIn = async () => {
    try {
      const data = await login(email, password);
      setEmail('');
      setPassword('');
      onLoginSuccess(data.user);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const sidebarItems = user?.role === 'recruiter'
    ? [
        { label: 'Dashboard', view: 'recruiter-dashboard', action: onDashboardClick },
        { label: 'Job Postings', view: 'recruiter-postings', action: onPostingsClick },
        { label: 'Applications', view: 'recruiter-applications', action: onRecruiterApplicationsClick },
        { label: 'Profile', view: 'profile', action: onProfileClick },
      ]
    : [
        { label: 'Find Jobs', view: 'jobs', action: onJobsClick },
        { label: 'Saved Jobs', view: 'saved-jobs', action: onSavedJobsClick },
        { label: 'My Applications', view: 'my-applications', action: onApplicationsClick },
        { label: 'Profile', view: 'profile', action: onProfileClick },
      ];

  return (
    <>
      {isAuthenticated && (
        <aside className="cc-sidebar" aria-label="Main navigation">
          <button
            type="button"
            className="cc-sidebar-brand"
            onClick={onHomeClick}
          >
            CareerConnect
          </button>

          <p className="cc-sidebar-role">
            {user?.role === 'recruiter' ? 'Recruiter Workspace' : 'Applicant Workspace'}
          </p>

          <nav className="cc-sidebar-nav">
            {sidebarItems.map((item) => (
              <button
                key={item.view}
                type="button"
                className={`cc-sidebar-link ${currentView === item.view ? 'active' : ''}`}
                onClick={item.action}
                aria-current={currentView === item.view ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
      )}

      <header className="navbar-section">
        <nav className="navbar-container">
          <div className="navbar-brand">
            <button type="button" className="navbar-home" onClick={onHomeClick}>
              CareerConnect
            </button>
          </div>

          {!isAuthenticated && (
            <ul className="navbar-links">
              <li>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onJobsClick}
                >
                  Browse Jobs
                </button>
              </li>
            </ul>
          )}

          {isAuthenticated ? (
            <div className="navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            
            
              <span>{user?.email}</span>
              <button
                type="button"
                className="btn-primary"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          ) : (
            <div className="navbar-actions" style={{ display: 'flex', gap: '10px' }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {authMode === 'signup' && (
                <>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <select
                    aria-label="Sign up as"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="job_seeker">Job Seeker</option>
                    <option value="recruiter">Recruiter</option>
                  </select>
                </>
              )}

              {authMode === 'login' ? (
                <>
                  <button type="button" onClick={handleLogIn}>
                    Log In
                  </button>
                  <button type="button" onClick={() => setAuthMode('signup')}>
                    Switch to Sign Up
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={handleSignUp}>
                    Sign Up
                  </button>
                  <button type="button" onClick={() => setAuthMode('login')}>
                    Switch to Log In
                  </button>
                </>
              )}
            </div>
          )}
        </nav>
      </header>
    </>
  );
}

export default Navbar;