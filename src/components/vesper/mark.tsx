import { useEffect } from "react";
import { useVesperStore } from "@/lib/vesper/store";

export function VesperMark() {
  const id = useVesperStore((s) => s.focus.highlightId);
  const label = useVesperStore((s) => s.focus.highlightLabel);
  const nonce = useVesperStore((s) => s.focus.nonce);
  const caption = useVesperStore((s) => s.caption);

  useEffect(() => {
    let tries = 0;
    const apply = () => {
      document.querySelectorAll("[data-vesper-on]").forEach((el) => {
        el.removeAttribute("data-vesper-on");
      });
      if (!id) return true;
      const node = document.querySelector(`[data-vesper="${id}"]`);
      if (!node) return false;
      node.setAttribute("data-vesper-on", "1");
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    };
    if (apply()) return;
    const t = window.setInterval(() => {
      tries += 1;
      if (apply() || tries > 20) window.clearInterval(t);
    }, 80);
    return () => window.clearInterval(t);
  }, [id, nonce]);

  const text = caption || label;
  if (!id || !text) return null;
  return (
    <div className="pointer-events-none fixed top-[calc(var(--height-status)+0.75rem)] left-1/2 z-40 max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md bg-elevated/95 px-3 py-1.5 text-2xs text-fg shadow-[var(--shadow-border)] lg:left-[calc(var(--width-sidebar)+50%)]">
      {text}
    </div>
  );
}
