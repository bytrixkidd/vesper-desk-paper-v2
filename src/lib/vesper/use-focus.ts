import { useEffect } from "react";
import { useVesperStore } from "./store";
import type { VesperFocus } from "./types";

export function useVesperFocus(on: (focus: VesperFocus) => void, deps: unknown[] = []) {
  const focus = useVesperStore((s) => s.focus);
  useEffect(() => {
    on(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.nonce, ...deps]);
  return focus;
}
