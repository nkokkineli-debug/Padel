import { useState, useEffect } from 'react';

export function useMatches(selectedGroup) {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!selectedGroup) {
      setMatches([]);
      return;
    }
    fetch(`http://127.0.0.1:8000/matches?group_id=${selectedGroup}`)
      .then(res => res.json())
      .then(data => setMatches((data && data.matches) || []));
  }, [selectedGroup]);

  return matches;
}