import React, { useState } from 'react';

export default function PlayerDropdown({
  value,
  onChange,
  players,
  selectedGroup,
  fetchPlayers,
}) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [adding, setAdding] = useState(false);

  // Build the player list using name
  const allPlayers = [
    ...(players || []).map(p => ({
      name: p.name, // nickname
      nickname: p.name // always use name
    }))
  ].filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i);

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setAdding(true);
    await fetch('padel-4apg.onrender.com/add_player_to_group', {
    //await fetch('http://127.0.0.1:8000/add_player_to_group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPlayerName.trim(), group_id: selectedGroup, nickname: newPlayerName.trim() })
    });
    setNewPlayerName('');
    setShowAddInput(false);
    setAdding(false);
    fetchPlayers();
    onChange(newPlayerName.trim());
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!showAddInput ? (
        <select
          value={value}
          onChange={e => {
            if (e.target.value === '__add__') {
              setShowAddInput(true);
            } else {
              onChange(e.target.value);
            }
          }}
        >
          <option value="">Select player</option>
          {allPlayers.map(player => (
            <option key={player.name} value={player.name}>
              {player.name}
            </option>
          ))}
          <option value="__add__">Add player...</option>
        </select>
      ) : (
        <>
          <input
            type="text"
            placeholder="New player name"
            value={newPlayerName}
            onChange={e => setNewPlayerName(e.target.value)}
            style={{ minWidth: 120 }}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={handleAddPlayer}
            disabled={adding || !newPlayerName.trim() || allPlayers.some(p => p.name === newPlayerName.trim())}
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setShowAddInput(false);
              setNewPlayerName('');
            }}
            disabled={adding}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}