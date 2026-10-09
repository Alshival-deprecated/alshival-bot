import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function ResponsiveInspector({ active, close, children }: { active: boolean; close: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1200px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1200px)');
    const changed = () => setWide(media.matches);
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (node.open) node.close();
    if (active) node.showModal();
  }, [wide, active]);
  if (wide) return <aside className="sl-inspector sl-details-panel" aria-label="Device and port details">{children}</aside>;
  return <dialog ref={dialog} className="sl-inspector sl-details-panel" aria-label="Device and port details" onCancel={event => { event.preventDefault(); close(); }}>
    <button className="sl-close-details" onClick={close} autoFocus>Close details</button>
    {children}
  </dialog>;
}
