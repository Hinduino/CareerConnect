function renderInlineContent(text, keyPrefix) {
  const markdownToken = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  return text.split(markdownToken).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${keyPrefix}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function ChatMessageContent({ content }) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let listType = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(' ');
      blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInlineContent(text, `paragraph-${blocks.length}`)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const List = listType === 'ordered' ? 'ol' : 'ul';
      blocks.push(
        <List key={`list-${blocks.length}`}>
          {list.map((item, index) => (
            <li key={index}>{renderInlineContent(item, `list-${blocks.length}-${index}`)}</li>
          ))}
        </List>
      );
      list = [];
      listType = null;
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const heading = trimmed.match(/^#{1,3}\s+(.+)$|^([A-Z][^:]{0,40}):$/);
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const quote = trimmed.match(/^>\s?(.+)$/);
    const itemType = bullet ? 'unordered' : numbered ? 'ordered' : null;

    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      const title = heading[1] || heading[2];
      blocks.push(
        <h3 key={`heading-${blocks.length}`}>
          {renderInlineContent(title, `heading-${blocks.length}`)}
        </h3>
      );
    } else if (quote) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote key={`quote-${blocks.length}`}>
          {renderInlineContent(quote[1], `quote-${blocks.length}`)}
        </blockquote>
      );
    } else if (itemType) {
      flushParagraph();
      if (listType && listType !== itemType) flushList();
      listType = itemType;
      list.push((bullet || numbered)[1]);
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  });

  flushParagraph();
  flushList();
  return <div className="chatbot-response-content">{blocks}</div>;
}

export default ChatMessageContent;
