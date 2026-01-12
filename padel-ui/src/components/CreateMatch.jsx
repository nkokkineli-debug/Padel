import React, { useState, useEffect } from 'react';
import PlayerDropdown from './PlayerDropdown';
import { FiTrash2 } from 'react-icons/fi';

//const API_BASE = 'http://127.0.0.1:8000';
const API_BASE = "https://padel-4apg.onrender.com";

export default function CreateMatch({
  user,
  userGroups,
  selectedGroup,
  setSelectedGroup,
}) {
  const [nextMatches, setNextMatches] = useState([]);
  const [newMatchDate, setNewMatchDate] = useState('');
  const [nextMatchMsg, setNextMatchMsg] = useState('');
  const [players, setPlayers] = useState([]);
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState({});
  const [proposedTeams, setProposedTeams] = useState({});
  const [proposeLoading, setProposeLoading] = useState({});

  const fetchNextMatches = async (groupId = selectedGroup) => {
    if (!groupId) {
      setNextMatches([]);
      return;
    }
    const res = await fetch(`${API_BASE}/next_matches?group_id=${groupId}`);
    const data = await res.json();
    setNextMatches((data && data.matches) || []);
  };

  const fetchPlayers = async (groupId = selectedGroup) => {
    if (!groupId) {
      setPlayers([]);
      return;
    }
    const res = await fetch(`${API_BASE}/players?group_id=${groupId}`);
    const data = await res.json();
    setPlayers(data || []);
  };

  useEffect(() => {
    if (selectedGroup) {
      fetchNextMatches(selectedGroup);
      fetchPlayers(selectedGroup);
    }
  }, [selectedGroup]);

  const handleCreateMatch = async (e) => {
    e.preventDefault();
    setNextMatchMsg('');
    if (!selectedGroup || !newMatchDate) {
      setNextMatchMsg('Please select a group and date.');
      return;
    }
    await fetch(`${API_BASE}/create_next_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: selectedGroup, match_date: newMatchDate })
    });
    setNextMatchMsg('Next match created!');
    setNewMatchDate('');
    fetchNextMatches(selectedGroup);
  };

  const handleDeleteNextMatch = async (groupId, matchId) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return;
    await fetch(`${API_BASE}/delete_next_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, match_id: matchId }),
    });
    fetchNextMatches(groupId);
  };

  const handleAddPlayerToNextMatch = async (groupId, matchDate, playerName) => {
    if (!playerName) return;
    await fetch(`${API_BASE}/add_player_to_next_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: groupId,
        match_date: matchDate,
        username: playerName,
      }),
    });
    fetchNextMatches(groupId);
    setSelectedMatchPlayers(prev => ({ ...prev, [matchDate]: '' }));
  };

  const handleRemovePlayerFromNextMatch = async (groupId, matchDate, username) => {
    await fetch(`${API_BASE}/remove_player_from_next_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, match_date: matchDate, username })
    });
    fetchNextMatches(groupId);
  };

  const handleProposeTeams = async (groupId, matchDate) => {
    setProposeLoading(prev => ({ ...prev, [matchDate]: true }));
    setProposedTeams(prev => ({ ...prev, [matchDate]: [] }));
    const res = await fetch(`${API_BASE}/propose_teams?group_id=${groupId}&match_date=${matchDate}`);
    const data = await res.json();
    // Use 'couples' from the backend response
    setProposedTeams(prev => ({ ...prev, [matchDate]: (data && data.couples) || [] }));
    setProposeLoading(prev => ({ ...prev, [matchDate]: false }));
  };

  // --- ADDED: Calculate end of today ---
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return (
    <div className="card">
      <div className="content-header"><h2>Schedule & Register for Next Match</h2></div>
      <form
        className="create-match-form"
        onSubmit={handleCreateMatch}
      >
        <div>
          <label>Group</label>
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            required
          >
            <option value="">Select Group</option>
            {(userGroups || []).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Match Date</label>
          <input
            type="date"
            value={newMatchDate}
            onChange={e => setNewMatchDate(e.target.value)}
            required
          />
        </div>
        <button type="submit">Create Next Match</button>
      </form>
      {nextMatchMsg && <p>{nextMatchMsg}</p>}

      <h4 style={{ fontWeight: 700, fontSize: 22, margin: '32px 0 18px 0' }}>Upcoming Matches</h4>
      <div className="upcoming-matches-list">
        {nextMatches
          .filter(match => new Date(match.match_date) <= endOfToday)
          .map(match => (
            <div className="match-card" key={match.id}>
              <button
                className="delete-btn"
                title="Delete match"
                onClick={() => handleDeleteNextMatch(selectedGroup, match.id)}
              >
                <FiTrash2 />
              </button>
              <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 4 }}>
                Group: {userGroups.find(g => g.id === selectedGroup)?.name || selectedGroup}
              </div>
              <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 12 }}>
                Match: {match.match_date} <span style={{
                  background: "#f3f6fa",
                  borderRadius: 8,
                  padding: "2px 10px",
                  fontSize: 13,
                  marginLeft: 8
                }}>{match.registered_users?.length || 0} Players</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>Players:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {(match.registered_users || []).map(username => {
                    const player = players.find(p => p.name === username);
                    const nickname = player ? (player.nickname || player.name) : username;
                    return (
                      <span className="player-chip" key={username}>
                        {nickname}
                        <button
                          className="remove-chip"
                          title="Remove from match"
                          onClick={() => handleRemovePlayerFromNextMatch(selectedGroup, match.match_date, username)}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
              <form
                className="form-row"
                onSubmit={e => {
                  e.preventDefault();
                  if (!selectedMatchPlayers[match.match_date]) return;
                  handleAddPlayerToNextMatch(selectedGroup, match.match_date, selectedMatchPlayers[match.match_date]);
                }}
              >
                <PlayerDropdown
                  value={selectedMatchPlayers[match.match_date] || ''}
                  onChange={val =>
                    setSelectedMatchPlayers(prev => ({ ...prev, [match.match_date]: val }))
                  }
                  players={players.filter(
                    p => !(match.registered_users || []).includes(p.name)
                  )}
                  selectedGroup={selectedGroup}
                  fetchPlayers={() => fetchPlayers(selectedGroup)}
                />
                <button
                  type="submit"
                  className="btn-green"
                  style={{ minWidth: 120, fontWeight: 600 }}
                  disabled={!selectedMatchPlayers[match.match_date]}
                >
                  Add to Match
                </button>
              </form>
              <button
                className="propose-btn"
                onClick={() => handleProposeTeams(selectedGroup, match.match_date)}
                disabled={proposeLoading[match.match_date]}
              >
                {proposeLoading[match.match_date] ? 'Proposing...' : 'Propose Teams'}
              </button>
              {proposedTeams[match.match_date] && proposedTeams[match.match_date].length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Proposed Teams:</strong>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {proposedTeams[match.match_date].map((team, idx) => (
                      <li key={idx} style={{ fontSize: 15 }}>{team.join(' & ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}