import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Navbar({ onLoginSuccess, onSignUpSuccess, onLogout, onProfileClick, onHomeClick }) {
  const { isAuthenticated, user, login, register, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      await register(email, password, confirmPassword);
      // Sign in right away so the new user can fill in their profile
      await login(email, password);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      onSignUpSuccess();
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

  return (
    <header className="navbar-section">
      <nav className="navbar-container">
        <div className="navbar-brand">
          <button type="button" className="navbar-home" onClick={onHomeClick}>
            CareerConnect
          </button>
        </div>

        <ul className="navbar-links">
          <li><button type="button" className="btn-secondary">Browse Jobs</button></li>
          <li><button type="button" className="btn-secondary">Features</button></li>
        </ul>

        {isAuthenticated ? (
          <div className="navbar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span>{user?.email}</span>
            <button type="button" className="btn-secondary" onClick={onProfileClick}>Profile</button>
            <button type="button" className="btn-primary" onClick={handleLogout}>Log Out</button>
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
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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
  );
}

export default Navbar;
