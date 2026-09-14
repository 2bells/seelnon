/**
 * Tiny self-contained TypeScript tokenizer for the IDE overlay highlighter.
 *
 * Replaces PrismJS. It only decorates the generated genshin-ts code subset
 * (comments, strings/templates, numbers, keywords, identifiers) with zero-width
 * inline spans, so the highlighted overlay renders the EXACT same text as the
 * transparent textarea beneath it - no manual offset tuning needed.
 */

const TOKEN_RE = new RegExp(
  '(' +                       // 1: comments
    '/\\*[\\s\\S]*?\\*/|//[^\\n]*' +
  ')|(' +                     // 2: strings (single/double/template)
    "'(?:\\\\.|[^'\\\\\\n])*'|\"" +
    '(?:\\\\.|[^"\\\\\\n])*"|`(?:\\\\.|[^`\\\\\\n])*`' +
  ')|(' +                     // 3: numbers
    '\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b' +
  ')|(' +                     // 4: keywords
    '\\b(?:import|export|from|const|let|var|function|return|new|if|else|for|while|do|typeof|void|delete|in|of|yield|await|async|class|interface|type|extends|implements|public|private|protected|readonly|static|this|super|true|false|null|undefined|globalThis)\\b' +
  ')|(' +                     // 5: identifiers
    '[A-Za-z_$][\\w$]*' +
  ')',
  'g'
);

const KEYWORD_OF_FN = new Set([
  'import', 'export', 'from', 'const', 'let', 'var', 'function', 'return',
  'new', 'if', 'else', 'for', 'while', 'do', 'typeof', 'void', 'delete', 'in',
  'of', 'yield', 'await', 'async', 'class', 'interface', 'type', 'extends',
  'implements', 'public', 'private', 'protected', 'readonly', 'static', 'this',
  'super', 'true', 'false', 'null', 'undefined', 'globalThis'
]);
const BUILTIN_TYPES = new Set([
  'string', 'number', 'boolean', 'void', 'any', 'unknown', 'never',
  'Array', 'Object', 'String', 'Number', 'Boolean'
]);

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function classifyIdent(word, nextChar) {
  if (KEYWORD_OF_FN.has(word)) return 'tok-kw';
  if (BUILTIN_TYPES.has(word)) return 'tok-type';
  if (nextChar === '(') return 'tok-fn';
  return 'tok-var';
}

function renderPlain(segment) {
  if (!segment) return '';
  // Color operators/structural punctuation outside of strings/comments,
  // but keep member-access dots distinct from decimal handling.
  let out = '';
  const opRe = /([+\-*/%&=<>!|^~?]+|&&|\|\||===|!==)/g;
  const puncRe = /([(){}[\],;:.])/g;
  let idx = 0;
  opRe.lastIndex = 0;
  let m;
  while ((m = opRe.exec(segment)) !== null) {
    out += esc(segment.slice(idx, m.index));
    out += `<span class="tok-op">${esc(m[1])}</span>`;
    idx = m.index + m[1].length;
  }
  out += esc(segment.slice(idx));
  // Now color punctuation in a separate pass over the escaped output
  let plain = out, done = '';
  let i = 0; puncRe.lastIndex = 0; let pm;
  while ((pm = puncRe.exec(plain)) !== null) {
    done += plain.slice(i, pm.index);
    done += `<span class="tok-punc">${esc(pm[1])}</span>`;
    i = pm.index + pm[1].length;
  }
  done += plain.slice(i);
  return done;
}

export function highlightTs(code) {
  let html = '';
  let idx = 0;
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    html += renderPlain(code.slice(idx, m.index));
    const comment = m[1];
    if (comment) {
      html += `<span class="tok-com">${esc(comment)}</span>`;
      idx = m.index + comment.length;
      continue;
    }
    const str = m[2];
    if (str) {
      html += `<span class="tok-str">${esc(str)}</span>`;
      idx = m.index + str.length;
      continue;
    }
    const num = m[3];
    if (num) {
      html += `<span class="tok-num">${esc(num)}</span>`;
      idx = m.index + num.length;
      continue;
    }
    const kw = m[4];
    if (kw) {
      html += `<span class="tok-kw">${esc(kw)}</span>`;
      idx = m.index + kw.length;
      continue;
    }
    const ident = m[5];
    const nextChar = code[m.index + ident.length] || '';
    const cls = classifyIdent(ident, nextChar);
    html += `<span class="${cls}">${esc(ident)}</span>`;
    idx = m.index + ident.length;
  }
  html += renderPlain(code.slice(idx));
  return html;
}

const LUA_KEYWORDS = new Set([
  'local', 'function', 'end', 'if', 'then', 'else', 'elseif', 'for', 'while',
  'do', 'return', 'in', 'and', 'or', 'not', 'require', 'nil', 'true', 'false', 'repeat', 'until'
]);

const LUA_RE = new RegExp(
  '(' +
    '--[^\\n]*' +
  ')|(' +
    "'(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\"" +
  ')|(' +
    '\\b\\d+(?:\\.\\d+)?\\b' +
  ')|(' +
    '\\b(?:local|function|end|if|then|else|elseif|for|while|do|return|in|and|or|not|require|repeat|until|nil|true|false)\\b' +
  ')|(' +
    '[A-Za-z_][\\w]*' +
  ')',
  'g'
);

// Comments may carry a machine "stamp" (`-- @id`). Render the `@id` bit as a
// faint meta token so it reads as book-keeping, not as something to edit.
function renderLuaComment(text) {
  const m = /@([A-Za-z0-9_:.\-]+)/.exec(text);
  if (!m) return `<span class="tok-com">${esc(text)}</span>`;
  const before = text.slice(0, m.index);
  const id = m[0];
  const after = text.slice(m.index + m[0].length);
  return (
    (before ? `<span class="tok-com">${esc(before)}</span>` : '') +
    `<span class="tok-meta">${esc(id)}</span>` +
    (after ? `<span class="tok-com">${esc(after)}</span>` : '')
  );
}

function classifyLuaIdent(word, nextChar) {
  if (LUA_KEYWORDS.has(word)) return 'tok-kw';
  if (nextChar === '(') return 'tok-fn';
  return 'tok-var';
}

export function highlightLua(code) {
  let html = '';
  let idx = 0;
  LUA_RE.lastIndex = 0;
  let m;
  while ((m = LUA_RE.exec(code)) !== null) {
    html += renderPlain(code.slice(idx, m.index));
    const com = m[1];
    if (com) { html += renderLuaComment(com); idx = m.index + com.length; continue; }
    const str = m[2];
    if (str) { html += `<span class="tok-str">${esc(str)}</span>`; idx = m.index + str.length; continue; }
    const num = m[3];
    if (num) { html += `<span class="tok-num">${esc(num)}</span>`; idx = m.index + num.length; continue; }
    const kw = m[4];
    if (kw) { html += `<span class="tok-kw">${esc(kw)}</span>`; idx = m.index + kw.length; continue; }
    const ident = m[5];
    const next = code[m.index + ident.length] || '';
    html += `<span class="${classifyLuaIdent(ident, next)}">${esc(ident)}</span>`;
    idx = m.index + ident.length;
  }
  html += renderPlain(code.slice(idx));
  return html;
}