const { fireEvent, render, screen } = require('@testing-library/react');

jest.mock('./ProfilePicture', () => function MockProfilePicture() {
  return <div>Profile picture control</div>;
});
jest.mock('./ResumeManager', () => function MockResumeManager() {
  return <div>Resume management control</div>;
});

const ProfileView = require('./ProfileView').default;

describe('ProfileView', () => {
  it('renders profile information, media controls, and navigation callbacks', () => {
    const onEdit = jest.fn();
    const onBack = jest.fn();
    render(
      <ProfileView
        user={{ name: 'Jane Doe', email: 'jane@example.com', role: 'job_seeker', location: 'Montreal', bio: 'Engineer' }}
        onEdit={onEdit}
        onBack={onBack}
      />,
    );

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Job Seeker')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Montreal')).toBeInTheDocument();
    expect(screen.getByText('Engineer')).toBeInTheDocument();
    expect(screen.getByText('Profile picture control')).toBeInTheDocument();
    expect(screen.getByText('Resume management control')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows fallback values when profile fields are absent', () => {
    render(<ProfileView user={{}} onEdit={jest.fn()} onBack={jest.fn()} />);

    expect(screen.getByText('Unnamed User')).toBeInTheDocument();
    expect(screen.getByText('No bio provided')).toBeInTheDocument();
    expect(screen.getAllByText('Not provided')).toHaveLength(3);
  });
});
