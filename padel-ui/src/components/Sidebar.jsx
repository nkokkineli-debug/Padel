import React from 'react';
import {
  FiHome, FiPlusCircle, FiCheckSquare, FiBarChart2, FiUser, FiSettings, FiLogOut, FiUsers as FiGroup
} from 'react-icons/fi';

function Sidebar({ menuView, setMenuView, handleLogout, isSidebarExpanded }) {
  return (
    <div className={`sidebar ${isSidebarExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="sidebar-header">
        <FiGroup size={28} color="var(--primary-color)" />
        <span className="logo-text">PadelPals</span>
      </div>
      <nav>
        <a href="#" className={`nav-item ${menuView === 'dashboard' ? 'active' : ''}`} onClick={() => setMenuView('dashboard')}>
          <FiHome /><span className="nav-text">My Padel</span>
        </a>
        <a href="#" className={`nav-item ${menuView === 'teams' ? 'active' : ''}`} onClick={() => setMenuView('teams')}>
          <FiGroup /><span className="nav-text">Group Management</span>
        </a>
        <a href="#" className={`nav-item ${menuView === 'createMatch' ? 'active' : ''}`} onClick={() => setMenuView('createMatch')}>
          <FiPlusCircle /><span className="nav-text">Create Match</span>
        </a>
        <a href="#" className={`nav-item ${menuView === 'registerResults' ? 'active' : ''}`} onClick={() => setMenuView('registerResults')}>
          <FiCheckSquare /><span className="nav-text">Register Results</span>
        </a>
        <a href="#" className={`nav-item ${menuView === 'ratings' ? 'active' : ''}`} onClick={() => setMenuView('ratings')}>
          <FiBarChart2 /><span className="nav-text">Ratings</span>
        </a>
      </nav>
      <div className="sidebar-footer">
        <a href="#" className={`nav-item ${menuView === 'profile' ? 'active' : ''}`} onClick={() => setMenuView('profile')}>
          <FiUser /><span className="nav-text">Profile</span>
        </a>
        <a href="#" className="nav-item" onClick={handleLogout}>
          <FiLogOut /><span className="nav-text">Logout</span>
        </a>
      </div>
    </div>
  );
}

export default Sidebar;