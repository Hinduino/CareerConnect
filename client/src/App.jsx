import { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Footer from './components/Footer';
import Profile from './components/Profile';
import ProfileView from './components/ProfileView';
import { useAuth } from './context/AuthContext';
import JobList from './components/JobList';
import JobDetail from './components/JobDetail';
import RecruiterDashboard from './components/RecruiterDashboard';
import RecruiterPostings from './components/RecruiterPostings';
import ApplicationHistory from './components/ApplicationHistory';
import SavedJobs from './components/SavedJobs';
import Chatbot from './components/Chatbot';

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
    <div className={isAuthenticated ? 'app-container cc-authenticated' : 'app-container'}>
      <Navbar
        currentView={currentView}
        onLoginSuccess={routeAfterAuth}
        onSignUpSuccess={(authedUser) =>
          setCurrentView(authedUser?.role === 'recruiter' ? 'recruiter-dashboard' : 'edit-profile')
        }
        onLogout={() => setCurrentView('home')}
        onProfileClick={() => setCurrentView('profile')}
        onHomeClick={() => setCurrentView('home')}
        onJobsClick={() => setCurrentView('jobs')}
        onSavedJobsClick={() => setCurrentView('saved-jobs')}
        onDashboardClick={() => setCurrentView('recruiter-dashboard')}
        onPostingsClick={() => setCurrentView('recruiter-postings')}
        onRecruiterApplicationsClick={() => setCurrentView('recruiter-applications')}
        onApplicationsClick={() => setCurrentView('my-applications')}
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
      ) : currentView === 'recruiter-postings' && isAuthenticated && user?.role === 'recruiter' ? (
        <RecruiterPostings />
      ) : (currentView === 'recruiter-dashboard' || currentView === 'recruiter-applications') &&
          isAuthenticated &&
          user?.role === 'recruiter' ? (
        <RecruiterDashboard
          currentView={currentView}
          onBack={() => setCurrentView('home')}
        />
      ) : currentView === 'saved-jobs' && isAuthenticated && user?.role === 'job_seeker' ? (
        <SavedJobs
          onViewDetails={(id) => {
            setSelectedJobId(id);
            setCurrentView('job-detail');
          }}
        />
      ) : currentView === 'my-applications' && isAuthenticated && user?.role === 'job_seeker' ? (
        <ApplicationHistory />
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
        <Hero onJobsClick={() => setCurrentView('jobs')} />
      )}

      <Footer />
      <Chatbot />
    </div>
  );
}

export default App;