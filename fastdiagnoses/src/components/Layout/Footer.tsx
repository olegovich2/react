import React from 'react';
import './Footer.css'; // Импортируем стили

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <h6 className="footer_content">&copy; {currentYear} olegovich</h6>
    </footer>
  );
};

Footer.displayName='Footer';

export default Footer;