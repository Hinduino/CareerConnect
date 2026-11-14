const API_BASE = 'http://localhost:3000/api/jobs';

export async function fetchFavoriteJobIds(token) {
  const response = await fetch(`${API_BASE}/favorites/ids`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch favorite job IDs');
  }
  return data.favoriteIds || [];
}

export async function fetchFavoriteJobs(token) {
  const response = await fetch(`${API_BASE}/favorites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch saved jobs');
  }
  return data;
}

export async function toggleFavoriteJob(token, jobId) {
  const response = await fetch(`${API_BASE}/${jobId}/favorite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update favorite status');
  }
  return data;
}