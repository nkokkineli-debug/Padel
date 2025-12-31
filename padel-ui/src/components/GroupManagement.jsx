import React, { useState, useEffect } from 'react';
import { FiCopy, FiTrash2, FiUserPlus } from 'react-icons/fi';

//const API_BASE = process.env.REACT_APP_API_BASE || 'http://127.0.0.1:8000';
const API_BASE = process.env.REACT_APP_API_BASE || "https://padel-4apg.onrender.com";

export default function GroupManagement({ user }) {
  // --- State
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);

  // Create group
  const [newGroup, setNewGroup] = useState('');
  const [groupMsg, setGroupMsg] = useState('');

  // Join group
  const [registerGroupId, setRegisterGroupId] = useState('');
  const [registerMsg, setRegisterMsg] = useState('');

  // Copy group id
  const [copiedGroupId, setCopiedGroupId] = useState(null);

  // Players
  const [players, setPlayers] = useState([]);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerMsg, setAddPlayerMsg] = useState('');

  // --- Fetch user groups
  const fetchUserGroups = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/view_groups?username=${user.email}`);
      if (!res.ok) throw new Error('Failed to fetch groups');
      const data = await res.json();
      setUserGroups((data && data.groups) || []);
      if (data && data.groups && data.groups.length === 1) {
        setSelectedGroup(data.groups[0].id);
      }
    } catch (err) {
      setUserGroups([]);
      alert('Error fetching groups: ' + err.message);
    }
  };

  // --- Fetch players in selected group
  const fetchPlayers = async (groupId = selectedGroup) => {
    if (!groupId) {
      setPlayers([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/players?group_id=${groupId}`);
      if (!res.ok) throw new Error('Failed to fetch players');
      const data = await res.json();
      setPlayers(data || []);
    } catch (err) {
      setPlayers([]);
      alert('Error fetching players: ' + err.message);
    }
  };

  // --- Effects
  useEffect(() => {
    fetchUserGroups();
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (selectedGroup) fetchPlayers(selectedGroup);
  }, [selectedGroup]);

  // --- Handlers
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setGroupMsg('');
    try {
      const response = await fetch(`${API_BASE}/create_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: newGroup, username: user.email, nickname: user.nickname || user.email })
      });
      const data = await response.json();
      if (data.error) {
        setGroupMsg(data.error);
        return;
      }
      setGroupMsg('Group created!');
      setNewGroup('');
      await fetchUserGroups();
      let newGroupId = data && (data.group_id || data.id);
      if (!newGroupId && userGroups.length > 0) {
        newGroupId = userGroups[userGroups.length - 1].id;
      }
      if (newGroupId) {
        setSelectedGroup(newGroupId);
        await fetch(`${API_BASE}/add_player_to_group`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: newGroupId, nickname: user.nickname || user.email, username: user.email })
        });
        fetchPlayers(newGroupId);
      }
    } catch (err) {
      setGroupMsg('Error creating group: ' + err.message);
    }
  };

  const handleRegisterGroup = async (e) => {
    e.preventDefault();
    setRegisterMsg('');
    try {
      await fetch(`${API_BASE}/register_in_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: registerGroupId, nickname: user.nickname || user.email, username: user.email })
      });
      setRegisterMsg('Registered in group!');
      setRegisterGroupId('');
      await fetchUserGroups();
      if (registerGroupId) {
        await fetch(`${API_BASE}/add_player_to_group`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: registerGroupId, nickname: user.nickname || user.email, username: user.email })
        });
        fetchPlayers(registerGroupId);
        setSelectedGroup(registerGroupId);
      }
    } catch (err) {
      setRegisterMsg('Error joining group: ' + err.message);
    }
  };

  const handleCopyGroupId = (groupId) => {
    navigator.clipboard.writeText(groupId).then(() => {
      setCopiedGroupId(groupId);
      setTimeout(() => setCopiedGroupId(null), 2000);
    });
  };

  const handleDeleteGroup = async (groupId) => {
    if (window.confirm('Are you sure you want to delete this group and all its matches? This action cannot be undone.')) {
      await fetch(`${API_BASE}/delete_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId })
      });
      fetchUserGroups();
      if (selectedGroup === groupId) setSelectedGroup('');
      setPlayers([]);
    }
  };

  const handleAddPlayerToGroup = async (e) => {
    e.preventDefault();
    setAddPlayerMsg('');
    if (!selectedGroup) {
      setAddPlayerMsg('Please select a group before adding a player.');
      return;
    }
    if (!addPlayerName.trim()) {
      setAddPlayerMsg('Player name cannot be empty.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/add_player_to_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: selectedGroup, nickname: addPlayerName.trim(), username: user.email })
      });
      const data = await res.json();
      setAddPlayerMsg(data.message || 'Player added!');
      setAddPlayerName('');
      fetchPlayers();
    } catch (err) {
      setAddPlayerMsg('Error adding player: ' + err.message);
    }
  };

  const handleRemovePlayerFromGroup = async (playerName) => {
    if (!window.confirm(`Remove player "${playerName}" from this group?`)) return;
    await fetch(`${API_BASE}/remove_player_from_group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: selectedGroup, name: playerName })
    });
    fetchPlayers();
  };

  // --- UI
  return (
    <div className="group-management-container">
      <div className="group-card">
        <h3 style={{ marginBottom: 24 }}>Manage Your Group</h3>
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontWeight: 500, color: 'var(--text-light)' }}>Selected Group:</span>{' '}
          <span style={{ fontWeight: 600 }}>
            {selectedGroup
              ? (userGroups.find(g => g.id === selectedGroup)?.name || selectedGroup)
              : 'None'}
          </span>
        </div>
        {userGroups.length > 1 && (
          <div style={{ marginBottom: 18 }}>
            <select
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              required
            >
              <option value="">Select Group</option>
              {userGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Add Player to Group</div>
        <form className="add-player-row" onSubmit={handleAddPlayerToGroup}>
          <input
            type="text"
            placeholder="Player name"
            value={addPlayerName}
            onChange={e => setAddPlayerName(e.target.value)}
            required
          />
          <button type="submit" className="btn-green"><FiUserPlus /> Add</button>
        </form>
        {addPlayerMsg && <p style={{ color: 'var(--danger-red)', marginBottom: 8 }}>{addPlayerMsg}</p>}
        <div style={{ fontWeight: 600, margin: '18px 0 8px 0' }}>Players in this group:</div>
        <div className="player-list">
          {(players || []).map(p => (
            <div className="player-list-item" key={p.name}>
              {p.nickname || p.name}
              <button
                className="delete-btn"
                title="Remove from group"
                onClick={() => handleRemovePlayerFromGroup(p.name)}
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="my-groups-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0 }}>My Groups</h3>
          <button className="btn-green" onClick={() => setShowGroupForm((prev) => !prev)}>
            + Create/Join Group
          </button>
        </div>
        {showGroupForm && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Create a Group</div>
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="New Group Name" value={newGroup} onChange={e => setNewGroup(e.target.value)} required />
              <button type="submit" className="btn-green">Create</button>
            </form>
            {groupMsg && <p>{groupMsg}</p>}
            <hr />
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Join a Group</div>
            <form onSubmit={handleRegisterGroup} style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="Group ID to Join" value={registerGroupId} onChange={e => setRegisterGroupId(e.target.value)} required />
              <button type="submit" className="btn-gray">Join</button>
            </form>
            {registerMsg && <p>{registerMsg}</p>}
          </div>
        )}
        <div className="my-groups-list">
          {(userGroups || []).length > 0 ? (
            userGroups.map(g => (
              <div className="my-group-item" key={g.id}>
                <div className="my-group-title">{g.name}</div>
                <div className="my-group-id">ID: {g.id}</div>
                <div className="my-group-actions">
                  <button onClick={() => handleCopyGroupId(g.id)} className="btn-gray">
                    <FiCopy /> {copiedGroupId === g.id ? 'Copied!' : 'Copy ID'}
                  </button>
                  <button onClick={() => handleDeleteGroup(g.id)} className="btn-red"><FiTrash2 /></button>
                </div>
              </div>
            ))
          ) : <p>You are not a member of any groups yet.</p>}
        </div>
      </div>
    </div>
  );
}