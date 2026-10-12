import { useState } from 'react';

const EMPTY_JOB = {
  title: '',
  company: '',
  location: '',
  category: '',
  description: '',
  requirements: '',
};

// Shared form used by the recruiter dashboard to both create a brand new
// posting and modify an existing one (`initialValues` is set in that case).
function JobPostingForm({ initialValues, onSubmit, onCancel, submitLabel }) {
  const [values, setValues] = useState({ ...EMPTY_JOB, ...initialValues });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="job-posting-form" onSubmit={handleSubmit}>
      {error && <p className="resume-error">{error}</p>}

      <div className="form-group">
        <label htmlFor="job-title">Job Title</label>
        <input
          id="job-title"
          type="text"
          value={values.title}
          onChange={handleChange('title')}
          placeholder="e.g. Frontend Engineer"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="job-company">Company</label>
        <input
          id="job-company"
          type="text"
          value={values.company}
          onChange={handleChange('company')}
          placeholder="e.g. Acme Corp"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="job-location">Location</label>
        <input
          id="job-location"
          type="text"
          value={values.location}
          onChange={handleChange('location')}
          placeholder="e.g. Remote, Montreal"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="job-category">Category</label>
        <select
          id="job-category"
          value={values.category}
          onChange={handleChange('category')}
          required
        >
          <option value="">Select a category</option>
          <option value="Engineering">Engineering</option>
          <option value="Design">Design</option>
          <option value="Marketing">Marketing</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="job-description">Description</label>
        <textarea
          id="job-description"
          rows={5}
          value={values.description}
          onChange={handleChange('description')}
          placeholder="Describe the role and responsibilities"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="job-requirements">Requirements</label>
        <textarea
          id="job-requirements"
          rows={4}
          value={values.requirements}
          onChange={handleChange('requirements')}
          placeholder="List the skills and experience required"
          required
        />
      </div>

      <div className="job-posting-form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : submitLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default JobPostingForm;
