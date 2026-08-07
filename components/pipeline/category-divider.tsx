export default function CategoryDivider({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <span className="text-[10px] font-medium text-muted-foreground">
        {name}
      </span>
      <div className="flex-1 border-t border-dashed border-border/60" />
    </div>
  );
}
