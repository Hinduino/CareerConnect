import { useState } from 'react';

function Navbar({ isLoggedIn, onLogin, onLogout, onProfileClick, onHomeClick }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Failed to connect to the server.');
    }
  };

  const handleLogin = () => {
    if (!email || !password) {
      alert('Please enter your email and password.');
      return;
    }
    // Sprint 1: simulated login
    onLogin({ email, name: '', role: 'job_seeker', location: '', bio: '' });
    setEmail('');
    setPassword('');
  };

  return (
    <header className="navbar-section">
      <nav className="navbar-container">
        <div className="navbar-brand">
          <h2 style={{ cursor: 'pointer' }} onClick={onHomeClick}>CareerConnect</h2>
        </div>

        <ul className="navbar-links">
          {/* <li><a href="#browse-jobs">Browse Jobs</a></li*/}
          {/* <li><a href="#features">Features</a></li>*/}
        </ul>

        <div className="navbar-actions">
          {isLoggedIn ? (

            <>
              <button type="button" className="btn-secondary" onClick={onProfileClick}>
                Profile
              </button>
              <button type="button" className="btn-primary" onClick={onLogout}>
                Log Out
              </button>
            </>
          ) : (
            <>
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
              <button type="button" className="btn-secondary" onClick={handleLogin}>
                Log In
              </button>
              <button type="button" className="btn-primary" onClick={handleSignUp}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navbar;

