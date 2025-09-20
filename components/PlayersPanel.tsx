// components/PlayersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Participant = {
  player_id: string;
  full_name?: string;
  team_abbr?: string;
};

type Game = {
  game_id: string;
  participants?: Participant[];
};

function getPlayerId(p: any): string {
  return (p?.player_id ?? p?.id ?? "").toString();
}
function getPlayerName(p: any): string {
  return (p?.full_name ?? p?.name ?? p?.player_name ?? getPlayerId(p)).toString();
}
function uniqueBy<T>(arr: T[], keyFn: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

// simple CSV parser for "Name,MLBAMID"
function parseMapCsv(csv: string): Record<string, string> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return {};
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name");
  const idIdx = header.indexOf("mlbamid");
  const map: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(","); // names shouldn't contain commas in your file; if they do, we’d need a stricter CSV parser
    const name = (cols[nameIdx] ?? "").trim();
    const id = (cols[idIdx] ?? "").trim();
    if (name && id) map[name.toLowerCase()] = id;
  }
  return map;
}

export function PlayersPanel({
  games,
  selectedGameIds,
  value,
  onChange,
}: {
  games: Game[];
  selectedGameIds: string[];
  value: { player_id: string; full_name: string }[];
  onChange: (players: { player_id: string; full_name: string }[]) => void;
}) {
  const [q, setQ] = useState("");
  const [nameToId, setNameToId] = useState<Record<string, string>>({});

  // load /public/map.csv once on client
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/map.csv", { cache: "force-cache" });
        const txt = await res.text();
        if (!alive) return;
        setNameToId(parseMapCsv(txt));
      } catch {
        // ignore; we'll just use default images
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Build today’s pool from selected games (or all today’s games if none selected)
  const pool = useMemo(() => {
    const gamesToUse =
      selectedGameIds.length > 0 ? games.filter((g) => selectedGameIds.includes(g.game_id)) : games;

    const participants = gamesToUse.flatMap((g) => g.participants ?? []);
    const unique = uniqueBy(participants, (p) => getPlayerId(p));
    unique.sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)));

    const needle = q.trim().toLowerCase();
    const filtered =
      needle.length === 0
        ? unique
        : unique.filter((p) => getPlayerName(p).toLowerCase().includes(needle));

    return filtered.map((p) => ({
      player_id: getPlayerId(p),
      full_name: getPlayerName(p),
    }));
  }, [JSON.stringify(games), JSON.stringify(selectedGameIds), q]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.player_id)), [value]);

  const toggle = (p: { player_id: string; full_name: string }) => {
    if (selectedIds.has(p.player_id)) {
      onChange(value.filter((v) => v.player_id !== p.player_id));
    } else {
      onChange([...value, p]);
    }
  };

  const allSelected = pool.length > 0 && pool.every((p) => selectedIds.has(p.player_id));
  const toggleAll = () => {
    if (allSelected) {
      const poolIds = new Set(pool.map((p) => p.player_id));
      onChange(value.filter((v) => !poolIds.has(v.player_id)));
    } else {
      const map = new Map<string, { player_id: string; full_name: string }>();
      for (const v of value) map.set(v.player_id, v);
      for (const p of pool) map.set(p.player_id, p);
      onChange(Array.from(map.values()));
    }
  };

  // resolve image src candidates for a name
  function headshotCandidates(fullName: string) {
    const id = nameToId[fullName.toLowerCase()];
    if (!id) return ["/_default.avif"];
    return [`/headshots/${id}.png`, `/headshots2/${id}.png`, "/_default.avif"];
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="w-full border rounded-md px-3 py-1.5 text-sm"
        />
        <button
          onClick={toggleAll}
          className="px-2 py-1.5 text-xs border rounded-md bg-white hover:bg-gray-50"
        >
          {allSelected ? "Unselect All" : "Select All"}
        </button>
      </div>

      {/* List (fixed height + scroll, to match Games card) */}
      <div className="max-h-80 overflow-y-auto pr-1 border rounded-md">
        {pool.length === 0 ? (
          <div className="text-xs text-gray-500 p-3">No players match your search.</div>
        ) : (
          <ul className="divide-y">
            {pool.map((p) => {
              const checked = selectedIds.has(p.player_id);
              const [src1, src2, srcDefault] = headshotCandidates(p.full_name);
              return (
                <li key={p.player_id}>
                  <label className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={checked}
                        onChange={() => toggle(p)}
                      />
                      {/* Headshot with chained fallbacks */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src1}
                        alt={p.full_name}
                        width={28}
                        height={28}
                        className="rounded-full border object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src.endsWith(src1)) img.src = src2 ?? srcDefault;
                          else if (img.src.endsWith(src2)) img.src = srcDefault;
                        }}
                      />
                      <span className="text-sm">{p.full_name}</span>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
