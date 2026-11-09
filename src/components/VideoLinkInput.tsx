import { useState } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import { trainerPost } from "../lib/trainerApi";
import { btnGhost, btnPrimary } from "./ui/styles";

type VideoResult = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
};

type VideoLinkInputProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  exerciseName?: string;
};

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export default function VideoLinkInput({
  label = "Video Link",
  value,
  onChange,
  exerciseName = "",
}: VideoLinkInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  async function search(text: string) {
    if (!text.trim()) {
      setMessage("Type what to search for.");
      return;
    }

    setIsSearching(true);
    setMessage("");

    const { data, error, status } = await trainerPost<{
      results?: VideoResult[];
    }>("/api/youtube-search", { query: text });

    setIsSearching(false);

    if (status === 501) {
      setNotConfigured(true);
      setResults([]);
      return;
    }

    if (error) {
      setMessage(error);
      setResults([]);
      return;
    }

    setResults(data?.results || []);
    if (!data?.results?.length) setMessage("No videos found. Try other words.");
  }

  function open() {
    const initial = exerciseName.trim()
      ? `${exerciseName.trim()} exercise proper form`
      : "";

    setQuery(initial);
    setResults([]);
    setMessage("");
    setIsOpen(true);
    if (initial) search(initial);
  }

  function choose(result: VideoResult) {
    onChange(result.url);
    setIsOpen(false);
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-ink/80">{label}</label>

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://youtube.com/..."
          className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 py-3 text-ink outline-none placeholder:text-muted focus:border-accent/40 focus:ring-4 focus:ring-line"
        />
        <button
          type="button"
          onClick={() => (isOpen ? setIsOpen(false) : open())}
          aria-expanded={isOpen}
          className={`${btnGhost} h-auto shrink-0`}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          {isOpen ? "Close" : "Find video"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 rounded-2xl border border-line bg-canvas p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              search(query);
            }}
            className="flex gap-2"
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search YouTube"
              aria-label="Search YouTube"
              enterKeyHint="search"
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-accent/40"
            />
            <button
              type="submit"
              disabled={isSearching}
              className={`${btnPrimary} shrink-0`}
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          {notConfigured && (
            <p className="mt-3 text-sm leading-6 text-muted">
              Search inside CoachSync isn't switched on yet.{" "}
              <a
                href={youtubeSearchUrl(query)}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Open this search on YouTube
              </a>{" "}
              and paste the link above.
            </p>
          )}

          {message && <p className="mt-3 text-sm text-muted">{message}</p>}

          {results.length > 0 && (
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {results.map((result) => (
                <li
                  key={result.videoId}
                  className="flex gap-3 rounded-xl border border-line bg-white p-2"
                >
                  <img
                    src={result.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-[68px] w-[120px] shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-5">
                      {result.title}
                    </p>
                    <p className="truncate text-xs text-muted">{result.channel}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => choose(result)}
                        className="text-sm font-bold text-accent hover:underline"
                      >
                        Use this
                      </button>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:underline"
                      >
                        Watch
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
