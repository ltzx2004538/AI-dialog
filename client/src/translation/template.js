// Fills {name} placeholders. Kept apart from index.jsx (which needs React) so it can be tested in plain Node.
export function fillTemplate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

// Like fillTemplate, but a param may be a React element (e.g. a highlighted number), so the result is
// a list of parts instead of one string: text and params in order, unknown placeholders left as text.
export function splitTemplate(template, params = {}) {
  return template
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      return name && name in params ? params[name] : part;
    });
}
