import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import { openExternal } from '../api/client';

// Register only the languages we care about — keeps the chunk lean
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import c from 'highlight.js/lib/languages/c';
import csharp from 'highlight.js/lib/languages/csharp';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import scala from 'highlight.js/lib/languages/scala';
import r from 'highlight.js/lib/languages/r';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import elixir from 'highlight.js/lib/languages/elixir';
import lua from 'highlight.js/lib/languages/lua';
import perl from 'highlight.js/lib/languages/perl';
import haskell from 'highlight.js/lib/languages/haskell';
import makefile from 'highlight.js/lib/languages/makefile';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';

hljs.registerLanguage('python', python);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', c);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('r', r);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('elixir', elixir);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('perl', perl);
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('makefile', makefile);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('ini', ini);

// Extension → highlight.js language name
const EXT_LANG: Record<string, string> = {
  py: 'python', pyw: 'python',
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  rs: 'rust',
  go: 'go',
  java: 'java',
  rb: 'ruby', rake: 'ruby', gemspec: 'ruby',
  php: 'php', phtml: 'php',
  cs: 'csharp',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp',
  c: 'c',
  h: 'cpp', hpp: 'cpp',
  swift: 'swift',
  kt: 'kotlin', kts: 'kotlin',
  scala: 'scala', sc: 'scala',
  r: 'r', rmd: 'r',
  sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash',
  sql: 'sql',
  json: 'json', jsonc: 'json',
  yaml: 'yaml', yml: 'yaml',
  xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml', xhtml: 'xml',
  css: 'css', scss: 'css', sass: 'css', less: 'css',
  md: 'markdown', mdx: 'markdown',
  toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
  dockerfile: 'dockerfile',
  lua: 'lua',
  ex: 'elixir', exs: 'elixir',
  pl: 'perl', pm: 'perl',
  hs: 'haskell',
  makefile: 'makefile', mk: 'makefile',
};

function getLanguage(filePath: string): string | null {
  const name = filePath.split('/').pop() ?? filePath;
  // Special whole-filename matches
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile';
  if (name.toLowerCase() === 'makefile') return 'makefile';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? null;
}

interface GitHubFileModalProps {
  htmlUrl: string;
  path: string;
  onClose: () => void;
}

interface FileData {
  content: string;
  raw_lines: string[];
  line_start: number;
  total_lines: number;
  html_url: string;
  blame_url: string;
}

function parseGitHubUrl(htmlUrl: string): { repo: string; ref: string; path: string } | null {
  const m = htmlUrl.match(/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+?)(?:#.*)?$/);
  if (!m) return null;
  return { repo: m[1], ref: m[2], path: m[3] };
}

export function GitHubFileModal({ htmlUrl, path, onClose }: GitHubFileModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseGitHubUrl(htmlUrl);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (!parsed) { setError('Could not parse GitHub URL'); setLoading(false); return; }
    const params = new URLSearchParams({ repo: parsed.repo, path: parsed.path, ref: parsed.ref });
    fetch(`/api/github/file?${params}`)
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d.detail || 'Failed to load')))
      .then((d: FileData) => setFileData(d))
      .catch(e => setError(typeof e === 'string' ? e : 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [htmlUrl]);

  const parts = path.split('/');
  const filename = parts.pop() ?? path;
  const dir = parts.length ? parts.join('/') + '/' : '';

  const blameUrl = fileData?.blame_url ?? (parsed ? `https://github.com/${parsed.repo}/blame/${parsed.ref}/${parsed.path}` : null);
  const ghUrl = fileData?.html_url ?? htmlUrl;

  // Syntax-highlight the raw lines (whole file at once to preserve multi-line spans)
  const lang = getLanguage(path);
  const highlightedHtml = (() => {
    if (!fileData?.raw_lines) return null;
    const code = fileData.raw_lines.join('\n');
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return null;
    }
  })();

  const lineStart = fileData?.line_start ?? 1;
  const lineCount = fileData?.raw_lines?.length ?? 0;

  return (
    <div
      className="meeting-modal-overlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="github-file-modal">
        <div className="github-file-modal-header">
          {dir && <span className="github-code-result-path-dir">{dir}</span>}
          <span className="github-code-result-filename">{filename}</span>
          {lang && <span className="github-file-modal-lang">{lang}</span>}
          {fileData && (
            <span className="github-file-modal-linecount">
              {fileData.total_lines} lines
            </span>
          )}
          <div className="github-file-modal-actions">
            {blameUrl && (
              <a className="github-code-gh-link" href={blameUrl}
                onClick={e => { e.preventDefault(); openExternal(blameUrl); }}
                title="View blame on GitHub">blame</a>
            )}
            <a className="github-code-gh-link" href={ghUrl}
              onClick={e => { e.preventDefault(); openExternal(ghUrl); }}
              title="Open on GitHub">↗ GitHub</a>
            <button className="meeting-modal-close" onClick={onClose}
              style={{ position: 'static', marginLeft: 'var(--space-xs)' }}>
              &times;
            </button>
          </div>
        </div>

        <div className="github-file-modal-body">
          {loading && <div className="github-file-modal-loading">Loading…</div>}
          {error && <div className="github-file-modal-loading">{error}</div>}
          {fileData && (
            <div className="github-file-modal-code-wrap">
              {/* Gutter: line numbers as a plain pre — shares font/line-height with code pre */}
              <pre className="github-file-modal-gutter" aria-hidden>
                {Array.from({ length: lineCount }, (_, i) => lineStart + i).join('\n')}
              </pre>
              {/* Code: highlighted HTML or plain fallback */}
              <pre className="github-file-modal-code hljs">
                {highlightedHtml != null ? (
                  <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                ) : (
                  <code>{fileData.raw_lines.join('\n')}</code>
                )}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
