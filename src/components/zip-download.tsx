import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CODE_ZIP_HINT, CODE_ZIP_HREF, CODE_ZIP_NAME } from "@/lib/code-zip";
import { cn } from "@/lib/utils";

export function ZipDownload({
  size = "lg",
  className,
  label = "Jetzt herunterladen",
}: {
  size?: "sm" | "lg";
  className?: string;
  label?: string;
}) {
  const [clicked, setClicked] = useState(false);
  return (
    <div className={cn("space-y-2", className)}>
      <Button asChild size={size} variant="default">
        <a
          href={CODE_ZIP_HREF}
          download={CODE_ZIP_NAME}
          onClick={() => {
            setClicked(true);
            toast.message("Suche in Downloads nach Vesper-Paper-Code.zip");
          }}
        >
          <Download />
          {label}
        </a>
      </Button>
      <p className="text-xs leading-relaxed text-muted">{clicked ? CODE_ZIP_HINT : "Nach dem Klick: Ordner Downloads, Datei Vesper-Paper-Code.zip."}</p>
    </div>
  );
}
