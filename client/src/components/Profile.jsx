function Profile({ user, onSave, onBack }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updated = {
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
      location: formData.get('location'),
      bio: formData.get('bio'),
    };
    onSave(updated);
    alert('Profile saved successfully!');
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <h1>My Profile</h1>
          <button type="button" className="btn-secondary" onClick={onBack}>
            ← Back to Home
          </button>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="Enter your full name"
              defaultValue={user?.name || ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="Enter your email"
              defaultValue={user?.email || ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue={user?.role || 'job_seeker'}>
              <option value="job_seeker">Job Seeker</option>
              <option value="recruiter">Recruiter</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              name="location"
              placeholder=""
              defaultValue={user?.location || ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bio">Bio / Headline</label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              placeholder=""
              defaultValue={user?.bio || ''}
            />
          </div>

          <button type="submit" className="btn-primary">
            Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}

export default Profile;
