import { useState } from 'react';
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import MainContent from './components/MainContent'
import Footer from './components/Footer'
import Profile from './components/Profile'
import ProfileView from './components/ProfileView'
import { useAuth } from './context/AuthContext'
import JobList from './components/JobList'
import JobDetail from './components/JobDetail'
import RecruiterDashboard from './components/RecruiterDashboard'

function App() {
  const { user, isAuthenticated, saveProfile } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [selectedJobId, setSelectedJobId] = useState(null);

  const handleSaveProfile = async (profile) => {
    try {
      await saveProfile(profile);
      alert('Profile saved successfully!');
      setCurrentView(profile.role === 'recruiter' ? 'recruiter-dashboard' : 'profile');
    } catch (err) {
      alert(err.message);
    }
  };

  // Recruiters land on their dashboard right away; job seekers finish
  // filling in their profile first. Either account type can always switch
  // roles later from the profile settings page.
  const routeAfterAuth = (authedUser) => {
    setCurrentView(authedUser?.role === 'recruiter' ? 'recruiter-dashboard' : 'profile');
  };

  return (
    <div className="app-container">
      <Navbar
        onLoginSuccess={routeAfterAuth}
        onSignUpSuccess={(authedUser) =>
          setCurrentView(authedUser?.role === 'recruiter' ? 'recruiter-dashboard' : 'edit-profile')
        }
        onLogout={() => setCurrentView('home')}
        onProfileClick={() => setCurrentView('profile')}
        onHomeClick={() => setCurrentView('home')}
        onJobsClick={() => setCurrentView('jobs')}
        onDashboardClick={() => setCurrentView('recruiter-dashboard')}
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
      ) : currentView === 'recruiter-dashboard' && isAuthenticated && user?.role === 'recruiter' ? (
        <RecruiterDashboard onBack={() => setCurrentView('home')} />
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
        </>
      )}

      <Footer />
    </div>
  )
}

export default App