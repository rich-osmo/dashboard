import ReactMarkdown from 'react-markdown';

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
