import React from 'react';

// Padel racket icon as before
const PadelRacketIcon = ({ style = {} }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    style={{ marginRight: 10, ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="10" cy="8" rx="7" ry="7" fill="#6D55FF" />
    <rect x="9" y="14" width="2" height="7" rx="1" fill="#6D55FF" />
    <circle cx="10" cy="8" r="1.2" fill="#fff" />
    <circle cx="13" cy="8" r="1.2" fill="#fff" />
    <circle cx="10" cy="11" r="1.2" fill="#fff" />
    <circle cx="7" cy="8" r="1.2" fill="#fff" />
    <circle cx="10" cy="5" r="1.2" fill="#fff" />
  </svg>
);

function MyPadel({
  nextMatches = [],
  lastGames = [],
  playerMap = {},
  onViewAllMatches = () => {},
  onViewFullHistory = () => {},
}) {
  const getPlayerName = id => playerMap[id] || id;

  return (
    <div className="main-content" style={{ minHeight: '100vh' }}>
      <div className="content-header" style={{ marginBottom: 32 }}>
        <h2>Dashboard</h2>
        <a href="/create-match" className="btn btn-green">Create Match</a>
        {/* If using React Router, use:
        <Link to="/create-match" className="btn btn-green">Create Match</Link>
        */}
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        {/* Main Column */}
        <div style={{ flex: 2 }}>
          {/* Forthcoming Matches */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Forthcoming Matches</h4>
              <button className="btn btn-gray" onClick={onViewAllMatches} style={{ fontSize: 14 }}>View All</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {nextMatches.map((m, idx) => (
                <li key={m.id || idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <PadelRacketIcon />
                  <span style={{ fontWeight: 600, marginRight: 8 }}>{m.match_date}</span>
                  <span style={{ color: 'var(--text-light)', marginRight: 8 }}>{m.location || ''}</span>
                  <span style={{ color: 'var(--text-dark)' }}>
                    {(m.registered_users || []).map(getPlayerName).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Last 5 Games */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Last 5 Games</h4>
              <button className="btn btn-gray" onClick={onViewFullHistory} style={{ fontSize: 14 }}>View All</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {lastGames.map((g, idx) => (
                <li key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 10,
                  borderRadius: 8,
                  padding: '6px 10px'
                }}>
                  <PadelRacketIcon />
                  <span>
                    {g.date ? g.date + ': ' : ''}
                    {Array.isArray(g.team1)
                      ? g.team1.map(getPlayerName).join(' & ')
                      : (typeof g.team1 === 'string' ? getPlayerName(g.team1) : '')
                    }
                    {' vs '}
                    {Array.isArray(g.team2)
                      ? g.team2.map(getPlayerName).join(' & ')
                      : (typeof g.team2 === 'string' ? getPlayerName(g.team2) : '')
                    }
                    {' — '}
                    {(g.score1 !== undefined && g.score2 !== undefined) ? `${g.score1}:${g.score2}` : ''}
                    {g.sets_string ? ` (${g.sets_string})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Side Column removed */}
      </div>
      <footer style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-light)', fontSize: 15 }}>
        © 2025 PadelPulse. All rights reserved.
      </footer>
    </div>
  );
}

export default MyPadel;