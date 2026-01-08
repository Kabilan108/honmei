import { useAction, useMutation, useQuery } from "convex/react";
import {
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Moon,
  Palette,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

const ACCENT_COLORS = [
  { name: "Orange", value: "24 95% 53%", class: "bg-orange-500" },
  { name: "Blue", value: "217 91% 60%", class: "bg-blue-500" },
  { name: "Green", value: "142 71% 45%", class: "bg-green-500" },
  { name: "Purple", value: "262 83% 58%", class: "bg-purple-500" },
  { name: "Pink", value: "330 81% 60%", class: "bg-pink-500" },
  { name: "Red", value: "0 84% 60%", class: "bg-red-500" },
];

export function SettingsPage() {
  // Theme state
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem("curator-accent") || "24 95% 53%";
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("curator-theme") !== "light";
  });

  // MAL import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    status: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importComplete, setImportComplete] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Queries and actions
  const fullExport = useQuery((api as any).export?.getFullExport);
  const csvExport = useQuery((api as any).export?.getCsvExport);
  const importMalItem = useMutation((api as any).import?.importMalItem);
  const clearAllData = useMutation((api as any).import?.clearAllData);
  const batchFetchAniListData = useAction((api as any).anilist?.batchFetchAniListData);

  // Apply theme changes
  useEffect(() => {
    document.documentElement.style.setProperty("--primary", accentColor);
    localStorage.setItem("curator-accent", accentColor);
  }, [accentColor]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("curator-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("curator-theme", "light");
    }
  }, [isDarkMode]);

  // Parse MAL XML export and extract anime/manga entries
  const parseMALXml = (
    xmlText: string,
  ): Array<{
    malId: number;
    type: "ANIME" | "MANGA";
    title: string;
    score: number;
    status: string;
    episodes?: number;
    chapters?: number;
  }> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");

    // Check if it's anime or manga export
    const animeEntries = doc.querySelectorAll("anime");
    const mangaEntries = doc.querySelectorAll("manga");

    const items: Array<{
      malId: number;
      type: "ANIME" | "MANGA";
      title: string;
      score: number;
      status: string;
      episodes?: number;
      chapters?: number;
    }> = [];

    // Parse anime entries
    animeEntries.forEach((entry) => {
      const malId = parseInt(
        entry.querySelector("series_animedb_id")?.textContent || "0",
      );
      const title = entry.querySelector("series_title")?.textContent || "";
      const score = parseInt(
        entry.querySelector("my_score")?.textContent || "0",
      );
      const status = entry.querySelector("my_status")?.textContent || "";
      const episodes = parseInt(
        entry.querySelector("my_watched_episodes")?.textContent || "0",
      );

      if (malId > 0 && title) {
        items.push({
          malId,
          type: "ANIME",
          title,
          score,
          status,
          episodes,
        });
      }
    });

    // Parse manga entries
    mangaEntries.forEach((entry) => {
      const malId = parseInt(
        entry.querySelector("manga_mangadb_id")?.textContent || "0",
      );
      const title = entry.querySelector("manga_title")?.textContent || "";
      const score = parseInt(
        entry.querySelector("my_score")?.textContent || "0",
      );
      const status = entry.querySelector("my_status")?.textContent || "";
      const chapters = parseInt(
        entry.querySelector("my_read_chapters")?.textContent || "0",
      );

      if (malId > 0 && title) {
        items.push({
          malId,
          type: "MANGA",
          title,
          score,
          status,
          chapters,
        });
      }
    });

    return items;
  };

  // Decompress gzip file
  const decompressGzip = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const decompressedStream = new Blob([arrayBuffer])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    const decompressedBlob = await new Response(decompressedStream).blob();
    return decompressedBlob.text();
  };

  // File import handler
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportComplete(false);
    setImportProgress({ current: 0, total: 0, status: "Reading file..." });

    try {
      // Handle .gz files by decompressing first
      let xmlText: string;
      if (file.name.endsWith(".gz")) {
        setImportProgress({
          current: 0,
          total: 0,
          status: "Decompressing file...",
        });
        xmlText = await decompressGzip(file);
      } else {
        xmlText = await file.text();
      }

      setImportProgress({ current: 0, total: 0, status: "Parsing XML..." });

      const items = parseMALXml(xmlText);

      if (items.length === 0) {
        setImportError(
          "No valid entries found in the XML file. Make sure it's a MAL export file.",
        );
        setIsImporting(false);
        return;
      }

      // Phase 1: Fetch AniList metadata for all items via server-side action (avoids CORS)
      setImportProgress({
        current: 0,
        total: items.length,
        status: `Found ${items.length} items. Fetching metadata from AniList...`,
      });

      // Batch items in chunks for the server action
      const CHUNK_SIZE = 20;
      const anilistData: Record<string, {
        anilistId: number;
        title: string;
        titleEnglish: string | null;
        coverImage: string | null;
        bannerImage: string | null;
        genres: string[];
        format: string | null;
        episodes: number | null;
        chapters: number | null;
      } | null> = {};

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        setImportProgress({
          current: i,
          total: items.length,
          status: `Fetching metadata: ${i}/${items.length}`,
        });

        try {
          const chunkResults = await batchFetchAniListData({
            items: chunk.map((item) => ({
              malId: item.malId,
              type: item.type,
              title: item.title,
            })),
          });
          Object.assign(anilistData, chunkResults);
        } catch (error) {
          console.error(`Failed to fetch AniList data for chunk:`, error);
        }
      }

      // Phase 2: Import items to database
      setImportProgress({
        current: 0,
        total: items.length,
        status: `Metadata fetched. Importing to library...`,
      });

      let imported = 0;
      let skipped = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const key = `${item.type}-${item.malId}`;
        const anilistMedia = anilistData[key];

        setImportProgress({
          current: i + 1,
          total: items.length,
          status: `Importing: ${item.title}`,
        });

        try {
          // Use AniList data if available, fall back to MAL data
          const result = await importMalItem({
            malId: item.malId,
            anilistId: anilistMedia?.anilistId,
            type: item.type,
            title: anilistMedia?.title || item.title,
            titleEnglish: anilistMedia?.titleEnglish || undefined,
            coverImage:
              anilistMedia?.coverImage ||
              `https://cdn.myanimelist.net/images/${item.type.toLowerCase()}/${item.malId}.jpg`,
            genres: anilistMedia?.genres || [],
            malScore: item.score,
            malStatus: item.status,
            episodes: anilistMedia?.episodes ?? item.episodes,
            chapters: anilistMedia?.chapters ?? item.chapters,
          });

          if (result.skipped) {
            skipped++;
          } else {
            imported++;
          }
        } catch (error) {
          console.error(`Failed to import ${item.title}:`, error);
        }

        // Small delay to avoid overwhelming the database
        if (i % 10 === 0) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      setImportProgress({
        current: items.length,
        total: items.length,
        status: `Done! Imported ${imported}, skipped ${skipped} duplicates`,
      });
      setImportComplete(true);
    } catch (error) {
      console.error("Import failed:", error);
      setImportError(
        "Failed to parse the file. Make sure it's a valid MAL export (.xml or .xml.gz).",
      );
    } finally {
      setIsImporting(false);
      // Reset the file input
      e.target.value = "";
    }
  };

  // Export handlers
  const handleJsonExport = () => {
    if (!fullExport) return;
    setIsExporting(true);

    const blob = new Blob([JSON.stringify(fullExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curator-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExporting(false);
  };

  const handleCsvExport = () => {
    if (!csvExport) return;
    setIsExporting(true);

    // Create CSV content
    const headers = [
      "Rank",
      "Title",
      "Title (English)",
      "Type",
      "Elo Rating",
      "Score (0-10)",
      "Comparisons",
      "Status",
      "Genres",
      "AniList ID",
      "MAL ID",
    ];

    const rows = csvExport.map((item: any) => [
      item.rank,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${(item.titleEnglish || "").replace(/"/g, '""')}"`,
      item.type,
      item.eloRating,
      item.percentileScore,
      item.comparisonCount,
      item.watchStatus,
      `"${item.genres}"`,
      item.anilistId,
      item.malId,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row: string[]) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curator-export-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setIsExporting(false);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-neutral-400 mt-2">
          Manage your preferences, import data, and export your library
        </p>
      </div>

      {/* Appearance Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Palette className="size-5" />
          Appearance
        </h2>

        <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Theme</div>
              <div className="text-sm text-neutral-400">
                Switch between dark and light mode
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="gap-2"
            >
              {isDarkMode ? (
                <>
                  <Moon className="size-4" />
                  Dark
                </>
              ) : (
                <>
                  <Sun className="size-4" />
                  Light
                </>
              )}
            </Button>
          </div>

          {/* Accent Color */}
          <div>
            <div className="font-medium mb-2">Accent Color</div>
            <div className="flex gap-2">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={`w-8 h-8 ${color.class} border-2 transition-all ${
                    accentColor === color.value
                      ? "border-white scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MAL Import Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Upload className="size-5" />
          Import from MyAnimeList
        </h2>

        <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-4">
          <p className="text-sm text-neutral-400">
            Import your anime/manga from MAL using the XML export. Scores will
            be converted to Elo ratings (MAL 10 = 1800, MAL 7 = 1500, MAL 1 =
            900).
          </p>

          <div className="text-sm space-y-2">
            <p className="font-medium">How to export from MAL:</p>
            <ol className="list-decimal list-inside text-neutral-400 space-y-1">
              <li>Go to your MAL profile → Settings → Import/Export</li>
              <li>Click "Export My List" (Anime or Manga)</li>
              <li>Upload the .xml.gz file below (no need to unzip)</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <input
              type="file"
              accept=".xml,.gz"
              onChange={handleFileImport}
              disabled={isImporting}
              className="flex-1 text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700"
            />
          </div>

          {importProgress && (
            <div className="space-y-2">
              <div className="text-sm text-neutral-400">
                {importProgress.status}
              </div>
              {importProgress.total > 0 && (
                <div className="w-full bg-neutral-800 h-2">
                  <div
                    className="bg-primary h-full transition-all"
                    style={{
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {importError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <X className="size-4" />
              {importError}
            </div>
          )}

          {importComplete && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Check className="size-4" />
              Import complete!
            </div>
          )}
        </div>
      </section>

      {/* Export Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Download className="size-5" />
          Export Data
        </h2>

        <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-4">
          <p className="text-sm text-neutral-400">
            Download your library data for backup or analysis.
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleJsonExport}
              disabled={!fullExport || isExporting}
              className="gap-2"
            >
              <FileJson className="size-4" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleCsvExport}
              disabled={!csvExport || isExporting}
              className="gap-2"
            >
              <FileSpreadsheet className="size-4" />
              Export CSV
            </Button>
          </div>

          {fullExport && (
            <div className="text-xs text-neutral-500">
              {fullExport.stats.totalItems} items,{" "}
              {fullExport.stats.totalComparisons} comparisons
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2 text-red-400">
          <Trash2 className="size-5" />
          Danger Zone
        </h2>

        <div className="bg-neutral-900 border border-red-900/50 p-4 space-y-6">
          {/* Clear All Data */}
          <div className="space-y-2">
            <div className="font-medium">Clear All Data</div>
            <p className="text-sm text-neutral-400">
              Delete all library items, media entries, and comparisons. Use this
              before re-importing your list.
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="destructive" size="sm" />}
              >
                Clear All Data
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL your library items, media
                    entries, and comparison history. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={async () => {
                      try {
                        const result = await clearAllData({});
                        console.log("Cleared data:", result);
                      } catch (error) {
                        console.error("Failed to clear data:", error);
                      }
                    }}
                  >
                    Clear Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Reset Rankings */}
          <div className="space-y-2">
            <div className="font-medium">Reset All Rankings</div>
            <p className="text-sm text-neutral-400">
              Reset all Elo ratings to 1500 and clear comparison history. Items
              will remain in your library.
            </p>
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button variant="destructive" size="sm" />}
              >
                Reset Rankings
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Rankings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset all Elo ratings to 1500 and delete all
                    comparison history. Your library items will be preserved.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">
                    Reset Rankings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>
    </div>
  );
}
