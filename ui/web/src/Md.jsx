import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// react-markdown no renderiza HTML crudo: seguro para contenido de archivos y salida del agente.
export default function Md({ children }) {
  if (!children) return <p className="muted">Sin contenido todavía.</p>;
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer noopener" /> }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
