import React from 'react';

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

function ResultRow({ team1, team2, score1, score2, setsString }) {
  return (
    <div className="result-row">
      <div className="row-content">
        <span className="player-box">{team1}</span>
        <span className="sets-won-box">{score1}</span>
        <span className="vs">vs</span>
        <span className="sets-won-box">{score2}</span>
        <span className="player-box">{team2}</span>
      </div>
      <div className="games-box">{setsString}</div>
    </div>
  );
}

function FixtureRow({ team1, team2, date }) {
  return (
    <div className="result-row">
      <div className="row-content">
        <span className="player-box">{team1}</span>
        <span className="vs">vs</span>
        <span className="player-box">{team2}</span>
      </div>
      <div className="games-box date-box">{date}</div>
    </div>
  );
}

export default function MyPadel({
  nextMatches = [],
  lastGames = [],
  playerMap = {},
}) {
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

  const results = lastGames.map((g, idx) => {
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
      <footer style={{ marginTop: 16, textAlign: 'center', color: COLORS.textLight, fontSize: 14 }}>
        © 2025 PadelPals. All rights reserved.
      </footer>
      <style>{`
        .rows-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          align-items: center;
          width: 100%;
        }
        .result-row {
          width: 100%;
          max-width: 500px;
          margin: 0;
          padding: 0;
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
          background: ${COLORS.background};
          border-radius: 8px;
          padding: 2px 10px;
          display: inline-block;
          font-weight: 600;
        }
        .sets-won-box {
          background: ${COLORS.accent};
          color: #fff;
          border-radius: 6px;
          font-size: 0.95em;
          font-weight: 700;
          padding: 1px 7px;
          display: inline-block;
        }
        .vs {
          color: ${COLORS.primary};
          font-weight: 800;
          margin: 0 2px;
        }
        .games-box {
          background: ${COLORS.background};
          border-radius: 0 0 8px 8px;
          font-size: 0.98rem;
          font-weight: 600;
          width: 100%;
          text-align: center;
          color: ${COLORS.accent};
          min-height: 22px;
          margin-bottom: 2px;
        }
        .date-box {
          color: ${COLORS.textLight};
        }
        @media (max-width: 700px) {
          .result-row {
            max-width: 98vw;
          }
        }
      `}</style>
    </div>
  );
}