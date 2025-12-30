import { useState, useEffect } from 'react';

export function useGroups(user) {
  const [userGroups, setUserGroups] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch(`http://127.0.0.1:8000/view_groups?username=${user.email}`)
      .then(res => res.json())
      .then(data => setUserGroups((data && data.groups) || []));
  }, [user]);

  return userGroups;
}