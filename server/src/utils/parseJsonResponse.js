function parseJsonResponse(content, errorMessage) {
  try {
    return JSON.parse(content);
  } catch {
    const objectStart = content.indexOf("{");
    let objectEnd = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = objectStart; objectStart >= 0 && index < content.length; index += 1) {
      const character = content[index];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
      } else if (character === '"') {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          objectEnd = index + 1;
          break;
        }
      }
    }

    try {
      if (objectStart < 0 || objectEnd < 0) {
        throw new Error();
      }
      return JSON.parse(content.slice(objectStart, objectEnd));
    } catch {
      throw new Error(errorMessage);
    }
  }
}

module.exports = parseJsonResponse;
