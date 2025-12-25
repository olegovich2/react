import React, { ReactNode } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import Header from '../Header/Header';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({children}) => {
  console.log(children, '-----------');
  
  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-layout-main">
        <Header />
        <main className="admin-layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};

AdminLayout.displayName = 'AdminLayout';
export default AdminLayout;