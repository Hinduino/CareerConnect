import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { isAuthenticated, user, login, register, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      const data = await register(email, password);
      alert(data.message); // Should pop up "User registered successfully!"
      setPassword('');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogIn = async () => {
    try {
      await login(email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <header className="navbar-section">
      <nav className="navbar-container">
        <div className="navbar-brand">
          <h2>CareerConnect</h2>
        </div>

        <ul className="navbar-links">
          <li><a href="#browse-jobs">Browse Jobs</a></li>
          <li><a href="#features">Features</a></li>
        </ul>

        {isAuthenticated ? (
          <div className="navbar-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span>{user?.email}</span>
            <button type="button" onClick={logout}>Log Out</button>
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

