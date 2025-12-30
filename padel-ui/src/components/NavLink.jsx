import React from 'react';

function NavLink({ icon, text, viewName, menuView, setMenuView }) {
  return (
    <a href="#" className={`nav-item ${menuView === viewName ? 'active' : ''}`} onClick={() => setMenuView(viewName)}>
      {icon}
      <span className="nav-text">{text}</span>
    </a>
  );
}

export default NavLink;