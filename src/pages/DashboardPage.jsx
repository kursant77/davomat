import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import {
    FiUsers, FiCheckCircle, FiXCircle, FiTrendingUp,
    FiLoader, FiAlertTriangle, FiGrid
} from 'react-icons/fi';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DashboardPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [todayStats, setTodayStats] = useState({ total: 0, present: 0, absent: 0, pct: 0 });
    const [trendData, setTrendData] = useState([]);
    const [groupStats, setGroupStats] = useState([]);
    const [top5Absent, setTop5Absent] = useState([]);

    const today = new Date().toISOString().split('T')[0];
    const days30ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchTodayStats(),
                fetchTrend(),
                fetchGroupStats(),
                fetchTop5Absent(),
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchTodayStats = async () => {
        const { data: allStudents } = await supabase.from('students').select('id');
        const total = allStudents?.length ?? 0;

        const { data: todayAtt } = await supabase
            .from('attendance')
            .select('status')
            .eq('date', today);

        const present = (todayAtt || []).filter(a => a.status === 'present').length;
        const absent = (todayAtt || []).filter(a => a.status === 'absent').length;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        setTodayStats({ total, present, absent, pct });
    };

    const fetchTrend = async () => {
        const { data } = await supabase
            .from('attendance')
            .select('date, status')
            .gte('date', days30ago)
            .order('date');

        const byDate = {};
        (data || []).forEach(a => {
            if (!byDate[a.date]) byDate[a.date] = { present: 0, absent: 0 };
            byDate[a.date][a.status]++;
        });

        const result = Object.entries(byDate).map(([date, v]) => {
            const d = new Date(date);
            const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
            return { date: label, keldi: v.present, kelmadi: v.absent };
        });
        setTrendData(result);
    };

    const fetchGroupStats = async () => {
        const { data: groups } = await supabase
            .from('groups')
            .select('id, name')
            .order('name');

        if (!groups?.length) return setGroupStats([]);

        const { data: students } = await supabase
            .from('students')
            .select('id, group_id');

        const { data: att } = await supabase
            .from('attendance')
            .select('student_id, status')
            .gte('date', days30ago);

        const studentGroupMap = {};
        (students || []).forEach(s => { studentGroupMap[s.id] = s.group_id; });

        const groupAgg = {};
        groups.forEach(g => { groupAgg[g.id] = { name: g.name, present: 0, total: 0 }; });

        (att || []).forEach(a => {
            const gid = studentGroupMap[a.student_id];
            if (gid && groupAgg[gid]) {
                groupAgg[gid].total++;
                if (a.status === 'present') groupAgg[gid].present++;
            }
        });

        const result = groups.map(g => ({
            name: g.name.length > 12 ? g.name.slice(0, 12) + '…' : g.name,
            pct: groupAgg[g.id].total > 0
                ? Math.round((groupAgg[g.id].present / groupAgg[g.id].total) * 100)
                : 0,
        }));
        setGroupStats(result);
    };

    const fetchTop5Absent = async () => {
        const { data: att } = await supabase
            .from('attendance')
            .select('student_id, students(full_name, group_id, groups(name))')
            .eq('status', 'absent');

        const counts = {};
        (att || []).forEach(a => {
            const sid = a.student_id;
            if (!counts[sid]) {
                counts[sid] = {
                    id: sid,
                    name: a.students?.full_name ?? '—',
                    group: a.students?.groups?.name ?? '—',
                    count: 0,
                };
            }
            counts[sid].count++;
        });

        const sorted = Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        setTop5Absent(sorted);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload?.length) {
            return (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-xl text-sm">
                    <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
                    {payload.map(p => (
                        <p key={p.name} style={{ color: p.color }} className="font-medium">
                            {p.name === 'keldi' ? 'Keldi' : p.name === 'kelmadi' ? 'Kelmadi' : p.name}: {p.value}
                            {p.name === 'pct' ? '%' : ''}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <FiLoader className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const statCards = [
        {
            label: "Jami o'quvchilar",
            value: todayStats.total,
            icon: <FiUsers className="w-6 h-6" />,
            color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-100 dark:bg-blue-900/40',
        },
        {
            label: 'Bugun keldi',
            value: todayStats.present,
            icon: <FiCheckCircle className="w-6 h-6" />,
            color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
            iconBg: 'bg-green-100 dark:bg-green-900/40',
        },
        {
            label: 'Bugun kelmadi',
            value: todayStats.absent,
            icon: <FiXCircle className="w-6 h-6" />,
            color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-100 dark:bg-rose-900/40',
        },
        {
            label: 'Bugungi davomat',
            value: `${todayStats.pct}%`,
            icon: <FiTrendingUp className="w-6 h-6" />,
            color: 'bg-primary/5 dark:bg-primary/10 text-primary',
            iconBg: 'bg-primary/10 dark:bg-primary/20',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    Umumiy statistika va tahlil
                </p>
            </div>

            {/* Today Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card, idx) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.07 }}
                        className={`rounded-2xl p-5 sm:p-6 ${card.color} border border-transparent`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.iconBg}`}>
                            {card.icon}
                        </div>
                        <p className="text-3xl font-black">{card.value}</p>
                        <p className="text-sm font-medium mt-1 opacity-80">{card.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* 30-day trend */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Oxirgi 30 kunlik trend</h2>
                    <p className="text-sm text-slate-400 mb-5">Kunlik davomat dinamikasi</p>
                    {trendData.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                            Ma'lumot yo'q
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorKeldi" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="keldi" stroke="#2563eb" strokeWidth={2.5} fill="url(#colorKeldi)" dot={false} activeDot={{ r: 5, fill: '#2563eb' }} />
                                <Area type="monotone" dataKey="kelmadi" stroke="#f43f5e" strokeWidth={2} fill="none" strokeDasharray="4 2" dot={false} activeDot={{ r: 4, fill: '#f43f5e' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 bg-primary rounded-full inline-block"></span>Keldi</span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-0.5 bg-rose-400 rounded-full inline-block" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#f87171 0,#f87171 4px,transparent 4px,transparent 6px)' }}></span>Kelmadi</span>
                    </div>
                </motion.div>

                {/* Groups comparison */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm"
                >
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Guruhlar taqqoslash</h2>
                    <p className="text-sm text-slate-400 mb-5">30 kunlik davomat %</p>
                    {groupStats.length === 0 ? (
                        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                            Ma'lumot yo'q
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={groupStats} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={70} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="pct" radius={[0, 6, 6, 0]} maxBarSize={20}>
                                    {groupStats.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>
            </div>

            {/* TOP-5 absent */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
            >
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
                        <FiAlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">TOP-5 Ko'p Kelmaganlar</h2>
                        <p className="text-xs text-slate-400">Barcha vaqt bo'yicha eng ko'p dars qoldirganlar</p>
                    </div>
                </div>

                {top5Absent.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">Ma'lumot yo'q</div>
                ) : (
                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                        {top5Absent.map((s, idx) => (
                            <div
                                key={s.id}
                                onClick={() => navigate(`/students/${s.id}`)}
                                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                            >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${idx === 0 ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600' : idx === 1 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <FiGrid className="w-3 h-3 text-slate-400" />
                                        <p className="text-xs text-slate-400">{s.group}</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-sm font-bold rounded-lg">
                                        <FiXCircle className="w-3.5 h-3.5" />
                                        {s.count} kun
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default DashboardPage;
