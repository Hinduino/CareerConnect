import { useState, useEffect } from 'react';

function JobList({ onViewDetails }) {
    const [jobs, setJobs] = useState([]);
    const [keyword, setKeyword] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');

    const fetchJobs = async () => {
        try {
            const queryParams = new URLSearchParams({ keyword, location, category }).toString();
            const response = await fetch(`http://localhost:3000/api/jobs?${queryParams}`);
            const data = await response.json();
            
            if (response.ok) {
                setJobs(data);
            }
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        fetchJobs();
    };

    return (
        <div className="job-listing-container" style={{ padding: '20px' }}>
            <h2>Find Your Next Opportunity</h2>
            
            <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input 
                    type="text" 
                    placeholder="Keyword" 
                    value={keyword} 
                    onChange={(e) => setKeyword(e.target.value)} 
                />
                <input 
                    type="text" 
                    placeholder="Location" 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)} 
                />
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All Categories</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                </select>
                <button type="submit">Search</button>
            </form>

            <div className="job-cards">
                {jobs.length > 0 ? (
                    jobs.map((job) => (
                        <div key={job._id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0' }}>
                            <h3>{job.title}</h3>
                            <p><strong>Company:</strong> {job.company}</p>
                            <p><strong>Location:</strong> {job.location} | <strong>Category:</strong> {job.category}</p>
                            <button onClick={() => onViewDetails(job._id)}>View Details</button>
                        </div>
                    ))
                ) : (
                    <p>No jobs found.</p>
                )}
            </div>
        </div>
    );
}

export default JobList;