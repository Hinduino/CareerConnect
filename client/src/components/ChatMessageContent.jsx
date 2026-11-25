function isWhitespace(character) {
  return typeof character === 'string' && character !== '' && character.trim() === '';
}

function getHeadingTitle(text) {
  let markerEnd = 0;
  while (markerEnd < 3 && text[markerEnd] === '#') markerEnd += 1;
  if (markerEnd > 0 && isWhitespace(text[markerEnd])) {
    let titleStart = markerEnd;
    while (isWhitespace(text[titleStart])) titleStart += 1;
    return text.slice(titleStart) || null;
  }

  const colonIndex = text.indexOf(':');
  const firstCharacter = text.charCodeAt(0);
  if (
    firstCharacter >= 65
    && firstCharacter <= 90
    && colonIndex === text.length - 1
    && colonIndex >= 1
    && colonIndex <= 41
  ) {
    return text.slice(0, colonIndex);
  }
  return null;
}

function getBulletItem(text) {
  if (text[0] !== '-' && text[0] !== '*') return null;

  let itemStart = 1;
  if (!isWhitespace(text[itemStart])) return null;
  while (isWhitespace(text[itemStart])) itemStart += 1;
  return text.slice(itemStart) || null;
}

function getNumberedItem(text) {
  let markerEnd = 0;
  while (text[markerEnd] >= '0' && text[markerEnd] <= '9') markerEnd += 1;
  if (markerEnd === 0 || (text[markerEnd] !== '.' && text[markerEnd] !== ')')) return null;

  let itemStart = markerEnd + 1;
  if (!isWhitespace(text[itemStart])) return null;
  while (isWhitespace(text[itemStart])) itemStart += 1;
  return text.slice(itemStart) || null;
}

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
    const heading = getHeadingTitle(trimmed);
    const bullet = getBulletItem(trimmed);
    const numbered = getNumberedItem(trimmed);
    const quote = trimmed.match(/^>\s?(.+)$/);
    const itemType = bullet ? 'unordered' : numbered ? 'ordered' : null;

    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`heading-${blocks.length}`}>
          {renderInlineContent(heading, `heading-${blocks.length}`)}
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
      list.push(bullet || numbered);
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
