import { EXAMPLE_ASKS } from "@/lib/vesper/catalog";
import { sendToVesper } from "@/lib/vesper/talk";
import { abortTts } from "@/lib/vesper/tts";
import { cn } from "@/lib/utils";

type Variant = "room" | "rail" | "dock";

export function AskBlocks({ variant = "room" }: { variant?: Variant }) {
  const items = variant === "dock" ? EXAMPLE_ASKS.slice(0, 4) : EXAMPLE_ASKS;

  async function ask(text: string) {
    abortTts();
    await sendToVesper(text, "typed");
  }

  return (
    <div className="w-full" data-vesper="vesper.examples">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void ask(item.text)}
            className={cn(
              "min-h-11 rounded-md bg-elevated px-2.5 py-2 text-left text-xs leading-snug text-fg transition-colors duration-150 hover:shadow-[var(--shadow-border-hover)]",
            )}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  );
}
