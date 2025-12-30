import React, { useEffect, useState } from "react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

export default function Profile({ user }) {
  const [backendNickname, setBackendNickname] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');

  // Fetch nickname from backend
  const fetchBackendNickname = async (email) => {
    if (!email) return;
    try {
      const res = await fetch(`${API_BASE}/get_nickname?username=${encodeURIComponent(email)}`);
      const data = await res.json();
      setBackendNickname(data.nickname || '');
      setNewNickname(data.nickname || '');
    } catch (err) {
      setBackendNickname('');
    }
  };

  useEffect(() => {
    if (user && user.email) {
      fetchBackendNickname(user.email);
    }
    // eslint-disable-next-line
  }, [user]);

  // Update nickname in backend
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
      fetchBackendNickname(user.email);
    }
  };

  // Update password in Supabase
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    // You must pass supabase as a prop or import it here if you want to support password change
    if (!window.supabase) {
      setProfileMsg('Password change not supported in this context.');
      return;
    }
    const { error } = await window.supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setProfileMsg(`Error: ${error.message}`);
    } else {
      setProfileMsg('Password updated successfully!');
      setNewPassword('');
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400 }}>
      <div className="content-header"><h2>Profile</h2></div>
      <div>
        <strong>Email:</strong> {user.email}
      </div>
      <div>
        <strong>Nickname:</strong> {backendNickname}
      </div>
      <form onSubmit={handleUpdateNickname} style={{ marginTop: 16 }}>
        <label>Change Nickname:</label>
        <input
          type="text"
          value={newNickname}
          onChange={e => setNewNickname(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit" className="btn btn-primary">Update Nickname</button>
      </form>
      <form onSubmit={handleUpdatePassword} style={{ marginTop: 16 }}>
        <label>Change Password:</label>
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit" className="btn btn-primary">Update Password</button>
      </form>
      {profileMsg && <p style={{ color: 'green', marginTop: 8 }}>{profileMsg}</p>}
    </div>
  );
}