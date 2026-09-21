import { useEffect } from "react";

export default function JsonModal({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [data, onClose]);

  if (!data) return null;

  return (
    <div className="json-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="json-modal" role="dialog" aria-modal="true" aria-labelledby="json-modal-title" onMouseDown={(e)=>e.stopPropagation()}>
        <header>
          <div>
            <span className="json-modal-kicker">EVENT PAYLOAD</span>
            <h2 id="json-modal-title">Código JSON</h2>
          </div>
          <button className="json-modal-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <pre><code>{JSON.stringify(data, null, 2)}</code></pre>
        <footer>
          <button type="button" onClick={()=>navigator.clipboard?.writeText(JSON.stringify(data, null, 2))}>Copiar JSON</button>
          <button className="primary" type="button" onClick={onClose}>Cerrar</button>
        </footer>
      </section>
    </div>
  );
}
