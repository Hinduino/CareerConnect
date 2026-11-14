import { useState, useEffect } from 'react';
import { formatPostedDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { fetchFavoriteJobIds, toggleFavoriteJob } from '../api/favoriteApi';

async function requestJobs(filters) {
    try {
        const queryParams = new URLSearchParams(filters).toString();
        const response = await fetch(`http://localhost:3000/api/jobs?${queryParams}`);
        const data = await response.json();
        return response.ok ? data : null;
    } catch (error) {
        console.error('Failed to fetch jobs:', error);
        return null;
    }
}

function JobList({ onViewDetails }) {
    const { isAuthenticated, user, token } = useAuth();
    const isJobSeeker = isAuthenticated && user?.role === 'job_seeker';

    const [jobs, setJobs] = useState([]);
    const [favoriteIds, setFavoriteIds] = useState(new Set());
    const [togglingId, setTogglingId] = useState(null);

    const [keyword, setKeyword] = useState('');
    const [location, setLocation] = useState('');
    const [category, setCategory] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        
        requestJobs({ keyword: '', location: '', category: '' }).then((data) => {
            if (!cancelled) {
                setIsLoading(false);
                if (data) {
                    setJobs(data);
                } else {
                    setError('Failed to load jobs. Please check your connection.');
                }
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isJobSeeker || !token) {
            return;
        }
        let cancelled = false;

        fetchFavoriteJobIds(token)
            .then((ids) => {
                if (!cancelled) {
                    setFavoriteIds(new Set(ids));
                }
            })
            .catch((err) => console.error('Failed to load favorite IDs:', err));

        return () => {
            cancelled = true;
        };
    }, [isJobSeeker, token]);

    const visibleFavoriteIds = isJobSeeker ? favoriteIds : new Set();

    const handleToggleFavorite = async (jobId) => {
        if (!token) return;
        setTogglingId(jobId);
        try {
            const res = await toggleFavoriteJob(token, jobId);
            setFavoriteIds(new Set(res.savedJobIds));
        } catch (err) {
            alert(err.message || 'Could not update favorite status.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleFilterSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        const data = await requestJobs({ keyword, location, category });
        
        setIsLoading(false);
        if (data) {
            setJobs(data);
        } else {
            setError('Failed to fetch jobs. Please try again later.');
        }
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
                {isLoading ? (
                    <p>Loading jobs...</p>
                ) : error ? (
                    <p style={{ color: 'red' }}>{error}</p>
                ) : jobs.length > 0 ? (
                    jobs.map((job) => {
                        const isSaved = visibleFavoriteIds.has(job._id);
                        return (
                            <div key={job._id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0 }}>{job.title}</h3>
                                    {isJobSeeker && (
                                        <button
                                            type="button"
                                            onClick={() => handleToggleFavorite(job._id)}
                                            disabled={togglingId === job._id}
                                            aria-pressed={isSaved}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '6px',
                                                border: isSaved ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                                                backgroundColor: isSaved ? '#fef3c7' : '#ffffff',
                                                color: isSaved ? '#b45309' : '#334155',
                                                fontWeight: '600',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {isSaved ? '★ Saved' : '☆ Save Job'}
                                        </button>
                                    )}
                                </div>
                                <p><strong>Company:</strong> {job.company}</p>
                                <p><strong>Location:</strong> {job.location} | <strong>Category:</strong> {job.category}</p>
                                <p className="job-card-dates">{formatPostedDate(job.createdAt)}</p>
                                <button onClick={() => onViewDetails(job._id)}>View Details</button>
                            </div>
                        );
                    })
                ) : (
                    <p>No jobs found.</p>
                )}
            </div>
        </div>
    );
}

export default JobList;