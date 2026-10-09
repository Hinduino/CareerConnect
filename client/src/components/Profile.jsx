function Profile({ user, onSave, onBack }) {
  const handleSubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSave({
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      location: formData.get('location'),
      bio: formData.get('bio'),
    });
  };

  return (
    <main className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1>My Profile</h1>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to Home
          </button>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              name="name"
              placeholder="Enter your full name"
              defaultValue={user?.name || ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              name="email"
              placeholder="Enter your email"
              defaultValue={user?.email || ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-role">Role</label>
            <select id="profile-role" name="role" defaultValue={user?.role || 'job_seeker'}>
              <option value="job_seeker">Job Seeker</option>
              <option value="recruiter">Recruiter</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="profile-location">Location</label>
            <input
              id="profile-location"
              type="text"
              name="location"
              placeholder="Enter your location"
              defaultValue={user?.location || ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="profile-bio">Bio / Headline</label>
            <textarea
              id="profile-bio"
              name="bio"
              rows={4}
              placeholder="Tell us about yourself"
              defaultValue={user?.bio || ''}
            />
          </div>

          <button type="submit" className="btn-primary">
            Save Profile
          </button>
        </form>
      </div>
    </main>
  );
}

export default Profile;
