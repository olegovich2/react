import React from 'react';

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
    <nav className="navbar" data-nav="allTabs">
      <ul className="navlist">
        {tabs.map(tab => (
          <li
            key={tab.id}
            data-list={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => onTabChange(tab.id)}
            style={{ cursor: 'pointer' }}
          >
            {tab.label}
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;