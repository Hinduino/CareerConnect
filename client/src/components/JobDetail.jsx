import { useState, useEffect } from 'react';

function JobDetail({ jobId, onBack }) {
    const [job, setJob] = useState(null);
    const [error, setError] = useState('');

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
                console.error('Network Error:', err);
                setError('Failed to connect to the server.');
            }
        };

        if (jobId) {
            fetchJobDetail();
        }
    }, [jobId]);

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
            
            <div style={{ marginTop: '20px' }}>
                <h3>Job Description</h3>
                <p>{job.description}</p>
            </div>
            
            <div style={{ marginTop: '20px' }}>
                <h3>Requirements</h3>
                <p>{job.requirements}</p>
            </div>
            
            <button type="button" style={{ marginTop: '20px', padding: '10px 20px' }}>Apply Now</button>
        </section>
    );
}

export default JobDetail;