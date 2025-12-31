import React, { useState, useEffect } from "react";
import PlayerDropdown from "./PlayerDropdown";

//const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";
const API_BASE = process.env.REACT_APP_API_BASE || "https://padel-4apg.onrender.com";

function generateAllVsAllMatches(couples) {
  let matches = [];
  for (let i = 0; i < couples.length; ++i) {
    for (let j = i + 1; j < couples.length; ++j) {
      matches.push({ team1: couples[i], team2: couples[j], sets: [[0, 0]] });
    }
  }
  return matches;
}

export
 default function ResultsPage({
  user,
  userGroups,
  selectedGroup,
  setSelectedGroup,
  fetchUserGroups,
}) {
  // State
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([
    { players: ["", ""] },
    { players: ["", ""] },
  ]);
  const [results, setResults] = useState([]);
  const [scheduledMatches, setScheduledMatches] = useState([]);
  const [scheduledMatchId, setScheduledMatchId] = useState("");
  const [scheduledMatch, setScheduledMatch] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [addMatchMode, setAddMatchMode] = useState(false);
  const [newMatchDate, setNewMatchDate] = useState("");
  // --- NEW: Mode selection and couples for league/cup
  const [newMatchMode, setNewMatchMode] = useState("league");
  const [couples, setCouples] = useState([["", ""]]);
  const [cupPairs, setCupPairs] = useState([]); // For cup: pairs for first round

  // Fetch players
  useEffect(() => {
    if (selectedGroup) {
      fetch(`${API_BASE}/players?group_id=${selectedGroup}`)
        .then((res) => res.json())
        .then((data) => setPlayers(data || []));
    }
  }, [selectedGroup]);

  // Fetch scheduled matches
  useEffect(() => {
    if (selectedGroup) {
      fetch(`${API_BASE}/next_matches?group_id=${selectedGroup}`)
        .then((res) => res.json())
        .then((data) => setScheduledMatches((data && data.matches) || []));
    }
  }, [selectedGroup]);

  // When scheduled match selected
  useEffect(() => {
    if (!scheduledMatchId || scheduledMatchId === "__none__" || scheduledMatchId === "__add__") {
      setScheduledMatch(null);
      setTeams([
        { players: ["", ""] },
        { players: ["", ""] },
      ]);
      setResults([]);
      return;
    }
    const match = scheduledMatches.find((m) => String(m.id) === String(scheduledMatchId));
    setScheduledMatch(match || null);
    setTeams([
      { players: ["", ""] },
      { players: ["", ""] },
    ]);
    setResults([]);
  }, [scheduledMatchId, scheduledMatches]);

  // When teams change, update results for league
  useEffect(() => {
    if (
      Array.isArray(teams) &&
      teams.length > 1 &&
      teams.every((t) => Array.isArray(t.players) && t.players.every(Boolean))
    ) {
      setResults([
        {
          team1: teams[0].players,
          team2: teams[1].players,
          sets: [[0, 0]],
        },
      ]);
    }
  }, [teams]);

  // --- NEW: When couples change in league mode, generate all-vs-all matches
  useEffect(() => {
    if (newMatchMode === "league" && couples.length > 1 && couples.every(c => c[0] && c[1])) {
      setResults(generateAllVsAllMatches(couples));
    }
  }, [couples, newMatchMode]);

  // --- NEW: For cup, user defines pairs for first round
  useEffect(() => {
    if (newMatchMode === "cup" && cupPairs.length > 0) {
      setResults(
        cupPairs.map(pair => ({
          team1: pair[0],
          team2: pair[1],
          sets: [[0, 0]],
        }))
      );
    }
  }, [cupPairs, newMatchMode]);

  // Add team (for manual team assignment, not used in league/cup mode)

  const handleAddTeam = () => {
    setTeams((prev) => [...prev, { players: ["", ""] }]);
  };

  // Remove team
  const handleRemoveTeam = (idx) => {
    setTeams((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add player to team
  const handleSetPlayerInTeam = (teamIdx, slotIdx, player) => {
    setTeams((prev) =>
      prev.map((t, i) =>
        i === teamIdx
          ? {
              ...t,
              players: t.players.map((p, j) => (j === slotIdx ? player : p)),
            }
          : t
      )
    );
  };

  // Remove player from team
  const handleRemovePlayerFromTeam = (teamIdx, playerIdx) => {
    setTeams((prev) =>
      prev.map((t, i) =>
        i === teamIdx
          ? { ...t, players: t.players.map((p, j) => (j === playerIdx ? "" : p)) }
          : t
      )
    );
  };

  // Add set
  const handleAddSet = (matchIdx) => {
    setResults((prev) =>
      prev.map((res, i) =>
        i === matchIdx
          ? { ...res, sets: [...res.sets, [0, 0]] }
          : res
      )
    );
  };

  // --- NEW: Add couple for league/cup
  const handleAddCouple = () => {
    setCouples(prev => [...prev, ["", ""]]);
  };
  const handleSetCouplePlayer = (coupleIdx, playerIdx, value) => {
    setCouples(prev =>
      prev.map((c, i) =>
        i === coupleIdx
          ? c.map((p, j) => (j === playerIdx ? value : p))
          : c
      )
    );
  };
  const handleRemoveCouple = (idx) => {
    setCouples(prev => prev.filter((_, i) => i !== idx));
  };

  // --- NEW: For cup, define pairs for first round
  const handleAddCupPair = () => {
    setCupPairs(prev => [...prev, [["", ""], ["", ""]]]);
  };
  const handleSetCupPair = (pairIdx, teamIdx, value) => {
    setCupPairs(prev =>
      prev.map((pair, i) =>
        i === pairIdx
          ? pair.map((team, j) => (j === teamIdx ? value : team))
          : pair
      )
    );
  };
  const handleRemoveCupPair = (idx) => {
    setCupPairs(prev => prev.filter((_, i) => i !== idx));
  };

  // Save results
  const handleSaveResults = async () => {
    setSaveMsg("");
    if (
      !selectedGroup ||
      !scheduledMatchId ||
      scheduledMatchId === "__none__" ||
      scheduledMatchId === "__add__" ||
      !results.length
    ) {
      setSaveMsg("Please fill all required fields.");
      return;
    }
    // Validate all sets
    for (const res of results) {
      for (const set of res.sets) {
        if (
          typeof set[0] !== "number" ||
          typeof set[1] !== "number" ||
          set[0] < 0 ||
          set[1] < 0
        ) {
          setSaveMsg("All set scores must be non-negative numbers.");
          return;
        }
      }
    }
    // For league/cup, couples are defined
    const couplesById = newMatchMode === "league" || newMatchMode === "cup"
      ? couples
      : teams.map(t => t.players);
    const resultsById = results.map(res => ({
      ...res,
      team1: res.team1,
      team2: res.team2,
    }));

    const payload = {
      group_id: selectedGroup,
      match_id: scheduledMatchId,
      match_date: scheduledMatch?.match_date,
     
 mode: newMatchMode,
      couples: couplesById,
      results: resultsById,
    };
    try {
      const res2 = await fetch(`${API_BASE}/register_match_result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res2.json();
      if (data.error) setSaveMsg(data.error);
      else setSaveMsg("Results saved!");
    } catch (err) {
      setSaveMsg("Error saving results: " + err.message);
    }
  };

  // Delete match
  const handleDeleteMatch = async () => {
    if (!scheduledMatch) return;
    if (!window.confirm("Delete this match?")) return;
    await fetch(`${API_BASE}/delete_next_match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: selectedGroup, match_id: scheduledMatch.id }),
    });
    setScheduledMatchId("");
    // Refresh matches
    fetch(`${API_BASE}/next_matches?group_id=${selectedGroup}`)
      .then((res) => res.json())
      .then((data) => setScheduledMatches((data && data.matches) || []));
  };

  // Add match functionality
  const handleCreateMatch = async () => {
    if (!selectedGroup || !newMatchDate) return;
    await fetch(`${API_BASE}/create_next_match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: selectedGroup, match_date: newMatchDate, mode: newMatchMode }),
    });
    setAddMatchMode(false);
    setNewMatchDate("");
    // Refresh matches and select the new one
    fetch(`${API_BASE}/next_matches?group_id=${selectedGroup}`)
      .then((res) => res.json())
      .then((data) => {
        setScheduledMatches((data && data.matches) || []);
        const newMatch = (data.matches || []).find((m) => m.match_date === newMatchDate);
        if (newMatch) setScheduledMatchId(newMatch.id);
      });
  };

  return (
    <div className="results-page">
      <div className="results-grid">
        {/* Left: Match Details & Players */}
        <div className="results-left">
          <div className="results-section">
            <h3>Match Details</h3>
            <label>Select Group:</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              required
            >
              <option value="">Select Group</option>
              {(userGroups || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <label style={{ marginTop: 12 }}>Select a Match:</label>
            <select
              value={scheduledMatchId}
              onChange={(e) => {
                if (e.target.value === "__add__") {
                  setAddMatchMode(true);
                  setScheduledMatchId("__add__");
                } else {
                  setAddMatchMode(false);
                  setScheduledMatchId(e.target.value);
                }
              }}
            >
              <option value="__none__">Select a match...</option>
              <option value="__add__">+ Add Match</option>
              {(scheduledMatches || [])
                .filter((m) => new Date(m.match_date) <= new Date())
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.match_date} ({(m.registered_users || []).join(", ")})
                  </option>
                ))}
            </select>
            {addMatchMode && (
              <div style={{ marginTop: 12 }}>
                <input
                  type="date"
                  value={newMatchDate}
                  onChange={(e) => setNewMatchDate(e.target.value)}
                />
                {/* --- NEW: Mode selection --- */}
                <select
                  value={newMatchMode}
                  onChange={e => setNewMatchMode(e.target.value)}
                  style={{ marginLeft: 8 }}
                >
                  <option value="league">League</option>
                  <option value="cup">Cup</option>
                </select>
                <button
                  className="btn btn-green"
                  style={{ marginLeft: 8 }}
                  onClick={handleCreateMatch}
                >
                  Create Match
                </button>
              </div>
            )}
            {scheduledMatch && (
              <button
                className="btn btn-red"
                style={{ marginTop: 16, width: "100%" }}
                onClick={handleDeleteMatch}
              >
                Delete Match
              </button>
            )}
          </div>
          <div className="
results-section">
            <h3>Players</h3>
            <div className="player-chips">
              {players.map((p) => (
                <span className="player-chip" key={p.name}>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* Right: Teams and Results */}
        <div className="results-right">
          <div className="results-section">
            <h3>{newMatchMode === "league" ? "League Couples" : newMatchMode === "cup" ? "Cup Couples" : "Team Assignments"}</h3>
            {/* --- NEW: Couples selection for league/cup --- */}
            {(newMatchMode === "league" || newMatchMode === "cup") ? (
              <>
                {couples.map((couple, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <PlayerDropdown
                      value={couple[0]}
                      onChange={val => handleSetCouplePlayer(idx, 0, val)}
                      players={players.filter(p => !couples.some((c, i) => i !== idx && (c[0] === p.name || c[1] === p.name)))}
                      selectedGroup={selectedGroup}
                      fetchPlayers={() => {}}
                    />
                    <span style={{ margin: "0 8px" }}>&</span>
                    <PlayerDropdown
                      value={couple[1]}
                      onChange={val => handleSetCouplePlayer(idx, 1, val)}
                      players={players.filter(p => !couples.some((c, i) => i !== idx && (c[0] === p.name || c[1] === p.name)))}
                      selectedGroup={selectedGroup}
                      fetchPlayers={() => {}}
                    />
                    {couples.length > 2 && (
                      <button className="btn btn-red btn-xs" style={{ marginLeft: 8 }} onClick={() => handleRemoveCouple(idx)}>Remove</button>
                    )}
                  </div>
                ))}
                <button className="btn btn-green btn-xs" style={{ marginTop: 8 }} onClick={handleAddCouple}>+ Add Couple</button>
                {/* For cup: define pairs for first round */}
                {newMatchMode === "cup" && (
                  <div style={{ marginTop: 16 }}>
                    <h4>First Round Pairs</h4>
                    {cupPairs.map((pair, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                        <select
                          value={pair[0]}
                          onChange={e => handleSetCupPair(idx, 0, e.target.value)}
                        >
                          <option value="">Select Couple</option>
                          {couples.map((c, i) => (
                            <option key={i} value={JSON.stringify(c)}>{c[0]} & {c[1]}</option>
                          ))}
                        </select>
                        <span style={{ margin: "0 8px" }}>vs</span>
                        <select
                          value={pair[1]}
                          onChange={e => handleSetCupPair(idx, 1, e.target.value)}
                        >
                          <option value="">Select Couple</option>
                          {couples.map((c, i) => (
                            <option key={i} value={JSON.stringify(c)}>{c[0]} & {c[1]}</option>
                          ))}
                        </select>
                        <button className="btn btn-red btn-xs" style={{ marginLeft: 8 }} onClick={() => handleRemoveCupPair(idx)}>Remove</button>
                      </div>
                    ))}
                    <button className="btn btn-green btn-xs" onClick={handleAddCupPair}>+ Add Pair</button>
                  </div>
                )}
              </>
            ) : (
              // Fallback: manual team assignment (old logic)
              <>
                {Array.isArray(teams) && teams.map((team, idx) => (
                  <div className="team-box" key={idx}>
                    <div className="team-header">
                      <span>Team {idx + 1}</span>
                      {teams.length > 2 && (
                        <button
                          className="btn btn-red btn-xs"
                          onClick={() => handleRemoveTeam(idx)}
                        >
                          Remove Team {idx + 1}
                        </button>
                      )}
                    </div>
                    {Array.isArray(team.players) && team.players.map((player, pidx) => (
                      <div className="team-player-row" key={pidx}>
                        <PlayerDropdown
                          value={player}
                          onChange={(val) => handleSetPlayerInTeam(idx, pidx, val)}
                          players={players.filter(
                            (pl) =>
                              !teams.some(
                                (t, tIdx) =>
                                  !(tIdx === idx && pidx === t.players.indexOf(player)) &&
                                  Array.isArray(t.players) &&
                                  t.players.includes(pl.name)
                              )
                          )}
                          selectedGroup={selectedGroup}
                          fetchPlayers={() => {
                            fetch(`${API_BASE}/players?group_id=${selectedGroup}`)
                              .then((res) => res.json())
                              .then((data) => setPlayers(data || []));
                          }}
                        />
                        <button
                          className="btn btn-red btn-xs"
                          onClick={() => handleRemovePlayerFromTeam(idx, pidx)}
                          style={{ marginLeft: 8 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {Array.isArray(team.players) && team.players.length < 2 && (
                      <PlayerDropdown
                        value=""
                        onChange={(val) => handleSetPlayerInTeam(idx, team.players.length, val)}
                        players={players.filter(
                          (pl) =>
                            !teams.some((t) => Array.isArray(t.players) && t.players.includes(pl.name))
                        )}
                        selectedGroup={selectedGroup}
                        fetchPlayers={() => {
                          fetch(`${API_BASE}/players?group_id=${selectedGroup}`)
                            .then((res) => res.json())
                            .then((data) => setPlayers(data || []));
                        }}
                      />
                    )}
                  </div>
                ))}
                <button
                  className="btn btn-green"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={handleAddTeam}
                >
                  + Add Team
                </button>
              </>
            )}
          </div>
          <div className="results-section">
            <h3>Match Results</h3>
            {results.map((res, idx) => (
              <div key={idx} className="result-row">
                <span>
                  {Array.isArray(res.team1)
                    ? res.team1.join(" & ")
                    : typeof res.team1 === "string"
                    ? JSON.parse(res.team1).join(" & ")
                    : ""}
                  {" vs "}
                  {Array.isArray(res.team2)
                    ? res.team2.join(" & ")
                    : typeof res.team2 === "string"
                    ? JSON.parse(res.team2).join(" & ")
                    : ""}
                </span>
                {res.sets.map((set, sidx) => (
                  <span key={sidx} className="set-inputs">
                    <input
                      type="number"
                      value={set[0]}
                      onChange={(e) => {
                        const newResults = [...results];
                        newResults[idx].sets[sidx][0] = Number(e.target.value);
                        setResults(newResults);
                      }}
                      className="score-input"
                    />
                    -
                    <input
                      type="number"
                      value={set[1]}
                      onChange={(e) => {
                        const newResults = [...results];
                        newResults[idx].sets[sidx][1] = Number(e.target.value);
                        setResults(newResults);
                      }}
                      className="score-input"
                    />
                  </span>
                ))}
                <button
                  className="btn btn-gray btn-xs"
                  onClick={() => handleAddSet(idx)}
                  style={{ marginLeft: 8 }}
                >
                  + Add Set
                </button>
              </div>
            ))}
          </div>
          <div className="results-actions">
            <button className="btn btn-green" onClick={handleSaveResults}>
              Save Results
            </button>
            <button
              className="btn btn-gray"
              style={{ marginLeft: 8 }}
              onClick={() => window.location.reload()}
            >
              Cancel
            </button>
            {saveMsg && (
              <div
                style={{
                  color: saveMsg === "Results saved!" ? "green" : "red",
                  marginTop: 12,
                }}
              >
                {saveMsg}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Responsive CSS (unchanged) */}
      <style>{`
        .results-page {
          padding: 24px;
        }
        .results-grid {
          display: flex;
          gap: 32px;
        }
        .results-left {
          flex: 1 1 260px;
          max-width: 320px;
        }
        .results-right {
          flex: 2 1 600px;
        }
        .results-section
 {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          padding: 24px;
          margin-bottom: 24px;
        }
        .player-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .player-chip {
          background: #f3f6fa;
          border-radius: 16px;
          padding: 4px 12px;
          font-size: 15px;
          font-weight: 500;
        }
        .team-box {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .team-player-row {
          display: flex;
          align-items: center;
          margin-bottom: 4px;
        }
        .team-player-row button {
          margin-left: 8px;
        }
        .result-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .set-inputs {
          margin-left: 12px;
        }
        .score-input {
          width: 60px;
          text-align: center;
          margin: 0 2px;
        }
        .score-input::-webkit-outer-spin-button,
        .score-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .score-input[type="number"] {
          -moz-appearance: textfield;
        }
        .results-actions {
          margin-top: 24px;
        }
        .btn {
          border: none;
          border-radius: 8px;
          padding: 10px 18px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-xs {
          padding: 4px 10px;
          font-size: 13px;
        }
        .btn-green {
          background: #10b981;
          color: #fff;
        }
        .btn-green:hover {
          background: #059669;
        }
        .btn-red {
          background: #ef4444;
          color: #fff;
        }
        .btn-red:hover {
          background: #b91c1c;
        }
        .btn-gray {
          background: #f3f4f6;
          color: #374151;
        }
        .btn-gray:hover {
          background: #e5e7eb;
        }
        @media (max-width: 900px) {
          .results-grid {
            flex-direction: column;
            gap: 0;
          }
          .results-left, .results-right {
            max-width: 100%;
          }
        }
        @media (max-width: 600px) {
          .results-page {
            padding: 8px;
          }
          .results-section {
            padding: 12px;
          }
          .btn, .btn-xs {
            width: 100%;
            margin-bottom: 8px;
          }
        }
      `}</style>
    </div>
  );
}