import { useState } from 'react';

function Navbar() {
  // Hardcoded state for Sprint 1 testing purposes
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Success:', data);
        alert(data.message); // Should pop up "User registered successfully!"
      } else {
        console.error('Error:', data);
        alert(data.error);
      }
    } catch (error) {
      console.error('Network Error:', error);
      alert('Failed to connect to the server.');
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
          <button type="button">Log In</button>
          <button type="button" onClick={handleSignUp}>Sign Up</button>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;

