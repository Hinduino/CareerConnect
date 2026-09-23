import { useState } from 'react';

function Navbar() {
  // Hardcoded state for Sprint 1 testing purposes
  const [email, setEmail] = useState('testuser@example.com');
  const [password, setPassword] = useState('password123');

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

        <div className="navbar-actions">
          <button type="button">Log In</button>
          {/* Added the onClick event to trigger the API call */}
          <button type="button" onClick={handleSignUp}>Sign Up</button>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
