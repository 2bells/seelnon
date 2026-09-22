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
  'import', 'export', 'from', 'to', 'const', 'let', 'var', 'function', 'return',
  'new', 'if', 'else', 'for', 'while', 'do', 'typeof', 'void', 'delete', 'in',
  'of', 'yield', 'await', 'async', 'class', 'interface', 'type', 'extends',
  'implements', 'public', 'private', 'protected', 'readonly', 'static', 'this',
  'super', 'true', 'false', 'null', 'undefined', 'globalThis', 'break'
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

const PLAIN_RE = /([+\-*/%&=<>!|^~?]+|&&|\|\||===|!==)|([(){}[\];,:.])/g;
const HAS_SPECIAL_RE = /[+\-*/%&=<>!|^~?(){}[\];,;.:]/;

function renderPlain(segment) {
  if (!segment) return '';
  if (!HAS_SPECIAL_RE.test(segment)) {
    return esc(segment);
  }
  let out = '';
  let idx = 0;
  PLAIN_RE.lastIndex = 0;
  let m;
  while ((m = PLAIN_RE.exec(segment)) !== null) {
    if (m.index > idx) {
      out += esc(segment.slice(idx, m.index));
    }
    if (m[1]) {
      out += `<span class="tok-op">${esc(m[1])}</span>`;
    } else if (m[2]) {
      out += `<span class="tok-punc">${esc(m[2])}</span>`;
    }
    idx = m.index + m[0].length;
  }
  if (idx < segment.length) {
    out += esc(segment.slice(idx));
  }
  return out;
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

// High-performance tokenization for Lua in the IDE
const LUA_KEYWORDS = new Set([
  'local', 'function', 'end', 'if', 'then', 'else', 'elseif', 'for', 'while',
  'do', 'from', 'to', 'step', 'by', 'break', 'return', 'in', 'and', 'or', 'not', 'require', 'nil', 'true', 'false', 'repeat', 'until',
  'random', 'randomFloat', 'toInt', 'toFloat', 'toBool', 'tostring', 'toVector3', 'math', 'self', 'guid', 'get',
  'cos', 'sin', 'tan', 'sqrt', 'acos', 'asin', 'atan', 'abs', 'deg', 'rad', 'min', 'max', 'clamp', 'floor', 'ceil', 'round', 'trunc', 'pi'
]);

const LUA_TYPES = new Set([
  'int', 'integer', 'string', 'bool', 'boolean', 'float', 'vector3', 'entity', 'list', 'dict'
]);

const LUA_TOKEN_RE = new RegExp(
  '(' +                       // 1: comments
    '--[^\\n]*' +
  ')|(' +                     // 2: strings
    "'(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\"" +
  ')|(' +                     // 3: numbers
    '\\b\\d+(?:\\.\\d+)?\\b' +
  ')|(' +                     // 4: identifiers / words
    '[A-Za-z_]\\w*' +
  ')',
  'g'
);

function classifyLuaWord(word, nextChar) {
  if (['toInt', 'toFloat', 'toBool', 'tostring', 'toVector3', 'random', 'randomFloat', 'cos', 'sin', 'tan', 'sqrt', 'acos', 'asin', 'atan', 'abs', 'deg', 'rad', 'min', 'max', 'clamp', 'floor', 'ceil', 'round', 'trunc'].includes(word)) {
    return 'tok-fn';
  }
  if (word === 'pi' || word === 'PI') return 'tok-kw';
  if (LUA_TYPES.has(word)) return 'tok-type';
  if (LUA_KEYWORDS.has(word)) return 'tok-kw';
  if (nextChar === '(') return 'tok-fn';
  return 'tok-var';
}

export function highlightLuaLine(line) {
  if (!line) return '';
  let html = '';
  let idx = 0;
  LUA_TOKEN_RE.lastIndex = 0;
  let m;

  while ((m = LUA_TOKEN_RE.exec(line)) !== null) {
    if (m.index > idx) {
      html += esc(line.slice(idx, m.index));
    }
    const com = m[1];
    if (com) {
      html += `<span class="tok-com">${esc(com)}</span>`;
      idx = m.index + com.length;
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
    const word = m[4];
    if (word) {
      const nextChar = line[m.index + word.length] || '';
      const cls = classifyLuaWord(word, nextChar);
      html += `<span class="${cls}">${esc(word)}</span>`;
      idx = m.index + word.length;
      continue;
    }
  }

  if (idx < line.length) {
    html += esc(line.slice(idx));
  }
  return html;
}

export function highlightLua(code) {
  if (!code) return '';
  const lines = code.split('\n');
  return lines.map(l => `<div class="ide-code-line">${highlightLuaLine(l) || '&nbsp;'}</div>`).join('');
}