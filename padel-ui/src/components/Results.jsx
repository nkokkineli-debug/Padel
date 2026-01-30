import React, { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

const COLORS = {
  primary: "#6D55FF",
  accent: "#10B981",
  red: "#EF4444",
  background: "#F8FAFC",
  card: "#FFFFFF",
  text: "#22223B",
  textLight: "#6C757D",
  border: "#E5E7EB",
};

function ResultRow({ team1, team2, score1, score2, setsString, date, highlightName }) {
  const safe = (s) => (s || "");
  const t1 = safe(team1);
  const t2 = safe(team2);

  const normalize = (s) => (s || "").trim().toLowerCase();
  const hl = normalize(highlightName);

  const teamBoxClass = (teamText) => {
    if (!hl) return "player-box";
    const members = teamText.split("&").map((x) => normalize(x));
    return members.includes(hl) ? "player-box player-box-highlight" : "player-box";
  };

  return (
    <>
      <div className="result-row">
        <div className="match-date-row">{date}</div>
        <div className="row-content">
          <span className={teamBoxClass(t1)}>
            <span className="player-name">{t1}</span>
          </span>

          <span className="sets-won-box">{score1 ?? ""}</span>
          <span className="vs">vs</span>
          <span className="sets-won-box">{score2 ?? ""}</span>

          <span className={teamBoxClass(t2)}>
            <span className="player-name">{t2}</span>
          </span>
        </div>

        <div className="sets-row">
          {setsString ? <span className="sets-string-box">{setsString}</span> : null}
        </div>
      </div>
      <div className="match-divider" />
    </>
  );
}

export default function Results({ selectedGroup }) {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);

  const [selectedPlayerName, setSelectedPlayerName] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Load players for dropdown
  useEffect(() => {
    if (!selectedGroup) {
      setPlayers([]);
      setSelectedPlayerName("");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/players?group_id=${selectedGroup}`);
        const data = await res.json();
        setPlayers(Array.isArray(data) ? data : []);
      } catch {
        setPlayers([]);
      }
    })();
  }, [selectedGroup]);

  // Reset page when group changes
  useEffect(() => {
    setPage(1);
  }, [selectedGroup]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedPlayerName]);

  // Fetch matches paged + optional filter
  useEffect(() => {
    if (!selectedGroup) return;

    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setErr("");
      try {
        const playerParam = selectedPlayerName
          ? `&player_name=${encodeURIComponent(selectedPlayerName)}`
          : "";

        const res = await fetch(
          `${API_BASE}/matches_paged?group_id=${selectedGroup}&page=${page}&limit=${limit}${playerParam}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Failed to load matches");

        setMatches(data.matches || []);
        setTotal(data.total || 0);
        setHasMore(!!data.has_more);
      } catch (e) {
        if (e.name !== "AbortError") setErr(e.message || "Error loading matches");
      }
      setLoading(false);
    })();

    return () => controller.abort();
  }, [selectedGroup, page, selectedPlayerName]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = total ? Math.min(page * limit, total) : 0;

  const sortedPlayers = useMemo(() => {
    return (players || [])
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [players]);

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", padding: "8px 0 24px 0" }}>
      {/* Header */}
      <div
        className="content-header"
        style={{ maxWidth: 900, margin: "0 auto 8px auto", padding: "0 12px" }}
      >
        <h2 style={{ margin: 0 }}>Results</h2>
        <div style={{ color: "var(--text-light)" }}>
          {total ? `Showing ${from}-${to} of ${total}` : ""}
        </div>
      </div>

      {/* Filter */}
      <div style={{ maxWidth: 900, margin: "0 auto 12px auto", padding: "0 12px" }}>
        <select
          value={selectedPlayerName}
          onChange={(e) => setSelectedPlayerName(e.target.value)}
          style={{ maxWidth: 360, margin: "0 auto", display: "block" }}
          disabled={!selectedGroup}
        >
          <option value="">All players</option>
          {sortedPlayers.map((p) => (
            <option key={p.id || p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedPlayerName && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button className="btn-clear" onClick={() => setSelectedPlayerName("")}>
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Empty states / errors */}
      {!selectedGroup && (
        <div style={{ color: COLORS.textLight, textAlign: "center", padding: 12 }}>
          Please select a group.
        </div>
      )}

      {err && (
        <div style={{ maxWidth: 900, margin: "0 auto 12px auto", padding: "0 12px", color: COLORS.red }}>
          {err}
        </div>
      )}

      {/* Pagination */}
      {selectedGroup && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 8, alignItems: "center" }}>
          <button className="btn-view-all" disabled={loading || page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <div style={{ fontWeight: 700, color: COLORS.text }}>
            Page {page} / {totalPages}
          </div>
          <button className="btn-view-all" disabled={loading || !hasMore} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {/* Results list */}
      <div className="rows-list">
        {loading ? (
          <div style={{ color: COLORS.textLight, textAlign: "center", padding: 12 }}>Loading...</div>
        ) : matches.length === 0 && selectedGroup ? (
          <div style={{ color: COLORS.textLight, textAlign: "center", padding: 12 }}>
            {selectedPlayerName ? "No results found for this player." : "No games played yet."}
          </div>
        ) : (
          matches.map((m) => {
            const team1 = Array.isArray(m.team1) ? m.team1.join(" & ") : (m.team1 || "");
            const team2 = Array.isArray(m.team2) ? m.team2.join(" & ") : (m.team2 || "");
            return (
              <ResultRow
                key={m.id}
                team1={team1}
                team2={team2}
                score1={m.score1}
                score2={m.score2}
                setsString={m.sets_string}
                date={m.date}
                highlightName={selectedPlayerName}
              />
            );
          })
        )}
      </div>

      <style>{`
        .btn-view-all {
          background: ${COLORS.primary};
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 22px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          margin: 0;
          transition: background 0.2s, opacity 0.2s;
        }
        .btn-view-all:hover:enabled {
          background: ${COLORS.accent};
        }
        .btn-view-all:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .btn-clear {
          background: transparent;
          border: 2px solid ${COLORS.primary};
          color: ${COLORS.primary};
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .btn-clear:hover {
          background: ${COLORS.primary};
          color: #fff;
        }

        .rows-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          align-items: center;
          width: 100%;
        }
        .result-row {
          width: 100%;
          max-width: 900px;
          margin: 0;
          padding: 0;
        }
        .match-date-row {
          text-align: center;
          color: ${COLORS.textLight};
          font-size: 0.95rem;
          margin-bottom: 2px;
          min-height: 22px;
        }
        .row-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: ${COLORS.card};
          border-radius: 12px 12px 0 0;
          font-weight: 700;
          font-size: 1rem;
          color: ${COLORS.text};
          min-height: 36px;
          padding: 0;
        }
        .player-box {
          flex: 1 1 0;
          min-width: 0;
          max-width: 350px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${COLORS.primary};
          color: #fff;
          border-radius: 8px;
          font-weight: 600;
          text-align: center;
          margin: 0 2px;
          font-size: 1rem;
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .player-box-highlight {
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.35);
          transform: translateY(-1px);
        }
        .player-name {
          width: 100%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
          display: block;
        }
        .sets-won-box {
          background: ${COLORS.accent};
          color: #fff;
          border-radius: 6px;
          font-size: 0.95em;
          font-weight: 700;
          padding: 1px 10px;
          display: inline-block;
          min-width: 28px;
          text-align: center;
        }
        .vs {
          color: ${COLORS.primary};
          font-weight: 800;
          margin: 0 2px;
        }
        .sets-row {
          display: flex;
          justify-content: center;
          margin: 0;
          background: transparent;
        }
        .sets-string-box {
          background: #fff;
          border: 2px solid ${COLORS.primary};
          color: ${COLORS.primary};
          border-radius: 6px;
          padding: 1px 18px;
          font-size: 1.05rem;
          font-weight: 600;
          min-width: 48px;
          text-align: center;
        }
        .match-divider {
          width: 100%;
          max-width: 900px;
          height: 1px;
          background: ${COLORS.border};
          margin: 12px 0 16px 0;
        }
        @media (max-width: 900px) {
          .result-row {
            max-width: 98vw;
          }
          .row-content {
            gap: 2px;
          }
          .player-box {
            max-width: 48vw;
            min-width: 0;
            height: 38px;
            font-size: 0.97rem;
            padding: 2px 4px;
          }
        }
      `}</style>
    </div>
  );
}