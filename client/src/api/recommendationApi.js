import { fetchAiResponse } from './aiRequest';

const API_BASE = 'http://localhost:3000/api';

function isRecommendation(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.job
    && typeof value.job === 'object'
    && typeof value.job.id === 'string'
    && value.job.id.trim()
    && typeof value.reason === 'string'
    && value.reason.trim()
    && Array.isArray(value.matchedQualifications)
    && value.matchedQualifications.every((item) => typeof item === 'string')
    && Array.isArray(value.gaps)
    && value.gaps.every((item) => typeof item === 'string')
  );
}

export async function fetchRecommendations(token, resumeId) {
  const response = await fetchAiResponse(`${API_BASE}/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ resumeId: resumeId || null }),
  }, 'job recommendations');

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load job recommendations.');
  }
  if (
    !Array.isArray(data?.recommendations)
    || !data.recommendations.every(isRecommendation)
  ) {
    throw new Error('Job recommendations returned an invalid response. Please refresh and try again.');
  }
  return data;
}
