import React, { useEffect, useState } from "react";

//const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";
const API_BASE = process.env.REACT_APP_API_BASE || "https://padel-4apg.onrender.com";

function normalizeName(name) {
  return (name || "").trim().toLowerCase();
}

function playerInTeam(player, team) {
  if (!player) return false;
  if (!Array.isArray(team)) return false;
  const playerName = normalizeName(player.name);
  return team.map(normalizeName).includes(playerName);
}

function getPlayerForm(player, matches) {
  const results = [];
  matches.forEach(m => {
    let team1 = m.team1;
    let team2 = m.team2;
    let sets = m.sets;
    if (typeof team1 === "string") team1 = JSON.parse(team1);
    if (typeof team2 === "string") team2 = JSON.parse(team2);
    if (typeof sets === "string") sets = JSON.parse(sets);

    if (!Array.isArray(team1) || !Array.isArray(team2) || !Array.isArray(sets) || sets.length === 0) return;

    const team1Norm = team1.map(normalizeName);
    const team2Norm = team2.map(normalizeName);

    const team1Sets = sets.reduce((acc, s) => acc + (s[0] > s[1] ? 1 : 0), 0);
    const team2Sets = sets.reduce((acc, s) => acc + (s[1] > s[0] ? 1 : 0), 0);

    let win = null;
    if (team1Sets > team2Sets) win = "team1";
    else if (team2Sets > team1Sets) win = "team2";

    const playerName = normalizeName(player.name);

    if (team1Norm.includes(playerName)) {
      results.push(win === "team1" ? "W" : "L");
    } else if (team2Norm.includes(playerName)) {
      results.push(win === "team2" ? "W" : "L");
    }
  });
  return results.slice(-5).join(" ");
}

function getPlayerAllTimeWinRatio(player, matches) {
  let played = 0;
  let won = 0;
  const playerName = normalizeName(player.name);
  matches.forEach(m => {
    let team1 = m.team1_raw || m.team1;
    let team2 = m.team2_raw || m.team2;
    let sets = m.sets;
    if (typeof team1 === "string") team1 = JSON.parse(team1);
    if (typeof team2 === "string") team2 = JSON.parse(team2);
    if (typeof sets === "string") sets = JSON.parse(sets);

    if (!Array.isArray(team1) || !Array.isArray(team2) || !Array.isArray(sets) || sets.length === 0) return;

    const team1Norm = team1.map(normalizeName);
    const team2Norm = team2.map(normalizeName);

    const team1Sets = sets.reduce((acc, s) => acc + (s[0] > s[1] ? 1 : 0), 0);
    const team2Sets = sets.reduce((acc, s) => acc + (s[1] > s[0] ? 1 : 0), 0);

    let win = null;
    if (team1Sets > team2Sets) win = "team1";
    else if (team2Sets > team1Sets) win = "team2";

    if (team1Norm.includes(playerName)) {
      played++;
      if (win === "team1") won++;
    } else if (team2Norm.includes(playerName)) {
      played++;
      if (win === "team2") won++;
    }
  });
  return played ? ((won / played) * 100).toFixed(1) + "%" : "N/A";
}

function getCoupleForm(player1Name, player2Name, matches) {
  const results = [];
  const p1 = normalizeName(player1Name);
  const p2 = normalizeName(player2Name);
  matches.forEach(m => {
    let team1 = m.team1;
    let team2 = m.team2;
    let sets = m.sets;
    if (typeof team1 === "string") team1 = JSON.parse(team1);
    if (typeof team2 === "string") team2 = JSON.parse(team2);
    if (typeof sets === "string") sets = JSON.parse(sets);

    if (!Array.isArray(team1) || !Array.isArray(team2) || !Array.isArray(sets) || sets.length === 0) return;

    const team1Norm = team1.map(normalizeName);
    const team2Norm = team2.map(normalizeName);

    const team1Sets = sets.reduce((acc, s) => acc + (s[0] > s[1] ? 1 : 0), 0);
    const team2Sets = sets.reduce((acc, s) => acc + (s[1] > s[0] ? 1 : 0), 0);

    let win = null;
    if (team1Sets > team2Sets) win = "team1";
    else if (team2Sets > team1Sets) win = "team2";

    if (team1Norm.includes(p1) && team1Norm.includes(p2)) {
      results.push(win === "team1" ? "W" : "L");
    } else if (team2Norm.includes(p1) && team2Norm.includes(p2)) {
      results.push(win === "team2" ? "W" : "L");
    }
  });
  return results.slice(-5).join(" ");
}

function getCoupleAllTimeWinRatio(player1Name, player2Name, matches) {
  let played = 0;
  let won = 0;
  const p1 = normalizeName(player1Name);
  const p2 = normalizeName(player2Name);
  matches.forEach(m => {
    let team1 = m.team1_raw || m.team1;
    let team2 = m.team2_raw || m.team2;
    let sets = m.sets;
    if (typeof team1 === "string") team1 = JSON.parse(team1);
    if (typeof team2 === "string") team2 = JSON.parse(team2);
    if (typeof sets === "string") sets = JSON.parse(sets);

    if (!Array.isArray(team1) || !Array.isArray(team2) || !Array.isArray(sets) || sets.length === 0) return;

    const team1Norm = team1.map(normalizeName);
    const team2Norm = team2.map(normalizeName);

    const team1Sets = sets.reduce((acc, s) => acc + (s[0] > s[1] ? 1 : 0), 0);
    const team2Sets = sets.reduce((acc, s) => acc + (s[1] > s[0] ? 1 : 0), 0);

    let win = null;
    if (team1Sets > team2Sets) win = "team1";
    else if (team2Sets > team1Sets) win = "team2";

    if (team1Norm.includes(p1) && team1Norm.includes(p2)) {
      played++;
      if (win === "team1") won++;
    } else if (team2Norm.includes(p1) && team2Norm.includes(p2)) {
      played++;
      if (win === "team2") won++;
    }
  });
  return played ? ((won / played) * 100).toFixed(1) + "%" : "N/A";
}

export default function Ratings({ selectedGroup }) {
  const [playerRatings, setPlayerRatings] = useState([]);
  const [coupleRatings, setCoupleRatings] = useState([]);
  const [matches, setMatches] = useState([]);
  const [recalcMsg, setRecalcMsg] = useState("");
  const [recalcLoading, setRecalcLoading] = useState(false);

  useEffect(() => {
    if (!selectedGroup) return;
    fetch(`${API_BASE}/player_ratings?group_id=${selectedGroup}`)
      .then((res) => res.json())
      .then((data) => setPlayerRatings((data && data.players) || []));
    fetch(`${API_BASE}/couple_ratings?group_id=${selectedGroup}`)
      .then((res) => res.json())
      .then((data) => setCoupleRatings((data && data.couples) || []));
    fetch(`${API_BASE}/matches?group_id=${selectedGroup}`)
      .then(res => res.json())
      .then(data => setMatches((data && data.matches) || []));
  }, [selectedGroup]);

  const handleRecalculate = async () => {
    if (!selectedGroup) return;
    setRecalcLoading(true);
    setRecalcMsg("");
    try {
      const res = await fetch(`${API_BASE}/recalculate_points?group_id=${selectedGroup}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) setRecalcMsg(data.error);
      else setRecalcMsg("Points recalculated!");
      fetch(`${API_BASE}/player_ratings?group_id=${selectedGroup}`)
        .then((res) => res.json())
        .then((data) => setPlayerRatings((data && data.players) || []));
      fetch(`${API_BASE}/couple_ratings?group_id=${selectedGroup}`)
        .then((res) => res.json())
        .then((data) => setCoupleRatings((data && data.couples) || []));
    } catch (e) {
      setRecalcMsg("Error recalculating points.");
    }
    setRecalcLoading(false);
  };

  return (
    <div className="card">
      <div className="content-header"><h2>Ratings</h2></div>
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-green" onClick={handleRecalculate} disabled={recalcLoading}>
          {recalcLoading ? "Recalculating..." : "Recalculate Points"}
        </button>
        {recalcMsg && (
          <span style={{ marginLeft: 12, color: recalcMsg === "Points recalculated!" ? "green" : "red" }}>
            {recalcMsg}
          </span>
        )}
      </div>
      <div>
        <h4>Player Ratings</h4>
        <table className="ratings-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Points</th>
              <th>Win Ratio (Last 8)</th>
              <th>Win Ratio (All Time)</th>
              <th>Form (Last 5)</th>
            </tr>
          </thead>
          <tbody>
            {[...playerRatings]
              .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
              .map((p, idx) => {
                const winRatio = p.matches_played
                  ? ((p.matches_won / p.matches_played) * 100).toFixed(1) + "%"
                  : "N/A";
                const allTimeWinRatio = getPlayerAllTimeWinRatio(p, matches);
                const form = getPlayerForm(p, matches);
                return (
                  <tr key={p.id || p.email || p.name || idx}>
                    <td>{p.name}</td>
                    <td>{typeof p.total_points === "number" ? p.total_points : "N/A"}</td>
                    <td>{winRatio}</td>
                    <td>{allTimeWinRatio}</td>
                    <td className="form-cell">{form}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div>
        <h4>Couple Ratings</h4>
        <table className="ratings-table">
          <thead>
            <tr>
              <th>Couple</th>
              <th>Points</th>
              <th>Win Ratio (Last 8)</th>
              <th>Win Ratio (All Time)</th>
              <th>Form (Last 5)</th>
            </tr>
          </thead>
          <tbody>
            {[...coupleRatings]
              .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
              .map((c, idx) => {
                const winRatio = c.matches_played
                  ? ((c.matches_won / c.matches_played) * 100).toFixed(1) + "%"
                  : "N/A";
                const allTimeWinRatio = getCoupleAllTimeWinRatio(c.player1_name, c.player2_name, matches);
                const form = getCoupleForm(c.player1_name, c.player2_name, matches);
                return (
                  <tr key={c.id || idx}>
                    <td>{c.player1_name} & {c.player2_name}</td>
                    <td>{typeof c.total_points === "number" ? c.total_points : "N/A"}</td>
                    <td>{winRatio}</td>
                    <td>{allTimeWinRatio}</td>
                    <td className="form-cell">{form}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <style>{`
        .ratings-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          margin-bottom: 32px;
          overflow: hidden;
        }
        .ratings-table th, .ratings-table td {
          padding: 12px 16px;
          text-align: left;
          font-size: 15px;
        }
        .ratings-table th {
          background: var(--primary-light, #f3f6fa);
          color: var(--primary-color, #6D55FF);
          font-weight: 600;
          border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .ratings-table tr {
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          transition: background 0.2s;
        }
        .ratings-table tr:last-child {
          border-bottom: none;
        }
        .ratings-table tbody tr:hover {
          background: #f3f6fa;
        }
        .ratings-table td {
          color: var(--text-dark, #22223B);
        }
        .ratings-table .form-cell {
          font-family: monospace;
          letter-spacing: 2px;
          font-size: 16px;
          font-weight: 600;
        }
        .btn {
          border: none;
          border-radius: 8px;
          padding: 8px 18px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-green {
          background: #10b981;
          color: #fff;
        }
        .btn-green
:disabled {
          background: #a7f3d0;
          color: #fff;
          cursor: not-allowed;
        }
        .btn-green:hover:enabled {
          background: #059669;
        }
      `}</style>
    </div>
  );
}