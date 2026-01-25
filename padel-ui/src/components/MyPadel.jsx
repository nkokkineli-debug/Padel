import React, { useState } from 'react';

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

function ResultRow({ team1, team2, score1, score2, setsString, date }) {
  return (
    <>
      <div className="result-row">
        <div className="match-date-row">{date}</div>
        <div className="row-content">
          <span className="player-box">
            <span className="player-name">{team1}</span>
          </span>
          <span className="sets-won-box">{score1}</span>
          <span className="vs">vs</span>
          <span className="sets-won-box">{score2}</span>
          <span className="player-box">
            <span className="player-name">{team2}</span>
          </span>
        </div>
        <div className="sets-row">
          <span className="sets-string-box">{setsString}</span>
        </div>
      </div>
      <div className="match-divider" />
    </>
  );
}

function FixtureRow({ team1, team2, date }) {
  return (
    <>
      <div className="result-row">
        <div className="match-date-row">{date}</div>
        <div className="row-content">
          <span className="player-box">
            <span className="player-name">{team1}</span>
          </span>
          <span className="vs">vs</span>
          <span className="player-box">
            <span className="player-name">{team2}</span>
          </span>
        </div>
      </div>
      <div className="match-divider" />
    </>
  );
}

export default function MyPadel({
  nextMatches = [],
  lastGames = [],
  playerMap = {},
}) {
  const [showAll, setShowAll] = useState(false);

  const getPlayerName = id => playerMap[id] || id;

  const fixtures = nextMatches.map((m, idx) => {
    const team1 = (m.team1 || m.registered_users?.slice(0, 2) || []).map(getPlayerName).join(' & ') || "TBD";
    const team2 = (m.team2 || m.registered_users?.slice(2, 4) || []).map(getPlayerName).join(' & ') || "TBD";
    return (
      <FixtureRow
        key={m.id || idx}
        team1={team1}
        team2={team2}
        date={m.match_date}
      />
    );
  });

  // Show last 10 by default, all if showAll is true or if there are 10 or fewer games recorded
  const resultsToShow = showAll ? lastGames : lastGames.slice(0, 10);

  const results = resultsToShow.map((g, idx) => {
    const team1 = Array.isArray(g.team1)
      ? g.team1.map(getPlayerName).join(' & ')
      : (typeof g.team1 === 'string' ? getPlayerName(g.team1) : '');
    const team2 = Array.isArray(g.team2)
      ? g.team2.map(getPlayerName).join(' & ')
      : (typeof g.team2 === 'string' ? getPlayerName(g.team2) : '');
    return (
      <ResultRow
        key={g.id || idx}
        team1={team1}
        team2={team2}
        score1={g.score1}
        score2={g.score2}
        setsString={g.sets_string}
        date={g.date}
      />
    );
  });

  return (
    <div style={{ background: COLORS.background, minHeight: "100vh", padding: "32px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ color: COLORS.primary, margin: 0, fontSize: 22 }}>Fixtures</h2>
      </div>
      <div className="rows-list">
        {fixtures.length === 0 ? (
          <div style={{ color: COLORS.textLight, textAlign: 'center', padding: 12 }}>
            No upcoming matches scheduled.
          </div>
        ) : fixtures}
      </div>
      <div style={{ textAlign: "center", margin: "24px 0 8px 0" }}>
        <h2 style={{ color: COLORS.primary, margin: 0, fontSize: 22 }}>Results</h2>
      </div>
      <div className="rows-list">
        {results.length === 0 ? (
          <div style={{ color: COLORS.textLight, textAlign: 'center', padding: 12 }}>
            No games played yet.
          </div>
        ) : results}
      </div>
      {lastGames.length > 10 && (
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button
            className="btn-view-all"
            onClick={() => setShowAll(v => !v)}
          >
            {showAll ? "Show Less" : "View All"}
          </button>
        </div>
      )}
      <footer style={{ marginTop: 16, textAlign: 'center', color: COLORS.textLight, fontSize: 14 }}>
        © 2025 PadelPals. All rights reserved.
      </footer>
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
          margin: 0 auto;
          transition: background 0.2s;
        }
        .btn-view-all:hover {
          background: ${COLORS.accent};
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
          padding: 0 0 0 0;
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
        .games-box {
          display: none;
        }
        .date-box {
          color: ${COLORS.textLight};
          border-color: ${COLORS.primary};
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