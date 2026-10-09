import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Navbar({ onLoginSuccess, onSignUpSuccess, onLogout, onProfileClick, onHomeClick }) {
  const { isAuthenticated, user, login, register, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      await register(email, password);
      // Sign in right away so the new user can fill in their profile
      await login(email, password);
      setEmail('');
      setPassword('');
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
            <button type="button" onClick={handleLogIn}>Log In</button>
            <button type="button" onClick={handleSignUp}>Sign Up</button>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
