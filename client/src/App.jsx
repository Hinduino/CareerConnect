import { useState } from 'react';
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MainContent from './components/MainContent'
import ResumeManager from './components/ResumeManager'
import Footer from './components/Footer'
import Profile from './components/Profile'
import ProfileView from './components/ProfileView'
import { useAuth } from './context/AuthContext'
import JobList from './components/JobList'
import JobDetail from './components/JobDetail'

function App() {
  const { user, isAuthenticated, saveProfile } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [selectedJobId, setSelectedJobId] = useState(null);

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
        onJobsClick={() => setCurrentView('jobs')}
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
      ) : currentView === 'jobs' ? (
        <JobList
          onViewDetails={(id) => {
            setSelectedJobId(id);
            setCurrentView('job-detail');
          }}
        />
      ) : currentView === 'job-detail' ? (
        <JobDetail
          jobId={selectedJobId}
          onBack={() => setCurrentView('jobs')}
        />
      ) : (
        <>
          <Hero />
          <MainContent />
          <ResumeManager />
        </>
      )}

      <Footer />
    </div>
  )
}

export default App