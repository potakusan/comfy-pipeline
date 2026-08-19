import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Layers,
  MessageSquare,
  Settings2,
  Tag,
  Users,
  Pin,
  User,
  Hash,
  Move,
  MapPin,
  Star,
  AlignLeft,
  MinusCircle,
  Shuffle,
} from "lucide-react";

export type LeftSectionId =
  | "lora"
  | "prompt"
  | "sampler"
  | "variation"
  | "tagdb"
  | "couple-top"
  | "p-fixed"
  | "p-physical"
  | "p-count"
  | "p-pose"
  | "p-scene"
  | "p-other"
  | "p-add"
  | "p-neg";

type NavItem = {
  id: LeftSectionId;
  icon: React.ElementType;
  label: string;
  sub?: boolean;
};

const NORMAL_NAV: NavItem[] = [
  { id: "lora", icon: Layers, label: "LoRA設定" },
  { id: "prompt", icon: MessageSquare, label: "プロンプト" },
  { id: "p-fixed", icon: Pin, label: "固定タグ", sub: true },
  { id: "p-physical", icon: User, label: "身体的特徴", sub: true },
  { id: "p-count", icon: Hash, label: "人数", sub: true },
  { id: "p-pose", icon: Move, label: "ポーズ", sub: true },
  { id: "p-scene", icon: MapPin, label: "シーン", sub: true },
  { id: "p-other", icon: Star, label: "その他", sub: true },
  { id: "p-add", icon: AlignLeft, label: "追加プロンプト", sub: true },
  { id: "p-neg", icon: MinusCircle, label: "ネガティブ", sub: true },
  { id: "sampler", icon: Settings2, label: "サンプラー設定" },
  { id: "variation", icon: Shuffle, label: "ランダム構図" },
  { id: "tagdb", icon: Tag, label: "タグDB設定" },
];

const COUPLE_NAV: NavItem[] = [
  { id: "couple-top", icon: Users, label: "マルチキャラ設定" },
];

export default function LeftIconNav({
  activeTab,
  onScrollTo,
}: {
  activeTab: "normal" | "couple";
  onScrollTo: (id: LeftSectionId) => void;
}) {
  const items = activeTab === "normal" ? NORMAL_NAV : COUPLE_NAV;
  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex w-10 shrink-0 flex-col border-r bg-background py-1">
        {items.map(({ id, icon: Icon, label, sub }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onScrollTo(id)}
                className={`flex w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground ${
                  sub ? "h-7 pl-1.5" : "h-10"
                }`}
              >
                <Icon className={sub ? "h-3 w-3" : "h-4 w-4"} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
