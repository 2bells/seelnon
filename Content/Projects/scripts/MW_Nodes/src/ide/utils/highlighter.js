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
  'do', 'return', 'in', 'and', 'or', 'not', 'require', 'nil', 'true', 'false', 'repeat', 'until',
  'random', 'randomFloat', 'toInt', 'toFloat', 'toBool', 'tostring', 'toVector3', 'math', 'self', 'guid', 'get',
  'cos', 'sin', 'tan', 'sqrt', 'acos', 'asin', 'atan', 'abs', 'deg', 'rad', 'min', 'max', 'clamp', 'floor', 'ceil', 'round', 'trunc', 'pi'
]);

const LUA_TYPES = new Set([
  'int', 'integer', 'string', 'bool', 'boolean', 'float', 'vector3', 'entity', 'list', 'dict'
]);

const LUA_RE = new RegExp(
  '(' +
    '--[^\\n]*' +
  ')|(' +
    "'(?:\\\\.|[^'\\\\\\n])*'|\"(?:\\\\.|[^\"\\\\\\n])*\"" +
  ')|(' +
    '\\b\\d+(?:\\.\\d+)?\\b' +
  ')|(' +
    '\\b(?:local|function|end|if|then|else|elseif|for|while|do|return|in|and|or|not|require|repeat|until|nil|true|false|random|randomFloat|toInt|toFloat|toBool|tostring|toVector3|math|self|guid|get|int|integer|string|bool|boolean|float|vector3|entity|list|dict|cos|sin|tan|sqrt|acos|asin|atan|abs|deg|rad|min|max|clamp|floor|ceil|round|trunc|pi)\\b' +
  ')|(' +
    '[A-Za-z_][\\w]*' +
  ')',
  'g'
);

// Comments: render clean comments without intrusive box badges
function renderLuaComment(text) {
  return `<span class="tok-com">${esc(text)}</span>`;
}

function classifyLuaIdent(word, nextChar, prevToken, prevPunc) {
  // If following `guid.` (e.g. `guid.boss`, `guid.1`), color the entity parent as purple/keyword
  if (prevToken === 'guid' && prevPunc === '.') {
    return 'tok-kw';
  }
  if (['toInt', 'toFloat', 'toBool', 'tostring', 'toVector3', 'random', 'randomFloat', 'cos', 'sin', 'tan', 'sqrt', 'acos', 'asin', 'atan', 'abs', 'deg', 'rad', 'min', 'max', 'clamp', 'floor', 'ceil', 'round', 'trunc'].includes(word)) {
    return 'tok-fn';
  }
  if (word === 'pi' || word === 'PI') {
    return 'tok-kw';
  }
  if (LUA_TYPES.has(word)) return 'tok-type';
  if (LUA_KEYWORDS.has(word)) return 'tok-kw';
  if (nextChar === '(' || (prevToken === 'f' && prevPunc === '.') || (prevToken === 'math' && prevPunc === '.')) return 'tok-fn';
  return 'tok-var';
}

export function highlightLua(code) {
  let html = '';
  let idx = 0;
  LUA_RE.lastIndex = 0;
  let m;
  let lastWord = '';
  let lastPunc = '';

  while ((m = LUA_RE.exec(code)) !== null) {
    const plainBetween = code.slice(idx, m.index);
    if (plainBetween) {
      const trimmed = plainBetween.trim();
      if (trimmed === '.') lastPunc = '.';
      else if (trimmed) lastPunc = trimmed[trimmed.length - 1];
    }
    html += renderPlain(plainBetween);

    const com = m[1];
    if (com) {
      html += renderLuaComment(com);
      idx = m.index + com.length;
      lastWord = '';
      lastPunc = '';
      continue;
    }

    const str = m[2];
    if (str) {
      html += `<span class="tok-str">${esc(str)}</span>`;
      idx = m.index + str.length;
      lastWord = '';
      lastPunc = '';
      continue;
    }

    const num = m[3];
    if (num) {
      // If following `guid.` (e.g. `guid.1`), highlight as entity parent (purple)
      if (lastWord === 'guid' && lastPunc === '.') {
        html += `<span class="tok-kw">${esc(num)}</span>`;
      } else {
        html += `<span class="tok-num">${esc(num)}</span>`;
      }
      idx = m.index + num.length;
      lastWord = num;
      lastPunc = '';
      continue;
    }

    const kw = m[4];
    if (kw) {
      const next = code[m.index + kw.length] || '';
      const cls = classifyLuaIdent(kw, next, lastWord, lastPunc);
      html += `<span class="${cls}">${esc(kw)}</span>`;
      idx = m.index + kw.length;
      lastWord = kw;
      lastPunc = '';
      continue;
    }

    const ident = m[5];
    if (ident) {
      const next = code[m.index + ident.length] || '';
      const cls = classifyLuaIdent(ident, next, lastWord, lastPunc);
      html += `<span class="${cls}">${esc(ident)}</span>`;
      idx = m.index + ident.length;
      lastWord = ident;
      lastPunc = '';
      continue;
    }
  }
  html += renderPlain(code.slice(idx));
  return html;
}