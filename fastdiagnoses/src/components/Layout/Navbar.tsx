import React from 'react';
import './Navbar.css'; // Импортируем стили

interface NavbarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'general', label: 'Опрос по всем системам' },
    { id: 'respiratory', label: 'Дыхательная система' },
    { id: 'cardiovascular', label: 'Сердечно-сосудистая система' },
    { id: 'digestive', label: 'Пищеварительная система' },
    { id: 'urinary', label: 'Мочевыделительная система' },
    { id: 'musculoskeletal', label: 'Опорно-двигательная система' },
  ];

  return (
    <nav className="nav-navbar" data-nav="allTabs">
      <ul className="nav-navlist">
        {tabs.map(tab => (
          <li
            key={tab.id}
            data-list={tab.id}
            className={activeTab === tab.id ? 'nav-active' : ''}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </li>
        ))}
      </ul>
    </nav>
  );
};

Navbar.displayName='Navbar';

export default Navbar;