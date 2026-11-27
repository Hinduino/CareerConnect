// SCRUM-373: Unit tests for the shared job posting form used by the recruiter
// dashboard, focusing on the optional Application Due Date field (SCRUM-372).
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JobPostingForm from './JobPostingForm';

const existingJob = {
  title: 'Frontend Developer',
  company: 'Acme Corp',
  location: 'Remote',
  category: 'Engineering',
  description: 'Build UIs.',
  requirements: 'React',
  dueDate: '2026-12-15T00:00:00.000Z',
};

function renderForm(props = {}) {
  const onSubmit = props.onSubmit || jest.fn().mockResolvedValue(undefined);
  const onCancel = jest.fn();
  render(
    <JobPostingForm
      initialValues={props.initialValues}
      onSubmit={onSubmit}
      onCancel={onCancel}
      submitLabel="Save Posting"
    />
  );
  return { onSubmit, onCancel };
}

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'QA Tester' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Acme Corp' } });
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Toronto' } });
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Engineering' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Test the app.' } });
  fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: 'Attention to detail' } });
}

describe('JobPostingForm due date', () => {
  it('shows an optional, empty date field for a new posting', () => {
    renderForm();

    const dueDate = screen.getByLabelText('Application Due Date (Optional)');
    expect(dueDate).toHaveAttribute('type', 'date');
    expect(dueDate).not.toBeRequired();
    expect(dueDate).toHaveValue('');
  });

  it('sends the picked due date with the rest of the posting', async () => {
    const { onSubmit } = renderForm();
    fillRequiredFields();

    fireEvent.change(screen.getByLabelText('Application Due Date (Optional)'), {
      target: { value: '2026-12-20' },
    });
    fireEvent.click(screen.getByText('Save Posting'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'QA Tester',
        company: 'Acme Corp',
        location: 'Toronto',
        category: 'Engineering',
        description: 'Test the app.',
        requirements: 'Attention to detail',
        dueDate: '2026-12-20',
      })
    );
  });

  it('sends an empty due date when the field is left blank', async () => {
    const { onSubmit } = renderForm();
    fillRequiredFields();

    fireEvent.click(screen.getByText('Save Posting'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueDate: '' })));
  });

  it('fills in the saved due date when editing a posting', () => {
    renderForm({ initialValues: existingJob });

    expect(screen.getByLabelText('Job Title')).toHaveValue('Frontend Developer');
    expect(screen.getByLabelText('Application Due Date (Optional)')).toHaveValue('2026-12-15');
  });

  it('leaves the date empty when the saved due date is missing or invalid', () => {
    renderForm({ initialValues: { ...existingJob, dueDate: 'not-a-date' } });

    expect(screen.getByLabelText('Application Due Date (Optional)')).toHaveValue('');
  });

  it('lets the recruiter remove the due date when editing', async () => {
    const { onSubmit } = renderForm({ initialValues: existingJob });

    fireEvent.change(screen.getByLabelText('Application Due Date (Optional)'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save Posting'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Frontend Developer', dueDate: '' }))
    );
  });
});

describe('JobPostingForm saving', () => {
  it('shows the server error, such as an invalid due date, and keeps the form open', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('dueDate must be a valid date'));
    renderForm({ initialValues: existingJob, onSubmit });

    fireEvent.click(screen.getByText('Save Posting'));

    expect(await screen.findByText('dueDate must be a valid date')).toBeInTheDocument();
    expect(screen.getByText('Save Posting')).not.toBeDisabled();
  });

  it('disables the buttons while saving', async () => {
    let finishSaving;
    const onSubmit = jest.fn(() => new Promise((resolve) => { finishSaving = resolve; }));
    renderForm({ initialValues: existingJob, onSubmit });

    fireEvent.click(screen.getByText('Save Posting'));

    expect(await screen.findByText('Saving...')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
    finishSaving();
    expect(await screen.findByText('Save Posting')).not.toBeDisabled();
  });

  it('calls onCancel without submitting', () => {
    const { onSubmit, onCancel } = renderForm({ initialValues: existingJob });

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
