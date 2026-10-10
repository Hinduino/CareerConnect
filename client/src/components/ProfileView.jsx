import ProfilePicture from './ProfilePicture';
import ResumeManager from './ResumeManager';

const ROLE_LABELS = {
  job_seeker: 'Job Seeker',
  recruiter: 'Recruiter',
};

function ProfileView({ user, onEdit, onBack }) {
  const fields = [
    { label: 'Email', value: user?.email },
    { label: 'Role', value: ROLE_LABELS[user?.role] || user?.role },
    { label: 'Location', value: user?.location },
  ];

  return (
    <main className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1>My Profile</h1>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to Home
          </button>
        </div>

        <div className="profile-identity">
          <ProfilePicture name={user?.name} />
          <h2 className="profile-name">{user?.name || 'Unnamed User'}</h2>
          {user?.bio ? (
            <p className="profile-bio">{user.bio}</p>
          ) : (
            <p className="profile-bio profile-empty">No bio provided</p>
          )}
        </div>

        <dl className="profile-details">
          {fields.map(({ label, value }) => (
            <div className="profile-detail" key={label}>
              <dt>{label}</dt>
              <dd>{value || <span className="profile-empty">Not provided</span>}</dd>
            </div>
          ))}
        </dl>

        <button type="button" className="btn-primary" onClick={onEdit}>
          Edit Profile
        </button>

        <ResumeManager />
      </div>
    </main>
  );
}

export default ProfileView;
