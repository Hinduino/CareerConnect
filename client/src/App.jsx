import { useState } from 'react';
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MainContent from './components/MainContent'
import ResumeManager from './components/ResumeManager'
import Footer from './components/Footer'
import Profile from './components/Profile'
import ProfileView from './components/ProfileView'
import { useAuth } from './context/AuthContext'

function App() {
  const { user, isAuthenticated, saveProfile } = useAuth();
  const [currentView, setCurrentView] = useState('home');

  const handleSaveProfile = async (profile) => {
    try {
      await saveProfile(profile);
      alert('Profile saved successfully!');
      setCurrentView('profile');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="app-container">
      <Navbar
        onLoginSuccess={() => setCurrentView('profile')}
        onSignUpSuccess={() => setCurrentView('edit-profile')}
        onLogout={() => setCurrentView('home')}
        onProfileClick={() => setCurrentView('profile')}
        onHomeClick={() => setCurrentView('home')}
      />

      {currentView === 'profile' && isAuthenticated ? (
        <ProfileView
          user={user}
          onEdit={() => setCurrentView('edit-profile')}
          onBack={() => setCurrentView('home')}
        />
      ) : currentView === 'edit-profile' && isAuthenticated ? (
        <Profile
          user={user}
          onSave={handleSaveProfile}
          onBack={() => setCurrentView('profile')}
        />
      ) : (
        <>
          <Hero />
          <MainContent />
          <ResumeManager />
          <Footer />
        </>
      )}
    </div>
  )
}

export default App
