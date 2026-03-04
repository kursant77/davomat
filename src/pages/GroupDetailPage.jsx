import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { updateGroup } from '../services/groupsService';
import {
    FiArrowLeft, FiUsers, FiGrid, FiEdit2, FiCheck, FiX,
    FiCalendar, FiPhone, FiCheckCircle, FiXCircle, FiLoader, FiFileText
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const GroupDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [group, setGroup] = useState(null);
    const [students, setStudents] = useState([]);
    const [todayAttendance, setTodayAttendance] = useState({});
    const [statsMap, setStatsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => { fetchAll(); }, [id]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Group info
            const { data: grp, error: gErr } = await supabase
                .from('groups')
                .select('*')
                .eq('id', id)
                .single();
            if (gErr) throw gErr;
            setGroup(grp);
            setEditData({ name: grp.name, description: grp.description || '' });

            // Students in this group
            const { data: studs, error: sErr } = await supabase
                .from('students')
                .select('*')
                .eq('group_id', id)
                .order('full_name');
            if (sErr) throw sErr;
            setStudents(studs);

            if (studs.length === 0) return;

            const studentIds = studs.map(s => s.id);

            // Today's attendance
            const { data: todayAtt } = await supabase
                .from('attendance')
                .select('student_id, status')
                .in('student_id', studentIds)
                .eq('date', today);

            const todayMap = {};
            (todayAtt || []).forEach(a => { todayMap[a.student_id] = a.status; });
            setTodayAttendance(todayMap);

            // All-time attendance stats per student
            const { data: allAtt } = await supabase
                .from('attendance')
                .select('student_id, status')
                .in('student_id', studentIds);

            const stats = {};
            studentIds.forEach(sid => { stats[sid] = { present: 0, absent: 0 }; });
            (allAtt || []).forEach(a => {
                if (stats[a.student_id]) stats[a.student_id][a.status]++;
            });
            setStatsMap(stats);
        } catch {
            toast.error("Ma'lumotlarni yuklashda xatolik");
            navigate('/groups');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editData.name.trim()) return;
        setSaving(true);
        try {
            await updateGroup(id, editData);
            setGroup(g => ({ ...g, ...editData }));
            setEditMode(false);
            toast.success('Guruh yangilandi');
        } catch {
            toast.error('Xatolik yuz berdi');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <FiLoader className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const presentToday = Object.values(todayAttendance).filter(s => s === 'present').length;
    const absentToday = Object.values(todayAttendance).filter(s => s === 'absent').length;
    const totalPresent = Object.values(statsMap).reduce((s, v) => s + v.present, 0);
    const totalAbsent = Object.values(statsMap).reduce((s, v) => s + v.absent, 0);
    const totalSessions = totalPresent + totalAbsent;
    const overallPct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

    return (
        <div className="space-y-6 pb-12">

            {/* Back */}
            <button
                onClick={() => navigate('/groups')}
                className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-semibold group text-sm"
            >
                <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                Guruhlarga qaytish
            </button>

            {/* Group Header Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <FiGrid className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                            <AnimatePresence mode="wait">
                                {editMode ? (
                                    <motion.div
                                        key="edit"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                        className="space-y-2"
                                    >
                                        <input
                                            autoFocus
                                            value={editData.name}
                                            onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                                            className="text-xl font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-primary w-full"
                                        />
                                        <input
                                            value={editData.description}
                                            onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                                            placeholder="Tavsif (ixtiyoriy)"
                                            className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary w-full"
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="view"
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    >
                                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{group.name}</h1>
                                        {group.description && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{group.description}</p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Edit / Save buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {!editMode && (
                            <button
                                onClick={() => navigate(`/reports?group=${id}`)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:border-primary hover:text-primary transition"
                            >
                                <FiFileText className="w-3.5 h-3.5" />
                                Hisobot
                            </button>
                        )}
                        {editMode ? (
                            <>
                                <button
                                    onClick={() => { setEditMode(false); setEditData({ name: group.name, description: group.description || '' }); }}
                                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    <FiX className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
                                >
                                    {saving ? <FiLoader className="w-3.5 h-3.5 animate-spin" /> : <FiCheck className="w-3.5 h-3.5" />}
                                    Saqlash
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setEditMode(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-medium hover:border-primary hover:text-primary transition"
                            >
                                <FiEdit2 className="w-3.5 h-3.5" />
                                Tahrirlash
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{students.length}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">O'quvchilar</p>
                    </div>
                    <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-primary">{overallPct}%</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Umumiy davomat</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-green-600 dark:text-green-400">{presentToday}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Bugun keldi</p>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-4 text-center">
                        <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{absentToday}</p>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Bugun kelmadi</p>
                    </div>
                </div>
            </div>

            {/* Students List */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FiUsers className="text-primary" />
                        O'quvchilar ro'yxati
                    </h2>
                    <span className="text-sm text-slate-400">{students.length} nafar</span>
                </div>

                {students.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <FiUsers className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">Bu guruhda hali o'quvchi yo'q</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {students.map((student, idx) => {
                                const st = statsMap[student.id] ?? { present: 0, absent: 0 };
                                const total = st.present + st.absent;
                                const pct = total > 0 ? Math.round((st.present / total) * 100) : 0;
                                const todayStatus = todayAttendance[student.id];

                                return (
                                    <motion.div
                                        key={student.id}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04 }}
                                        onClick={() => navigate(`/students/${student.id}`)}
                                        className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            {/* Avatar */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${pct >= 80 ? 'bg-primary/10 text-primary' : pct >= 50 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'}`}>
                                                {student.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-primary transition-colors truncate">
                                                    {student.full_name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <FiPhone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <span className="text-xs text-slate-400">{student.parent_phone}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            {/* Attendance bar */}
                                            <div className="hidden sm:block text-right">
                                                <div className="flex items-center gap-1.5 justify-end mb-1">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{pct}%</span>
                                                    <span className="text-[10px] text-slate-400">{st.present}/{total}</span>
                                                </div>
                                                <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-primary' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Today badge */}
                                            {todayStatus ? (
                                                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${todayStatus === 'present' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'}`}>
                                                    {todayStatus === 'present' ? <FiCheckCircle className="w-3 h-3" /> : <FiXCircle className="w-3 h-3" />}
                                                    {todayStatus === 'present' ? 'Keldi' : 'Kelmadi'}
                                                </div>
                                            ) : (
                                                <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                    Belgilanmagan
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupDetailPage;
