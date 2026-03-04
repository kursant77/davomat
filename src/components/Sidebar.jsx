import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FiUsers, FiCheckSquare, FiLogOut, FiBarChart2, FiGrid, FiX, FiMessageSquare, FiCalendar, FiFileText, FiPieChart } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ThemeToggle from './ThemeToggle';
import { motion, AnimatePresence } from 'framer-motion';

const Sidebar = ({ isOpen, onClose }) => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            toast.success('Tizimdan chiqildi');
            navigate('/login');
        } catch {
            toast.error('Xatolik yuz berdi');
        }
    };

    const navItems = [
        { to: '/', name: 'Davomat', icon: <FiCheckSquare className="w-5 h-5" />, end: true },
        { to: '/dashboard', name: 'Dashboard', icon: <FiPieChart className="w-5 h-5" /> },
        { to: '/calendar', name: 'Kalendar', icon: <FiCalendar className="w-5 h-5" /> },
        { to: '/reports', name: 'Hisobot', icon: <FiFileText className="w-5 h-5" /> },
        { to: '/groups', name: 'Guruhlar', icon: <FiGrid className="w-5 h-5" /> },
        { to: '/students', name: 'Talabalar', icon: <FiUsers className="w-5 h-5" /> },
        { to: '/sms-settings', name: 'SMS Sozlamalari', icon: <FiMessageSquare className="w-5 h-5" /> },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={false}
                animate={{ x: 0 }}
                className={`w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen flex flex-col fixed left-0 top-0 z-40 transition-all duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* Header */}
                <div className="p-6 sm:p-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
                            <FiBarChart2 className="text-white w-6 h-6" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Davomat</h1>
                    </div>
                    {/* Close button on mobile */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <FiX className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={onClose}
                            className={({ isActive }) =>
                                `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-200 group ${isActive
                                    ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`
                            }
                        >
                            <span className="transition-transform group-hover:scale-110 duration-200">
                                {item.icon}
                            </span>
                            <span>{item.name}</span>
                            {item.to === '/' && (
                                <span className="ml-auto w-2 h-2 bg-primary rounded-full animate-pulse"></span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sozlamalar</span>
                        <ThemeToggle />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 w-full px-5 py-4 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 group"
                    >
                        <FiLogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Chiqish</span>
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default Sidebar;
