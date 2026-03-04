import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getGroups } from '../services/groupsService';
import {
    FiChevronLeft, FiChevronRight, FiLoader,
    FiCheckCircle, FiXCircle, FiUsers, FiCalendar
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS_UZ = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

const CalendarPage = () => {
    const navigate = useNavigate();
    const now = new Date();

    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth()); // 0-indexed
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [monthAttendance, setMonthAttendance] = useState({}); // { 'YYYY-MM-DD': { present: N, absent: N } }
    const [selectedDate, setSelectedDate] = useState(null);
    const [dayDetail, setDayDetail] = useState([]); // [{ student, status }]
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [loadingDay, setLoadingDay] = useState(false);

    useEffect(() => {
        getGroups().then(setGroups).catch(() => {});
    }, []);

    useEffect(() => {
        fetchMonthData();
        setSelectedDate(null);
        setDayDetail([]);
    }, [year, month, selectedGroup]);

    const getMonthRange = () => {
        const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { from, to };
    };

    const fetchMonthData = async () => {
        setLoadingMonth(true);
        try {
            const { from, to } = getMonthRange();
            let query = supabase
                .from('attendance')
                .select('date, status, student_id, students(group_id)')
                .gte('date', from)
                .lte('date', to);

            const { data } = await query;

            const agg = {};
            (data || []).forEach(a => {
                if (selectedGroup && a.students?.group_id !== selectedGroup) return;
                if (!agg[a.date]) agg[a.date] = { present: 0, absent: 0 };
                agg[a.date][a.status]++;
            });
            setMonthAttendance(agg);
        } finally {
            setLoadingMonth(false);
        }
    };

    const fetchDayDetail = async (date) => {
        setLoadingDay(true);
        try {
            let query = supabase
                .from('attendance')
                .select('status, students(id, full_name, group_id, groups(name))')
                .eq('date', date);

            const { data } = await query;

            let filtered = data || [];
            if (selectedGroup) {
                filtered = filtered.filter(a => a.students?.group_id === selectedGroup);
            }

            setDayDetail(filtered.sort((a, b) => {
                if (a.status === b.status) return (a.students?.full_name ?? '').localeCompare(b.students?.full_name ?? '');
                return a.status === 'present' ? -1 : 1;
            }));
        } finally {
            setLoadingDay(false);
        }
    };

    const handleDayClick = (dateStr) => {
        const day = monthAttendance[dateStr];
        if (!day && !isToday(dateStr)) return; // no data for future or empty days
        setSelectedDate(dateStr);
        fetchDayDetail(dateStr);
    };

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };

    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };

    const isToday = (dateStr) => dateStr === now.toISOString().split('T')[0];
    const isFuture = (dateStr) => dateStr > now.toISOString().split('T')[0];

    // Build calendar grid
    const firstDayOfMonth = new Date(year, month, 1);
    // Monday=0 offset
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
        const dayNum = i - startOffset + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
            cells.push(null);
        } else {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            cells.push({ dayNum, dateStr });
        }
    }

    const getDayColor = (dateStr) => {
        if (isFuture(dateStr)) return 'text-slate-300 dark:text-slate-700 cursor-default';
        const d = monthAttendance[dateStr];
        if (!d) return 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer';
        const total = d.present + d.absent;
        const pct = total > 0 ? d.present / total : 0;
        if (pct >= 0.8) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 cursor-pointer';
        if (pct >= 0.5) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 cursor-pointer';
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 cursor-pointer';
    };

    const formatSelectedDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}-yil`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Kalendar</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-primary rounded-full"></span>
                        O'tgan davomatlarga ko'z tashlang
                    </p>
                </div>
                {/* Group filter */}
                <select
                    value={selectedGroup}
                    onChange={e => setSelectedGroup(e.target.value)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                >
                    <option value="">Barcha guruhlar</option>
                    {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
            </div>

            {/* Calendar card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Month nav */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={prevMonth}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
                    >
                        <FiChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <FiCalendar className="w-4 h-4 text-primary" />
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {MONTHS_UZ[month]} {year}
                        </h2>
                        {loadingMonth && <FiLoader className="w-4 h-4 text-primary animate-spin" />}
                    </div>
                    <button
                        onClick={nextMonth}
                        disabled={year === now.getFullYear() && month === now.getMonth()}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <FiChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                    {WEEKDAYS.map(d => (
                        <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800">
                    {cells.map((cell, i) => {
                        if (!cell) return (
                            <div key={`empty-${i}`} className="bg-slate-50 dark:bg-slate-900/50 h-16 sm:h-20" />
                        );
                        const { dayNum, dateStr } = cell;
                        const d = monthAttendance[dateStr];
                        const isSelected = selectedDate === dateStr;
                        const todayFlag = isToday(dateStr);
                        const future = isFuture(dateStr);

                        return (
                            <div
                                key={dateStr}
                                onClick={() => !future && handleDayClick(dateStr)}
                                className={`relative bg-white dark:bg-slate-900 h-16 sm:h-20 p-2 transition-all ${getDayColor(dateStr)} ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}`}
                            >
                                <span className={`text-sm font-bold ${todayFlag ? 'w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs' : ''}`}>
                                    {dayNum}
                                </span>
                                {d && !future && (
                                    <div className="mt-1 space-y-0.5 hidden sm:block">
                                        <div className="text-[10px] font-semibold opacity-80">✓ {d.present}</div>
                                        <div className="text-[10px] opacity-60">✗ {d.absent}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4">
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/50 inline-block"></span>≥80% keldi
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-900/50 inline-block"></span>50–79% keldi
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-3 h-3 rounded-sm bg-rose-200 dark:bg-rose-900/50 inline-block"></span>&lt;50% keldi
                    </span>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 inline-block"></span>Ma'lumot yo'q
                    </span>
                </div>
            </div>

            {/* Day detail panel */}
            <AnimatePresence>
                {selectedDate && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                                <FiCalendar className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{formatSelectedDate(selectedDate)}</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {dayDetail.filter(a => a.status === 'present').length} keldi ·{' '}
                                    {dayDetail.filter(a => a.status === 'absent').length} kelmadi
                                </p>
                            </div>
                        </div>

                        {loadingDay ? (
                            <div className="flex justify-center py-10">
                                <FiLoader className="w-6 h-6 text-primary animate-spin" />
                            </div>
                        ) : dayDetail.length === 0 ? (
                            <div className="py-10 text-center">
                                <FiUsers className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                                <p className="text-sm text-slate-400">Bu kun uchun davomat belgilanmagan</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-96 overflow-y-auto">
                                {dayDetail.map((a, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => a.students?.id && navigate(`/students/${a.students.id}`)}
                                        className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${a.status === 'present' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'}`}>
                                                {(a.students?.full_name ?? '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{a.students?.full_name}</p>
                                                <p className="text-xs text-slate-400">{a.students?.groups?.name}</p>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${a.status === 'present' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                                            {a.status === 'present' ? <FiCheckCircle className="w-3.5 h-3.5" /> : <FiXCircle className="w-3.5 h-3.5" />}
                                            {a.status === 'present' ? 'Keldi' : 'Kelmadi'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CalendarPage;
