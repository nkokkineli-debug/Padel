import React, { useEffect, useState } from "react";

//const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";
const API_BASE = process.env.REACT_APP_API_BASE || "https://padel-4apg.onrender.com";


// Helper to check if a player is in a team by any identifier
function playerInTeam(player, team) {
  if (!player) return false;
  if (!Array.isArray(team)) return false;
  return team.includes(player.id) || team.includes(player.email) || team.includes(player.name);
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

    const team1Sets = sets.reduce((acc, s) => acc + (s[0] > s[1] ? 1 : 0), 0);
    const team2Sets = sets.reduce((acc, s) => acc + (s[1] > s[0] ? 1 : 0), 0);

    let win = null;
    if (team1Sets > team2Sets) win = "team1";
    else if (team2Sets > team1Sets) win = "team2";

    if (playerInTeam(player, team1)) {
      results.push(win === "team1" ? "W" : "L");
    } else if (playerInTeam(player, team2)) {
      results.push(win === "team2" ? "W" : "L");
    }
  });
  return results.slice(-5).join(" ");
}

function getCoupleForm(player1Id, player2Id, matches) {
  const results = [];
  matches.forEach(m => {
    let team1 = m.team1;
    let team2 = m.team2;
    let sets = m.sets;
    if (typeof team1 === "string") team1 = JSON.parse(team1);
    if (typeof team2 === "string") team2 = JSON.parse(team2);
    if (typeof sets === "string") sets = JSON.parse(sets);

    if (!Array.isArray(team1) || !Array.isArray(team2) || !Array.isArray(sets) || sets.length === 0) return;

    const team1Sets = sets.reduce((acc, s) => acc + (s[0] > s[1] ? 1 : 0), 0);
    const team2Sets = sets.reduce((acc, s) => acc + (s[1] > s[0] ? 1 : 0), 0);

    let win = null;
    if (team1Sets > team2Sets) win = "team1";
    else if (team2Sets > team1Sets) win = "team2";

    if (team1.includes(player1Id) && team1.includes(player2Id)) {
      results.push(win === "team1" ? "W" : "L");
    } else if (team2.includes(player1Id) && team2.includes(player2Id)) {
      results.push(win === "team2" ? "W" : "L");
    }
  });
  return results.slice(-5).join(" ");
}

export default function Ratings({ selectedGroup }) {
  const [playerRatings, setPlayerRatings] = useState([]);
  const [coupleRatings, setCoupleRatings] = useState([]);
  const [matches, setMatches] = useState([]);

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

  return (
    <div className="card">
      <div className="content-header"><h2>Ratings</h2></div>
      <div>
        <h4>Player Ratings</h4>
        <table className="ratings-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Points</th>
              <th>Win Ratio</th>
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
                // Pass the whole player object for robust matching
                const form = getPlayerForm(p, matches);
                return (
                  <tr key={p.id || p.email || p.name || idx}>
                    <td>{p.name}</td>
                    <td>{typeof p.total_points === "number" ? p.total_points : "N/A"}</td>
                    <td>{winRatio}</td>
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
              <th>Win Ratio</th>
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
                const form = getCoupleForm(c.player1, c.player2, matches);
                return (
                  <tr key={c.id || idx}>
                    <td>{c.player1_name} & {c.player2_name}</td>
                    <td>{typeof c.total_points === "number" ? c.total_points : "N/A"}</td>
                    <td>{winRatio}</td>
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
          background: var(--primary-light);
          color: var(--primary-color);
          font-weight: 600;
          border-bottom: 1px solid var(--border-color);
        }
        .ratings-table tr {
          border-bottom: 1px solid var(--border-color);
          transition: background 0.2s;
        }
        .ratings-table tr:last-child {
          border-bottom: none;
        }
        .ratings-table tbody tr:hover {
          background: #f3f6fa;
        }
        .ratings-table td {
          color: var(--text-dark);
        }
        .ratings-table .form-cell {
          font-family: monospace;
          letter-spacing: 2px;
          font-size: 16px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}