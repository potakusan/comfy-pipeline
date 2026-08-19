import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ConfigSection({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card/30 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          id={`toggle-${title}`}
        />
        <Label
          htmlFor={`toggle-${title}`}
          className="cursor-pointer text-sm font-semibold"
        >
          {title}
        </Label>
      </div>
      {enabled && <div className="space-y-3">{children}</div>}
    </div>
  );
}
