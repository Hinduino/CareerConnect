const ROLE_LABELS = {
  job_seeker: 'Job Seeker',
  recruiter: 'Recruiter',
};

function ProfileView({ user, onEdit, onBack }) {
  const fields = [
    { label: 'Full Name', value: user?.name },
    { label: 'Email', value: user?.email },
    { label: 'Role', value: ROLE_LABELS[user?.role] || user?.role },
    { label: 'Location', value: user?.location },
    { label: 'Bio / Headline', value: user?.bio },
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
      </div>
    </main>
  );
}

export default ProfileView;
