import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import './App.css';
import Sidebar from './components/Sidebar';
import GroupManagement from './components/GroupManagement';
import MyPadel from './components/MyPadel';
import CreateMatch from './components/CreateMatch';
import ResultsPage from './components/ResultsPage';
import Ratings from './components/Ratings';
import Profile from './components/Profile';
import { FiUserPlus, FiTrash2, FiCopy, FiMenu, FiX } from 'react-icons/fi';

//const API_BASE = 'http://127.0.0.1:8000';
const API_BASE = 'https://padel-4apg.onrender.com';


function getAllPairs(arr) {
  let pairs = [];
  for (let i = 0; i < arr.length; ++i) {
    for (let j = i + 1; j < arr.length; ++j) {
      pairs.push([arr[i], arr[j]]);
    }
  }
  return pairs;
}

function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login');
  const [menuView, setMenuView] = useState('dashboard');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(window.innerWidth > 768);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const [newNickname, setNewNickname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [groupMsg, setGroupMsg] = useState('');
  const [registerGroupId, setRegisterGroupId] = useState('');
  const [registerMsg, setRegisterMsg] = useState('');
  const [copiedGroupId, setCopiedGroupId] = useState(null);

  const [players, setPlayers] = useState([]);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerMsg, setAddPlayerMsg] = useState('');

  const [nextMatches, setNextMatches] = useState([]);
  const [newMatchDate, setNewMatchDate] = useState('');
  const [nextMatchMsg, setNextMatchMsg] = useState('');
  const [proposedTeams, setProposedTeams] = useState({});
  const [proposeLoading, setProposeLoading] = useState({});

  const [matches, setMatches] = useState([]);
  const [selectedResultMatchId, setSelectedResultMatchId] = useState('');
  const [selectedResultMatch, setSelectedResultMatch] = useState(null);
  const [resultMode, setResultMode] = useState('all');
  const [resultCouples, setResultCouples] = useState([]);
  const [resultResults, setResultResults] = useState([]);
  const [addResultPlayerPrompt, setAddResultPlayerPrompt] = useState({ show: false, coupleIdx: null, playerIdx: null });
  const [editOld, setEditOld] = useState(null);
  const [showAddCompletedMatchForm, setShowAddCompletedMatchForm] = useState(false);

  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [showGroupForm, setShowGroupForm] = useState(false);

  // Ratings
  const [playerRatings, setPlayerRatings] = useState([]);
  const [coupleRatings, setCoupleRatings] = useState([]);
  const [lastGames, setLastGames] = useState([]);
  const [topPartners, setTopPartners] = useState([]);
  const [worstPartners, setWorstPartners] = useState([]);
  const [topCouples, setTopCouples] = useState([]);
  const [worstCouples, setWorstCouples] = useState([]);

  // For PlayerDropdown in each match
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState({});

  // Player ID maps for display
  const [playerMap, setPlayerMap] = useState({});
  const [nameToId, setNameToId] = useState({});

  // --- Registration Group Player Linking State ---
  const [existingGroupPlayers, setExistingGroupPlayers] = useState([]);
  const [selectedExistingPlayer, setSelectedExistingPlayer] = useState('');
  const [loadingGroupPlayers, setLoadingGroupPlayers] = useState(false);
  const [groupPlayersError, setGroupPlayersError] = useState('');

  useEffect(() => {
    const map = {};
    const n2id = {};
    players.forEach(p => {
      if (p.id) map[p.id] = p;
      n2id[p.name] = p.id;
    });
    setPlayerMap(map);
    setNameToId(n2id);
  }, [players]);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserGroups();
      fetchPlayers();
      fetchMatches();
      fetchNextMatches();
      fetchPlayerRatings();
      fetchCoupleRatings();
      fetchLastGames();
      setNewNickname(user.user_metadata?.nickname || '');
    }
  }, [user]);

  useEffect(() => {
    if (selectedGroup) {
      fetchPlayerRatings();
      fetchCoupleRatings();
      fetchLastGames();
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (userGroups && userGroups.length === 1) {
      setSelectedGroup(userGroups[0].id);
      fetchNextMatches(userGroups[0].id);
      fetchPlayers(userGroups[0].id);
      fetchMatches(userGroups[0].id);
    }
  }, [userGroups]);

  useEffect(() => {
    if (selectedGroup) {
      fetchNextMatches(selectedGroup);
      fetchPlayers(selectedGroup);
      fetchMatches(selectedGroup);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedResultMatchId) {
      setSelectedResultMatch(null);
      setResultCouples([]);
      setResultResults([]);
      setResultMode('all');
      return;
    }
    const match
 = (nextMatches || []).find(m => String(m.id) === String(selectedResultMatchId));
    setSelectedResultMatch(match || null);
    if (match) {
      let regs = match.registered_users || [];
      let pairs = [];
      for (let i = 0; i < regs.length; i += 2) {
        pairs.push([regs[i] || '', regs[i + 1] || '']);
      }
      setResultCouples(pairs);
      setResultResults([]);
      setResultMode('all');
    }
  }, [selectedResultMatchId, nextMatches]);

  useEffect(() => {
    if (resultMode === 'all' && resultCouples.length > 1) {
      let allPairs = getAllPairs(resultCouples);
      setResultResults(allPairs.map(pair => ({
        team1: pair[0],
        team2: pair[1],
        score1: '',
        score2: '',
      })));
    }
  }, [resultCouples, resultMode]);

  useEffect(() => {
    if (!matches || !user) return;
    const partnerStats = {};
    matches.forEach(match => {
      let userTeam = null;
      if (match.team1 && match.team1.includes(user.email)) userTeam = match.team1;
      if (match.team2 && match.team2.includes(user.email)) userTeam = match.team2;
      if (!userTeam) return;
      const partner = userTeam.find(p => p !== user.email);
      if (!partner) return;
      const win = (match.team1.includes(user.email) && match.score1 > match.score2) ||
                  (match.team2.includes(user.email) && match.score2 > match.score1);
      if (!partnerStats[partner]) partnerStats[partner] = { wins: 0, losses: 0, total: 0 };
      if (win) partnerStats[partner].wins += 1;
      else partnerStats[partner].losses += 1;
      partnerStats[partner].total += 1;
    });
    const sortedPartners = Object.entries(partnerStats)
      .map(([username, stats]) => ({
        name: username,
        winRate: stats.total ? (stats.wins / stats.total) : 0,
        total: stats.total
      }))
      .sort((a, b) => b.winRate - a.winRate);

    setTopPartners(sortedPartners.slice(0, 3));
    setWorstPartners(sortedPartners.slice(-3).reverse());
  }, [matches, user]);

  // Fetch functions
  const fetchPlayers = async (groupId = selectedGroup) => {
    if (!groupId) {
      setPlayers([]);
      return;
    }
    const res = await fetch(`${API_BASE}/players?group_id=${groupId}`);
    const data = await res.json();
    setPlayers(data || []);
  };

  const fetchUserGroups = async () => {
    if (!user) return;
    const res = await fetch(`${API_BASE}/view_groups?username=${user.email}`);
    const data = await res.json();
    setUserGroups((data && data.groups) || []);
  };

  const fetchNextMatches = async (groupId = selectedGroup) => {
    if (!groupId) {
      setNextMatches([]);
      return;
    }
    const res = await fetch(`${API_BASE}/next_matches?group_id=${groupId}`);
    const data = await res.json();
    setNextMatches((data && data.matches) || []);
  };

  const fetchMatches = async (groupId = selectedGroup) => {
    if (!groupId) {
      setMatches([]);
      return;
    }
    const res = await fetch(`${API_BASE}/matches?group_id=${groupId}`);
    const data = await res.json();
    setMatches((data && data.matches) || []);
  };

  const fetchPlayerRatings = async () => {
    if (!selectedGroup) return;
    const res = await fetch(`${API_BASE}/player_ratings?group_id=${selectedGroup}`);
    const data = await res.json();
    setPlayerRatings((data && data.players) || []);
  };

  const fetchCoupleRatings = async () => {
    if (!selectedGroup) return;
    const res = await fetch(`${API_BASE}/couple_ratings?group_id=${selectedGroup}`);
    const data = await res.json();
    setCoupleRatings((data && data.couples) || []);

    // Compute win rates and sort
    const couples = (data && data.couples) || [];
    const couplesWithWinRate = couples.map(c => ({
      player1: c.player1,
      player2: c.player2,
      winRate: c.matches_played ? Math.round((c.matches_won / c.matches_played) * 100) : 0
    }));

    // Sort descending for top, ascending for worst
    const sorted = [...couplesWithWinRate].sort((a, b) => b.winRate - a.winRate);

    setTopCouples(sorted.slice(0, 3));
    setWorstCouples(sorted.slice(-3).reverse());
  };

  const fetchLastGames = async () => {
    if (!selectedGroup) return;
    const res = await fetch(`${API_BASE}/last_games?group_id=${selectedGroup}`);
    const data = await res.json();
    setLastGames((data && data.games) || []);
  };

  // Auth handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  };

  // --- UPDATED REGISTRATION HANDLER ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) setError(error.message);
    else {
      await fetch(`${API_BASE}/set_nickname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, nickname }),
      });
      // If group id and player selected, link user to player
      if (registerGroupId && selectedExistingPlayer) {
        await fetch(`${API_BASE}/link_user_to_player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group_id: registerGroupId,
            player_name: selectedExistingPlayer,
            username: email
          }),
        });
      }
      alert('Registration successful! Please check your email to confirm.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
    setNickname('');
  };

  // Profile handlers
  const handleUpdateNickname = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    const response = await fetch(`${API_BASE}/set_nickname`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.email, nickname: newNickname }),
    });
    const data = await response.json();
    if (data.error) {
      setProfileMsg(`Error: ${data.error}`);
    } else {
      setProfileMsg('Nickname updated successfully!');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setProfileMsg(`Error: ${error.message}`);
    } else {
      setProfileMsg('Password updated successfully!');
      setNewPassword('');
    }
  };

  // Teams page handlers
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setGroupMsg('');
    const response = await fetch(`${API_BASE}/create_group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_name: newGroup, username: user.email, nickname
 })
    });
    const data = await response.json();
    setGroupMsg('Group created!');
    setNewGroup('');
    await fetchUserGroups();

    let newGroupId = data && data.group_id;
    if (!newGroupId && userGroups.length > 0) {
      newGroupId = userGroups[userGroups.length - 1].id;
    }
    if (newGroupId) {
      setSelectedGroup(newGroupId);
      await fetch(`${API_BASE}/add_player_to_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.email, group_id: newGroupId, nickname })
      });
      fetchPlayers(newGroupId);
    }
  };

  const handleRegisterGroup = async (e) => {
    e.preventDefault();
    setRegisterMsg('');
    await fetch(`${API_BASE}/register_in_group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.email, group_id: selectedGroup, nickname: user.nickname })
    });
    setRegisterMsg('Registered in group!');
    setRegisterGroupId('');
    await fetchUserGroups();

    if (registerGroupId) {
      await fetch(`${API_BASE}/add_player_to_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.email, group_id: selectedGroup, nickname: user.nickname })
      });
      fetchPlayers(registerGroupId);
      setSelectedGroup(registerGroupId);
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
    }
  };

  // Add/Remove player logic
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
    const res = await fetch(`${API_BASE}/add_player_to_group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addPlayerName.trim(), group_id: selectedGroup, nickname: addPlayerName.trim() })
    });
    const data = await res.json();
    setAddPlayerMsg(data.message || 'Player added!');
    setAddPlayerName('');
    fetchPlayers();
  };

  // Add player to match (using PlayerDropdown)
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

  // Remove player from match
  const handleRemovePlayerFromNextMatch = async (groupId, matchDate, username) => {
    await fetch(`${API_BASE}/remove_player_from_next_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, match_date: matchDate, username })
    });
    fetchNextMatches(groupId);
  };

  // Delete a match
  const handleDeleteNextMatch = async (groupId, matchId) => {
    if (!window.confirm('Are you sure you want to delete this match?')) return;
    await fetch(`${API_BASE}/delete_next_match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, match_id: matchId }),
    });
    fetchNextMatches(groupId);
  };

  // Propose teams
  const handleProposeTeams = async (groupId, matchDate) => {
    setProposeLoading(prev => ({ ...prev, [matchDate]: true }));
    setProposedTeams(prev => ({ ...prev, [matchDate]: [] }));
    const res = await fetch(`${API_BASE}/propose_teams?group_id=${groupId}&match_date=${matchDate}`);
    const data = await res.json();
    setProposedTeams(prev => ({ ...prev, [matchDate]: (data && data.teams) || [] }));
    setProposeLoading(prev => ({ ...prev, [matchDate]: false }));
  };

  // Register results logic
  const handleAddResultPlayer = async (name) => {
    if (!name.trim()) return;
    await fetch(`${API_BASE}/add_player_to_group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), group_id: selectedGroup, nickname: name.trim() })
    });
    fetchPlayers();
    setResultCouples(couples => {
      let newCouples = [...couples];
      newCouples[addResultPlayerPrompt.coupleIdx][addResultPlayerPrompt.playerIdx] = name.trim();
      return newCouples;
    });
    setAddResultPlayerPrompt({ show: false, coupleIdx: null, playerIdx: null });
  };

  const handleSaveResults = async () => {
    await fetch(`${API_BASE}/register_match_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        group_id: selectedGroup,
        match_id: selectedResultMatch.id,
        mode: resultMode,
        couples: resultCouples,
        results: resultResults,
      })
    });
    fetchNextMatches(selectedGroup);
    fetchMatches(selectedGroup);
    setSelectedResultMatchId('');
  };

  const handleUpdateOldResult = async () => {
    await fetch(`${API_BASE}/update_match_result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match_id: editOld.id,
        group_id: selectedGroup,
        couples: editOld.couples,
        results: editOld.results,
      })
    });
    fetchMatches(selectedGroup);
    setEditOld(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user) {
    return (
      <div className="login-container">
        <h2>Welcome to PadelPals</h2>
        <p>{
view === 'login' ? 'Sign in to continue' : 'Create your account'}</p>
        <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
          {view === 'register' && (
            <>
              <input
                type="text"
                placeholder="Nickname"
                value={nickname}
                required
                onChange={e => setNickname(e.target.value)}
              />
              {/* --- Group ID and Player Linking Fields --- */}
              <input
                type="text"
                placeholder="Group ID (optional)"
                value={registerGroupId}
                onChange={e => {
                  setRegisterGroupId(e.target.value);
                  setExistingGroupPlayers([]);
                  setSelectedExistingPlayer('');
                  setGroupPlayersError('');
                }}
              />
              {registerGroupId && (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-gray"
                    disabled={loadingGroupPlayers}
                    onClick={async () => {
                      setLoadingGroupPlayers(true);
                      setGroupPlayersError('');
                      try {
                        const res = await fetch(`${API_BASE}/players?group_id=${registerGroupId}`);
                        if (!res.ok) throw new Error('Failed to fetch group players');
                        const data = await res.json();
                        if (!data.length) {
                          setGroupPlayersError('No players found for this group.');
                          setExistingGroupPlayers([]);
                        } else {
                          setExistingGroupPlayers(data);
                        }
                      } catch (err) {
                        setGroupPlayersError('Could not load group players.');
                        setExistingGroupPlayers([]);
                      }
                      setLoadingGroupPlayers(false);
                    }}
                  >
                    {loadingGroupPlayers ? 'Loading...' : 'Load Group Players'}
                  </button>
                  {groupPlayersError && <div style={{ color: 'red' }}>{groupPlayersError}</div>}
                  {existingGroupPlayers.length > 0 && (
                    <select
                      value={selectedExistingPlayer}
                      onChange={e => setSelectedExistingPlayer(e.target.value)}
                      required
                      style={{ marginTop: 8 }}
                    >
                      <option value="">Select yourself from group players</option>
                      {existingGroupPlayers.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={e => setPassword(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            {view === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          {view === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setView(view === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: 0 }}>
            {view === 'login' ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="App">
      <button className="mobile-menu-toggle" onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}>
        {isSidebarExpanded ? <FiX /> : <FiMenu />}
      </button>
      <Sidebar
        menuView={menuView}
        setMenuView={setMenuView}
        handleLogout={handleLogout}
        isSidebarExpanded={isSidebarExpanded}
      />
      <main className="main-content">
        {menuView === 'dashboard' && (
          <MyPadel
            nextMatches={nextMatches}
            lastGames={lastGames}
            players={players}
            playerMap={playerMap}
            topPartners={topPartners}
            worstPartners={worstPartners}
          />
        )}

        {menuView === 'ratings' && (
          <Ratings selectedGroup={selectedGroup} />
        )}

        {menuView === 'profile' && (
          <Profile user={user} />
        )}

        {menuView === 'teams' && (
          <GroupManagement user={user} />
        )}

        {menuView === 'createMatch' && (
          <CreateMatch
            user={user}
            userGroups={userGroups}
            selectedGroup={selectedGroup}
            setSelectedGroup={setSelectedGroup}
          />
        )}

        {menuView === 'registerResults' && (
          <ResultsPage
            user={user}
            userGroups={userGroups}
            selectedGroup={selectedGroup}
            setSelectedGroup={setSelectedGroup}
            fetchUserGroups={fetchUserGroups}
          />
        )}
      </main>
    </div>
  );
}

export default App;