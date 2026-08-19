"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/common/app-header";
import DatasetSidebar from "@/components/lora-dataset/dataset-sidebar";
import DanbooruSearchPanel from "@/components/lora-dataset/danbooru-search-panel";
import SearchResultGrid from "@/components/lora-dataset/search-result-grid";
import DatasetImageGrid from "@/components/lora-dataset/dataset-image-grid";
import DatasetTagFilter, { type TagFilterState } from "@/components/lora-dataset/dataset-tag-filter";
import BulkTagAddBar from "@/components/lora-dataset/bulk-tag-add-bar";
import ImageTagEditorDialog from "@/components/lora-dataset/image-tag-editor-dialog";
import RemoteSyncButton from "@/components/lora-dataset/remote-sync-button";
import KohyaTrainModal from "@/components/lora-dataset/kohya-train-modal";
import AddFromUrlPanel from "@/components/lora-dataset/add-from-url-panel";
import { apiFetch } from "@/lib/api-client";
import { captionTags, formatTag } from "@/lib/lora-dataset/caption-format";
import type { DanbooruPost, DanbooruRating, DatasetImageEntry, DatasetInfo, TagCategory } from "@/lib/lora-dataset/types";
import type { SetupConfig } from "@/lib/setup/config";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SEARCH_LIMIT = 50;

export default function LoraDatasetPage() {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [images, setImages] = useState<DatasetImageEntry[]>([]);
  const [searchResults, setSearchResults] = useState<DanbooruPost[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<{ tags: string; rating: DanbooruRating | "" } | null>(null);
  const [searchPage, setSearchPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [editingImage, setEditingImage] = useState<DatasetImageEntry | null>(null);
  const [remoteConfigured, setRemoteConfigured] = useState(false);
  const [tagFilters, setTagFilters] = useState<Record<string, TagFilterState>>({});
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.folder === selectedFolder) ?? null,
    [datasets, selectedFolder],
  );

  const loadDatasets = useCallback(async () => {
    const { datasets } = await apiFetch<{ datasets: DatasetInfo[] }>("/api/lora-dataset/folders");
    setDatasets(datasets);
    return datasets;
  }, []);

  const loadImages = useCallback(async (folder: string) => {
    const { images } = await apiFetch<{ images: DatasetImageEntry[] }>(
      `/api/lora-dataset/images?folder=${encodeURIComponent(folder)}`,
    );
    setImages(images);
  }, []);

  useEffect(() => {
    loadDatasets().then((list) => {
      if (list.length > 0) setSelectedFolder((prev) => prev ?? list[0].folder);
    });
    apiFetch<{ config: SetupConfig }>("/api/settings")
      .then(({ config }) => setRemoteConfigured(!!config.remoteProcessUrl))
      .catch(() => {});
  }, [loadDatasets]);

  useEffect(() => {
    if (selectedFolder) loadImages(selectedFolder);
    else setImages([]);
    setTagFilters({});
    setHoveredTag(null);
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [selectedFolder, loadImages]);

  const addedIds = useMemo(() => new Set(images.map((i) => i.manifest.danbooruId)), [images]);

  const imageTags = useMemo(() => {
    const map = new Map<number, Set<string>>();
    if (!selectedDataset) return map;
    for (const image of images) map.set(image.id, new Set(captionTags(selectedDataset, image.manifest)));
    return map;
  }, [images, selectedDataset]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tags of imageTags.values()) {
      for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [imageTags]);

  // タグ編集でカウントが0になった(=どの画像にも付いていない)タグのフィルタは、
  // 表示上バッジが消えて解除できなくなる(0件のまま固まる)のを防ぐため無視する。
  const filteredImages = useMemo(() => {
    const existingTags = new Set(tagCounts.map((t) => t.tag));
    const entries = Object.entries(tagFilters).filter(([tag]) => existingTags.has(tag));
    if (entries.length === 0) return images;
    return images.filter((image) => {
      const tags = imageTags.get(image.id) ?? new Set<string>();
      return entries.every(([tag, state]) => (state === "include" ? tags.has(tag) : !tags.has(tag)));
    });
  }, [images, imageTags, tagFilters, tagCounts]);

  const handleToggleTag = (tag: string) => {
    setTagFilters((prev) => {
      const next = { ...prev };
      const cur = prev[tag];
      if (!cur) next[tag] = "include";
      else if (cur === "include") next[tag] = "exclude";
      else delete next[tag];
      return next;
    });
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  };

  const handleToggleSelectImage = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApplyTag = async (rawTag: string) => {
    if (!selectedDataset) return;
    const tag = formatTag(rawTag.trim());
    if (!tag || selectedIds.size === 0) return;

    const targets = images.filter(
      (img) => selectedIds.has(img.id) && !imageTags.get(img.id)?.has(tag),
    );
    if (targets.length === 0) {
      toast.info("選択した画像には既に全て付いています");
      return;
    }

    setBulkApplying(true);
    try {
      await Promise.all(
        targets.map((img) =>
          apiFetch("/api/lora-dataset/images", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              folder: selectedDataset.folder,
              id: String(img.id),
              removedTags: img.manifest.removedTags.filter((t) => t !== tag),
              extraTags: [...img.manifest.extraTags, tag],
            }),
          }),
        ),
      );
      await loadImages(selectedDataset.folder);
      setSelectedIds(new Set());
      toast.success(`「${tag}」を${targets.length}件の画像に追加しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "一括適用に失敗しました");
    } finally {
      setBulkApplying(false);
    }
  };

  const handleCreate = async (input: {
    name: string;
    repeat: number;
    triggerWord: string;
    includeCategories: TagCategory[];
  }): Promise<string | null> => {
    try {
      const { dataset } = await apiFetch<{ dataset: DatasetInfo }>("/api/lora-dataset/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await loadDatasets();
      setSelectedFolder(dataset.folder);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "作成に失敗しました";
    }
  };

  const handleUpdateDataset = async (
    folder: string,
    input: { name: string; repeat: number; triggerWord: string; includeCategories: TagCategory[] },
  ): Promise<string | null> => {
    try {
      const { dataset } = await apiFetch<{ dataset: DatasetInfo }>("/api/lora-dataset/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, ...input }),
      });
      await loadDatasets();
      if (selectedFolder === folder) setSelectedFolder(dataset.folder);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "更新に失敗しました";
    }
  };

  const handleDeleteDataset = async (folder: string) => {
    if (!confirm("このデータセットを削除しますか？画像・キャプションも全て削除されます。")) return;
    try {
      await apiFetch("/api/lora-dataset/folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const list = await loadDatasets();
      if (selectedFolder === folder) setSelectedFolder(list[0]?.folder ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const runSearch = async (tags: string, rating: DanbooruRating | "", page: number) => {
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ tags, page: String(page), limit: String(SEARCH_LIMIT) });
      if (rating) params.set("rating", rating);
      const { posts } = await apiFetch<{ posts: DanbooruPost[] }>(`/api/lora-dataset/search?${params}`);
      setSearchResults(posts);
      setSearchPage(page);
      setHasNextPage(posts.length === SEARCH_LIMIT);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "検索に失敗しました");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = (tags: string, rating: DanbooruRating | "") => {
    setSearchQuery({ tags, rating });
    runSearch(tags, rating, 1);
  };

  const handlePageChange = (nextPage: number) => {
    if (!searchQuery || nextPage < 1) return;
    runSearch(searchQuery.tags, searchQuery.rating, nextPage);
  };

  const handleAdd = async (post: DanbooruPost) => {
    if (!selectedFolder) {
      toast.error("先にデータセットを選択してください");
      return;
    }
    setAddingId(post.id);
    try {
      await apiFetch("/api/lora-dataset/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, post }),
      });
      await loadImages(selectedFolder);
      await loadDatasets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "画像の追加に失敗しました");
    } finally {
      setAddingId(null);
    }
  };

  const handleAddFromUrl = async (url: string) => {
    if (!selectedFolder) {
      toast.error("先にデータセットを選択してください");
      return;
    }
    try {
      await apiFetch("/api/lora-dataset/images/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, url }),
      });
      await loadImages(selectedFolder);
      await loadDatasets();
      toast.success("画像を追加しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "画像の追加に失敗しました");
    }
  };

  const handleDeleteImage = async (image: DatasetImageEntry) => {
    if (!selectedFolder) return;
    if (!confirm(`#${image.id} をデータセットから削除しますか？`)) return;
    try {
      await apiFetch("/api/lora-dataset/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, id: String(image.id) }),
      });
      await loadImages(selectedFolder);
      await loadDatasets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <AppHeader active="lora-dataset">
        <span className="text-sm font-semibold">LoRAデータセット</span>
        <KohyaTrainModal dataset={selectedDataset} onUpdateDataset={handleUpdateDataset} />
      </AppHeader>

      <div className="flex min-h-0 flex-1">
        <DatasetSidebar
          datasets={datasets}
          selectedFolder={selectedFolder}
          onSelect={setSelectedFolder}
          onCreate={handleCreate}
          onUpdate={handleUpdateDataset}
          onDelete={handleDeleteDataset}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <DanbooruSearchPanel loading={searchLoading} onSearch={handleSearch} />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 pt-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                検索結果
              </p>
              {searchQuery && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => handlePageChange(searchPage - 1)}
                    disabled={searchLoading || searchPage <= 1}
                  >
                    <ChevronLeft className="h-3 w-3" />
                    前へ
                  </Button>
                  <span className="text-xs text-muted-foreground">{searchPage}ページ</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs"
                    onClick={() => handlePageChange(searchPage + 1)}
                    disabled={searchLoading || !hasNextPage}
                  >
                    次へ
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <SearchResultGrid posts={searchResults} addedIds={addedIds} addingId={addingId} onAdd={handleAdd} />

            <div className="flex items-center justify-between border-t px-3 pt-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {selectedDataset ? `${selectedDataset.name} の画像` : "データセット未選択"}
              </p>
              {selectedDataset && remoteConfigured && <RemoteSyncButton folder={selectedDataset.folder} />}
            </div>
            <AddFromUrlPanel disabled={!selectedFolder} onAdd={handleAddFromUrl} />
            <DatasetTagFilter
              tagCounts={tagCounts}
              filters={tagFilters}
              onToggle={handleToggleTag}
              onHover={setHoveredTag}
              onClear={() => setTagFilters({})}
            />
            {selectedFolder && (
              <BulkTagAddBar
                tagCounts={tagCounts}
                totalImages={images.length}
                selectionMode={selectionMode}
                onToggleSelectionMode={handleToggleSelectionMode}
                selectedCount={selectedIds.size}
                applying={bulkApplying}
                onApply={handleBulkApplyTag}
              />
            )}
            {selectedFolder && (
              <DatasetImageGrid
                folder={selectedFolder}
                images={filteredImages}
                imageTags={imageTags}
                hoveredTag={hoveredTag}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelectImage}
                onOpen={setEditingImage}
                onDelete={handleDeleteImage}
              />
            )}
          </div>
        </div>
      </div>

      {selectedDataset && (
        <ImageTagEditorDialog
          folder={selectedDataset.folder}
          dataset={selectedDataset}
          image={editingImage}
          tagCounts={tagCounts}
          totalImages={images.length}
          onClose={() => setEditingImage(null)}
          onSaved={(updated) => {
            setImages((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            setEditingImage(updated);
          }}
        />
      )}
    </div>
  );
}
