import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { getGroups } from '../services/groupsService';
import { FiLoader, FiPrinter, FiFileText } from 'react-icons/fi';

const MONTHS_UZ = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

const PRINT_STYLES = `
@media print {
    .no-print { display: none !important; }
    body { background: white !important; color: black !important; font-size: 11px; }
    .print-table { border-collapse: collapse; width: 100%; }
    .print-table th, .print-table td { border: 1px solid #ccc; padding: 3px 5px; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const ReportsPage = () => {
    const [searchParams] = useSearchParams();
    const now = new Date();

    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(searchParams.get('group') ?? '');
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [students, setStudents] = useState([]);
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(false);

    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    useEffect(() => {
        getGroups().then(setGroups).catch(() => {});
    }, []);

    useEffect(() => {
        if (selectedGroup) {
            fetchReport();
        } else {
            setStudents([]);
            setAttendanceData({});
        }
    }, [selectedGroup, selectedYear, selectedMonth]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const { data: studs } = await supabase
                .from('students')
                .select('id, full_name')
                .eq('group_id', selectedGroup)
                .order('full_name');

            setStudents(studs || []);
            if (!studs?.length) {
                setAttendanceData({});
                return;
            }

            const padM = String(selectedMonth + 1).padStart(2, '0');
            const padD = String(daysInMonth).padStart(2, '0');
            const from = `${selectedYear}-${padM}-01`;
            const to = `${selectedYear}-${padM}-${padD}`;

            const { data: att } = await supabase
                .from('attendance')
                .select('student_id, date, status')
                .in('student_id', studs.map(s => s.id))
                .gte('date', from)
                .lte('date', to);

            const agg = {};
            studs.forEach(s => { agg[s.id] = {}; });
            (att || []).forEach(a => {
                if (agg[a.student_id]) agg[a.student_id][a.date] = a.status;
            });
            setAttendanceData(agg);
        } finally {
            setLoading(false);
        }
    };

    const getStatus = (studentId, day) => {
        const padM = String(selectedMonth + 1).padStart(2, '0');
        const padD = String(day).padStart(2, '0');
        const dateStr = `${selectedYear}-${padM}-${padD}`;
        return attendanceData[studentId]?.[dateStr] ?? null;
    };

    const getStudentSummary = (studentId) => {
        const rec = attendanceData[studentId] ?? {};
        const present = Object.values(rec).filter(s => s === 'present').length;
        const absent = Object.values(rec).filter(s => s === 'absent').length;
        return { present, absent };
    };

    const getDayTotals = (day) => {
        let present = 0, absent = 0;
        students.forEach(s => {
            const st = getStatus(s.id, day);
            if (st === 'present') present++;
            else if (st === 'absent') absent++;
        });
        return { present, absent };
    };

    const groupName = groups.find(g => g.id === selectedGroup)?.name ?? '';
    const reportTitle = `${groupName} — ${MONTHS_UZ[selectedMonth]} ${selectedYear}`;

    const availableYears = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) availableYears.push(y);

    const cellClass = (status) => {
        if (status === 'present') return 'bg-green-100 text-green-700 font-bold text-center text-xs';
        if (status === 'absent') return 'bg-rose-100 text-rose-600 font-bold text-center text-xs';
        return 'text-slate-300 text-center text-xs';
    };

    const cellSymbol = (status) => {
        if (status === 'present') return '+';
        if (status === 'absent') return '–';
        return '·';
    };

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

            <div className="space-y-6">
                {/* Header */}
                <div className="no-print flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Hisobot</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                            Oylik davomat hisoboti
                        </p>
                    </div>
                    <button
                        onClick={() => window.print()}
                        disabled={!selectedGroup || students.length === 0}
                        className="no-print flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-2xl shadow-lg shadow-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 self-start"
                    >
                        <FiPrinter className="w-4 h-4" />
                        PDF Chop etish
                    </button>
                </div>

                {/* Filters */}
                <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Guruh</label>
                        <select
                            value={selectedGroup}
                            onChange={e => setSelectedGroup(e.target.value)}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                            <option value="">Guruh tanlang...</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Oy</label>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                            {MONTHS_UZ.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Yil</label>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Empty state */}
                {!selectedGroup && (
                    <div className="no-print bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center">
                        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <FiFileText className="w-7 h-7 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Hisobot ko'rish uchun guruh tanlang</p>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="flex justify-center py-16">
                        <FiLoader className="w-7 h-7 text-primary animate-spin" />
                    </div>
                )}

                {/* Report table */}
                {!loading && selectedGroup && students.length > 0 && (
                    <div className="print-area bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        {/* Print header (visible only in print) */}
                        <div className="hidden print:block p-4 border-b border-slate-200 text-center">
                            <h2 className="text-lg font-bold">{reportTitle}</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Davomat hisoboti</p>
                        </div>

                        {/* Screen header */}
                        <div className="no-print px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                                <FiFileText className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 dark:text-white">{reportTitle}</h2>
                                <p className="text-xs text-slate-400">{students.length} ta o'quvchi</p>
                            </div>
                        </div>

                        {/* Scrollable table */}
                        <div className="overflow-x-auto">
                            <table className="print-table w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800">
                                        <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 text-left px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 min-w-[160px]">
                                            O'quvchi
                                        </th>
                                        {days.map(d => (
                                            <th key={d} className="px-1 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 min-w-[28px]">
                                                {d}
                                            </th>
                                        ))}
                                        <th className="px-3 py-3 text-center text-xs font-bold text-green-600 border-b border-slate-200 dark:border-slate-700 min-w-[40px]">+</th>
                                        <th className="px-3 py-3 text-center text-xs font-bold text-rose-500 border-b border-slate-200 dark:border-slate-700 min-w-[40px]">–</th>
                                        <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700 min-w-[44px]">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student, idx) => {
                                        const { present, absent } = getStudentSummary(student.id);
                                        const total = present + absent;
                                        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                                        return (
                                            <tr key={student.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'}>
                                                <td className={`sticky left-0 z-10 px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 text-sm ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}`}>
                                                    {idx + 1}. {student.full_name}
                                                </td>
                                                {days.map(d => {
                                                    const status = getStatus(student.id, d);
                                                    return (
                                                        <td key={d} className={`py-2 border-b border-slate-100 dark:border-slate-800 ${cellClass(status)}`}>
                                                            {cellSymbol(status)}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-2 py-2 text-center text-xs font-bold text-green-600 border-b border-slate-100 dark:border-slate-800">{present}</td>
                                                <td className="px-2 py-2 text-center text-xs font-bold text-rose-500 border-b border-slate-100 dark:border-slate-800">{absent}</td>
                                                <td className={`px-2 py-2 text-center text-xs font-black border-b border-slate-100 dark:border-slate-800 ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                    {pct}%
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Totals row */}
                                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                                        <td className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 px-4 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                            Jami
                                        </td>
                                        {days.map(d => {
                                            const { present, absent } = getDayTotals(d);
                                            const total = present + absent;
                                            return (
                                                <td key={d} className="py-2 text-center border-t border-slate-200 dark:border-slate-700">
                                                    {total > 0 ? (
                                                        <span className="text-[9px] leading-tight block text-green-600 font-bold">{present}</span>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-300">·</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-2 py-3 text-center text-xs font-black text-green-600 border-t border-slate-200 dark:border-slate-700">
                                            {students.reduce((sum, s) => sum + getStudentSummary(s.id).present, 0)}
                                        </td>
                                        <td className="px-2 py-3 text-center text-xs font-black text-rose-500 border-t border-slate-200 dark:border-slate-700">
                                            {students.reduce((sum, s) => sum + getStudentSummary(s.id).absent, 0)}
                                        </td>
                                        <td className="px-2 py-3 border-t border-slate-200 dark:border-slate-700"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Legend */}
                        <div className="no-print px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-4">
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="w-5 h-5 bg-green-100 text-green-700 rounded text-center font-bold leading-5 text-xs">+</span>
                                Keldi
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="w-5 h-5 bg-rose-100 text-rose-600 rounded text-center font-bold leading-5 text-xs">–</span>
                                Kelmadi
                            </span>
                            <span className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="w-5 h-5 bg-slate-100 text-slate-300 rounded text-center font-bold leading-5 text-xs">·</span>
                                Belgilanmagan
                            </span>
                        </div>
                    </div>
                )}

                {!loading && selectedGroup && students.length === 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-12 text-center">
                        <p className="text-slate-400 text-sm">Bu guruhda o'quvchilar yo'q</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default ReportsPage;
