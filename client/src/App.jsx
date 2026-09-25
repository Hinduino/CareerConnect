import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import MainContent from './components/MainContent';
import Footer from './components/Footer';
import Profile from './components/Profile';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'profile'
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    setCurrentView('profile');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setCurrentView('home');
  };

  const handleSaveProfile = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <div className="app-container">
      <Navbar
        isLoggedIn={isLoggedIn}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onProfileClick={() => setCurrentView('profile')}
        onHomeClick={() => setCurrentView('home')}
      />

      {currentView === 'profile' ? (
        <Profile
          user={user}
          onSave={handleSaveProfile}
          onBack={() => setCurrentView('home')}
        />
      ) : (
        <>
          <Hero />
          <MainContent />
          <Footer />
        </>
      )}
    </div>
  );
}

export default App;
