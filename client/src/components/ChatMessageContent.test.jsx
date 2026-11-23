const { render, screen } = require('@testing-library/react');
const ChatMessageContent = require('./ChatMessageContent').default;

describe('ChatMessageContent', () => {
  it('renders paragraphs, both heading formats, quotes, and changing ordered and unordered lists', () => {
    render(
      <ChatMessageContent
        content={[
          'Plain paragraph with **bold**, *italic*, and `code`.',
          'A second line in the same paragraph.',
          '',
          'Experience:',
          '1. First item',
          '- Second item',
          '2) Third item',
          '',
          '> A highlighted quote',
          '',
          '## Next steps',
          '* Final bullet',
          'Closing paragraph.',
        ].join('\n')}
      />
    );

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(screen.getByRole('heading', { name: 'Experience' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next steps' })).toBeInTheDocument();
    expect(screen.getByText('A highlighted quote').closest('blockquote')).toBeInTheDocument();
    expect(screen.getAllByRole('list')).toHaveLength(4);
    expect(screen.getByText('Closing paragraph.')).toBeInTheDocument();
  });

  it('renders plain text when there is no formatting', () => {
    render(<ChatMessageContent content="Just a simple answer." />);

    expect(screen.getByText('Just a simple answer.').tagName).toBe('P');
  });

  it('renders an empty response without adding empty blocks', () => {
    const { container } = render(<ChatMessageContent content="" />);

    expect(container.querySelector('.chatbot-response-content').childElementCount).toBe(0);
  });
});
