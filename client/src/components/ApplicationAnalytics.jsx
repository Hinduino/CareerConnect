import { useMemo } from 'react';

const STATUS_PALETTE = {
  Applied: '#0284c7',
  'Under Review': '#d97706',
  'under review': '#d97706',
  Interview: '#7c3aed',
  Interviewing: '#7c3aed',
  Offered: '#16a34a',
  Rejected: '#dc2626',
  'Offer Declined': '#475569',
  Cancelled: '#94a3b8',
};

function ApplicationAnalytics({ applications = [] }) {
  // 1. Metric Calculations
  const metrics = useMemo(() => {
    const total = applications.length;
    const offered = applications.filter((a) => a.status === 'Offered').length;
    const active = applications.filter((a) =>
      ['Applied', 'Under Review', 'under review', 'Interview', 'Interviewing'].includes(a.status)
    ).length;
    const declined = applications.filter((a) => a.status === 'Offer Declined').length;
    const rejected = applications.filter((a) => a.status === 'Rejected').length;
    const cancelled = applications.filter((a) => a.status === 'Cancelled').length;

    // Response rate: anything that progressed past basic "Applied"
    const respondedCount = total - applications.filter((a) => a.status === 'Applied').length - cancelled;
    const responseRate = total > 0 ? Math.round((Math.max(0, respondedCount) / total) * 100) : 0;

    return { total, active, offered, declined, rejected, cancelled, responseRate };
  }, [applications]);

  // 2. Status Breakdown
  const statusCounts = useMemo(() => {
    const counts = {};
    applications.forEach((app) => {
      const st = app.status || 'Applied';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [applications]);

  // 3. Activity Timeline by Month / Date Buckets
  const timelineData = useMemo(() => {
    const buckets = {};
    // Sort applications chronologically for timeline display
    const sorted = [...applications].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sorted.forEach((app) => {
      const date = new Date(app.createdAt);
      // Group by Month Year (e.g., "Nov 2026")
      const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      buckets[label] = (buckets[label] || 0) + 1;
    });

    const entries = Object.entries(buckets);
    const maxVal = entries.reduce((max, [, count]) => Math.max(max, count), 1);

    return { entries, maxVal };
  }, [applications]);

  if (applications.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '32px', fontFamily: 'inherit' }}>
      {/* 4 Top Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={cardStyle}>
          <span style={cardLabelStyle}>Total Applications</span>
          <span style={{ ...cardValueStyle, color: '#1e293b' }}>{metrics.total}</span>
          <span style={cardSubtextStyle}>All-time submissions</span>
        </div>

        <div style={cardStyle}>
          <span style={cardLabelStyle}>Active in Pipeline</span>
          <span style={{ ...cardValueStyle, color: '#0284c7' }}>{metrics.active}</span>
          <span style={cardSubtextStyle}>Awaiting decision</span>
        </div>

        <div style={cardStyle}>
          <span style={cardLabelStyle}>Offers Extended</span>
          <span style={{ ...cardValueStyle, color: '#16a34a' }}>{metrics.offered}</span>
          <span style={cardSubtextStyle}>Ready for review</span>
        </div>

        <div style={cardStyle}>
          <span style={cardLabelStyle}>Response Rate</span>
          <span style={{ ...cardValueStyle, color: '#7c3aed' }}>{metrics.responseRate}%</span>
          <span style={cardSubtextStyle}>Recruiter interaction rate</span>
        </div>
      </div>

      {/* Visual Analytics Row: Status Breakdown + Submission Timeline */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Status Distribution */}
        <div style={sectionPanelStyle}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#1e293b' }}>
            Application Status Breakdown
          </h4>

          {/* Segmented Progress Bar */}
          <div
            style={{
              display: 'flex',
              height: '14px',
              borderRadius: '7px',
              overflow: 'hidden',
              backgroundColor: '#e2e8f0',
              marginBottom: '16px',
            }}
          >
            {Object.entries(statusCounts).map(([status, count]) => {
              const widthPct = (count / metrics.total) * 100;
              const color = STATUS_PALETTE[status] || '#64748b';
              return (
                <div
                  key={status}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    transition: 'width 0.3s ease',
                  }}
                  title={`${status}: ${count} (${Math.round(widthPct)}%)`}
                />
              );
            })}
          </div>

          {/* Itemized Legend & Counts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {Object.entries(statusCounts).map(([status, count]) => {
              const color = STATUS_PALETTE[status] || '#64748b';
              const pct = Math.round((count / metrics.total) * 100);
              return (
                <div
                  key={status}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    color: '#475569',
                  }}
                >
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: color,
                    }}
                  />
                  <span>
                    <strong>{status}</strong>: {count} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Timeline Chart */}
        <div style={sectionPanelStyle}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#1e293b' }}>
            Application Activity Over Time
          </h4>

          {timelineData.entries.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No submission timeline recorded.</p>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '16px',
                height: '130px',
                paddingTop: '20px',
                borderBottom: '1px solid #cbd5e1',
              }}
            >
              {timelineData.entries.map(([label, count]) => {
                const heightPct = Math.round((count / timelineData.maxVal) * 100);
                return (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#4f46e5', marginBottom: '4px' }}>
                      {count}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '44px',
                        height: `${Math.max(12, heightPct)}%`,
                        backgroundColor: '#6366f1',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                      title={`${count} applications in ${label}`}
                    />
                    <span
                      style={{
                        marginTop: '6px',
                        fontSize: '0.72rem',
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '16px 20px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const cardLabelStyle = {
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const cardValueStyle = {
  fontSize: '1.8rem',
  fontWeight: '700',
  lineHeight: 1.2,
};

const cardSubtextStyle = {
  fontSize: '0.75rem',
  color: '#94a3b8',
};

const sectionPanelStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '20px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

export default ApplicationAnalytics;