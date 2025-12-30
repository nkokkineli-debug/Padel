import { useState, useEffect } from 'react';

export function usePlayers(selectedGroup) {
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    if (!selectedGroup) {
      setPlayers([]);
      return;
    }
    fetch(`http://127.0.0.1:8000/players?group_id=${selectedGroup}`)
      .then(res => res.json())
      .then(data => setPlayers(data || []));
  }, [selectedGroup]);

  return players;
}