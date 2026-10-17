import { useState, useEffect } from 'react';
import { formatPostedDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

function JobDetail({ jobId, onBack }) {
    const [job, setJob] = useState(null);
    const [error, setError] = useState('');
    
    // Application state management
    const { user, isAuthenticated } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState(null); 
    const [submitMessage, setSubmitMessage] = useState('');
    
    useEffect(() => {
        const fetchJobDetail = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
                const data = await response.json();

                if (response.ok) {
                    setJob(data);
                } else {
                    setError(data.error || 'Failed to load job details');
                }
            } catch (err) {
            console.error("Submission error:", err); // Add this line
            setSubmitStatus('error');
            setSubmitMessage('Network error. Unable to submit application.');
            }
        };

        if (jobId) {
            fetchJobDetail();
        }
    }, [jobId]);

    const handleApply = async () => {
        if (!isAuthenticated) {
            setSubmitStatus('error');
            setSubmitMessage('You must be logged in to apply for this job.');
            return;
        }
        
        setIsSubmitting(true);
        setSubmitStatus(null);
        
        try {
            const response = await fetch('http://localhost:3000/api/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    jobId: jobId, 
                    applicantId: user.id 
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                setSubmitStatus('success');
                setSubmitMessage(data.message || 'Application submitted successfully!');
            } else {
                setSubmitStatus('error');
                setSubmitMessage(data.error || 'Failed to submit application.');
            }
        } catch (err) {
            setSubmitStatus('error');
            console.error("Fetch error:", err);
            setError('Failed to connect to the server.');
            setSubmitMessage('Network error. Unable to submit application.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (error) return (
        <div style={{ padding: '20px' }}>
            <p>{error}</p>
            <button onClick={onBack}>Back to Jobs</button>
        </div>
    );

    if (!job) return <p style={{ padding: '20px' }}>Loading job details...</p>;

    return (
        <section className="job-detail-section" style={{ padding: '20px' }}>
            <button onClick={onBack} style={{ marginBottom: '20px' }}>&larr; Back to Job List</button>

            <h2>{job.title}</h2>
            <h4>{job.company} - {job.location}</h4>
            <span style={{ background: '#eee', padding: '5px' }}>{job.category}</span>
            <p className="job-card-dates">{formatPostedDate(job.createdAt)}</p>

            <div style={{ marginTop: '20px' }}>
                <h3>Job Description</h3>
                <p>{job.description}</p>
            </div>

            <div style={{ marginTop: '20px' }}>
                <h3>Requirements</h3>
                <p>{job.requirements}</p>
            </div>

            <button type="button" 
            disabled 
            title="Application feature coming in Sprint 3!" 
            style={{ marginTop: '20px', padding: '10px 20px', cursor: 'not-allowed', opacity: 0.6 }}
            >Apply Now
            </button>
            <button type="button" style={{ marginTop: '20px', padding: '10px 20px' }}>Apply Now</button>

            {/* Conditional Rendering for Submission Confirmation */}
            {submitStatus === 'success' ? (
                <div style={{ marginTop: '20px', padding: '15px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '5px' }}>
                    <h4 style={{ color: '#155724', margin: 0 }}>{submitMessage}</h4>
                    <p style={{ color: '#155724', marginTop: '5px', marginBottom: 0 }}>Your application status is now being tracked.</p>
                </div>
            ) : (
                <div style={{ marginTop: '20px' }}>
                    {submitStatus === 'error' && (
                        <p style={{ color: 'red', marginBottom: '10px' }}>{submitMessage}</p>
                    )}
                    <button 
                        type="button" 
                        onClick={handleApply}
                        disabled={isSubmitting}
                        style={{ 
                            padding: '10px 20px', 
                            cursor: isSubmitting ? 'wait' : 'pointer',
                            opacity: isSubmitting ? 0.7 : 1
                        }}
                    >
                        {isSubmitting ? 'Submitting...' : 'Apply Now'}
                    </button>
                </div>
            )}
        </section>
    );
}

export default JobDetail;