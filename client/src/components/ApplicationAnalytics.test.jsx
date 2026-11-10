// SCRUM-278: Unit tests for the job seeker analytics panel
// (PR #52 – SCRUM-318 Job Seeker Application Analytics).
const { render, screen } = require('@testing-library/react');

const ApplicationAnalytics = require('./ApplicationAnalytics').default;

function application(status, createdAt = '2026-11-15T12:00:00.000Z') {
  return { _id: `${status}-${createdAt}`, status, createdAt };
}

// The big number shown under a metric card's label
function cardValue(label) {
  return screen.getByText(label).nextSibling.textContent;
}

function legendEntry(status) {
  return screen.getByText(status, { selector: 'strong' }).parentElement.textContent;
}

describe('ApplicationAnalytics', () => {
  const applications = [
    application('Applied', '2026-11-15T12:00:00.000Z'),
    application('Interview', '2026-11-16T12:00:00.000Z'),
    application('Rejected', '2026-10-15T12:00:00.000Z'),
    application('Offered', '2026-10-16T12:00:00.000Z'),
    application('Offer Declined', '2026-09-15T12:00:00.000Z'),
  ];

  it('renders nothing when there are no applications', () => {
    const { container } = render(<ApplicationAnalytics applications={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('counts total, active and offered applications', () => {
    render(<ApplicationAnalytics applications={applications} />);

    expect(cardValue('Total Applications')).toBe('5');
    expect(cardValue('Active in Pipeline')).toBe('2'); // Applied + Interview
    expect(cardValue('Offers Extended')).toBe('1');
  });

  it('treats "Under Review" and "Interview" as active in the pipeline', () => {
    render(
      <ApplicationAnalytics
        applications={[application('Under Review'), application('Interview'), application('Rejected')]}
      />
    );

    expect(cardValue('Active in Pipeline')).toBe('2');
  });

  it('calculates the response rate from applications that got past "Applied"', () => {
    render(<ApplicationAnalytics applications={applications} />);

    // 4 of 5 applications have moved past "Applied"
    expect(cardValue('Response Rate')).toBe('80%');
  });

  it('shows a 0% response rate when nothing has been answered yet', () => {
    render(<ApplicationAnalytics applications={[application('Applied'), application('Applied')]} />);

    expect(cardValue('Response Rate')).toBe('0%');
  });

  it('leaves withdrawn (Cancelled) applications out of the response rate', () => {
    render(
      <ApplicationAnalytics
        applications={[application('Applied'), application('Cancelled'), application('Interview'), application('Offered')]}
      />
    );

    // 2 responded (Interview, Offered) out of 4 total
    expect(cardValue('Response Rate')).toBe('50%');
  });

  it('breaks the applications down by status with counts and percentages', () => {
    render(<ApplicationAnalytics applications={applications} />);

    expect(legendEntry('Applied')).toBe('Applied: 1 (20%)');
    expect(legendEntry('Interview')).toBe('Interview: 1 (20%)');
    expect(legendEntry('Offer Declined')).toBe('Offer Declined: 1 (20%)');
  });

  it('groups applications by month, oldest month first', () => {
    render(<ApplicationAnalytics applications={applications} />);

    const months = screen.getAllByText(/^(Sep|Oct|Nov) 2026$/).map((el) => el.textContent);
    expect(months).toEqual(['Sep 2026', 'Oct 2026', 'Nov 2026']);
    expect(screen.getByTitle('2 applications in Nov 2026')).toBeInTheDocument();
    expect(screen.getByTitle('1 applications in Sep 2026')).toBeInTheDocument();
  });
});