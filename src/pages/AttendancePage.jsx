import React, { useState, useEffect } from 'react';
import { getStudents } from '../services/studentsService';
import { getGroups } from '../services/groupsService';
import { getAttendanceByDate, saveAttendance, getAbsentWithoutSms } from '../services/attendanceService';
import { getTemplates } from '../services/smsSettingsService';
import { supabase } from '../services/supabaseClient';
import { FiSend, FiSearch, FiX, FiMessageSquare, FiLoader, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';

const AttendancePage = () => {
    const [students, setStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    // { [student_id]: { status, sms_sent } }
    const [attendanceMap, setAttendanceMap] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [activeGroupId, setActiveGroupId] = useState('all');
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [sendingSms, setSendingSms] = useState(false);
    const [smsModalOpen, setSmsModalOpen] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [lastSmsTime, setLastSmsTime] = useState(null); // time of last SMS sent today

    const today = new Date().toISOString().split('T')[0];

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        let lastDate = new Date().toISOString().split('T')[0];
        const timer = setInterval(() => {
            const current = new Date();
            const currentDate = current.toISOString().split('T')[0];
            if (currentDate !== lastDate) {
                // Kun o'zgardi — sahifani yangilash
                lastDate = currentDate;
                fetchData();
            }
            setNow(current);
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const weekdays = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const todayLabel = `${dd}.${mm}.${yyyy}-yil, ${weekdays[now.getDay()]}`;
    const currentTime = `${hh}:${min}`;

    useEffect(() => { fetchData(); }, []);

    const fetchLastSmsTime = async () => {
        const { data } = await supabase
            .from('sms_history')
            .select('sent_at')
            .gte('sent_at', today + 'T00:00:00')
            .lte('sent_at', today + 'T23:59:59')
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1);
        setLastSmsTime(data?.[0]?.sent_at ?? null);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [allStudents, allGroups, existingAttendance, tpls] = await Promise.all([
                getStudents(), getGroups(), getAttendanceByDate(today), getTemplates(),
            ]);
            setTemplates(tpls);
            if (tpls.length > 0) setSelectedTemplateId(tpls[0].id);
            setStudents(allStudents);
            setGroups(allGroups);

            const map = {};
            allStudents.forEach(s => {
                const rec = existingAttendance.find(a => a.student_id === s.id);
                map[s.id] = { status: rec?.status ?? 'present', sms_sent: rec?.sms_sent ?? false };
            });
            setAttendanceMap(map);
            await fetchLastSmsTime();
        } catch {
            toast.error("Ma'lumotlarni yuklashda xatolik");
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (studentId) => {
        const prev = attendanceMap[studentId];
        const nextStatus = prev.status === 'present' ? 'absent' : 'present';
        // Optimistic update — sms_sent resets to false if newly set to absent
        setAttendanceMap(m => ({
            ...m,
            [studentId]: { status: nextStatus, sms_sent: nextStatus === 'present' ? false : prev.sms_sent }
        }));
        setSavingId(studentId);
        try {
            await saveAttendance([{ student_id: studentId, date: today, status: nextStatus }]);
        } catch {
            setAttendanceMap(m => ({ ...m, [studentId]: prev }));
            toast.error('Saqlashda xatolik');
        } finally {
            setSavingId(null);
        }
    };

    const openSmsModal = async () => {
        const absents = await getAbsentWithoutSms(today);
        if (absents.length === 0) {
            toast.error("Bugun SMS yuboriladigan kelmaganlar yo'q");
            return;
        }
        setSmsModalOpen(true);
    };

    const handleSendSms = async () => {
        setSendingSms(true);
        try {
            const body = { date: today };
            if (selectedTemplateId) body.template_id = selectedTemplateId;
            const { error } = await supabase.functions.invoke('sms-sender', { body });
            if (error) throw error;
            toast.success('SMS xabarlar muvaffaqiyatli yuborildi!');
            setSmsModalOpen(false);
            fetchData(); // refresh sms_sent flags + last sms time
        } catch {
            toast.error('SMS yuborishda xatolik yuz berdi');
        } finally {
            setSendingSms(false);
        }
    };

    const visibleStudents = (activeGroupId === 'all' ? students : students.filter(s => s.group_id === activeGroupId))
        .filter(s => s.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const presentCount = visibleStudents.filter(s => attendanceMap[s.id]?.status === 'present').length;
    const absentCount  = visibleStudents.filter(s => attendanceMap[s.id]?.status === 'absent').length;
    // Students who are absent but SMS not sent yet
    const smsPending = visibleStudents.filter(s =>
        attendanceMap[s.id]?.status === 'absent' && !attendanceMap[s.id]?.sms_sent
    ).length;

    return (
        <>
        <div className="space-y-5 pb-4">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Davomat</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {todayLabel} · <span className="font-semibold text-primary">{currentTime}</span>
                    </p>
                </div>
                <button
                    onClick={openSmsModal}
                    disabled={sendingSms}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/25 disabled:opacity-50 flex-shrink-0"
                >
                    <FiSend className="w-4 h-4" />
                    SMS Yuborish
                </button>
            </div>

            {/* Notifications */}
            <AnimatePresence mode="popLayout">
                {lastSmsTime && (
                    <motion.div
                        key="sms-sent"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    >
                        <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
                            <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm text-green-800 dark:text-green-300">
                            Bugun soat{' '}
                            <span className="font-bold">
                                {new Date(lastSmsTime).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                            </span>{' '}
                            da SMS yuborildi
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Group Tabs */}
            {groups.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <button
                        onClick={() => setActiveGroupId('all')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeGroupId === 'all'
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        Barchasi ({students.length})
                    </button>
                    {groups.map(g => (
                        <button
                            key={g.id}
                            onClick={() => setActiveGroupId(g.id)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeGroupId === g.id
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            {g.name} ({students.filter(s => s.group_id === g.id).length})
                        </button>
                    ))}
                </div>
            )}

            {/* Search + Stats */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Qidirish..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-primary text-slate-900 dark:text-white transition"
                    />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
                    <span className="text-xs font-bold text-green-700 dark:text-green-400">{presentCount} keldi</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30">
                    <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{absentCount} kelmadi</span>
                </div>
            </div>

            {/* Student List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="py-16 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
                ) : visibleStudents.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm">Talabalar topilmadi</div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <AnimatePresence initial={false}>
                            {visibleStudents.map((student, idx) => {
                                const rec = attendanceMap[student.id] ?? { status: 'present', sms_sent: false };
                                const isPresent = rec.status === 'present';
                                const isSaving = savingId === student.id;
                                const smsSent = rec.sms_sent;

                                return (
                                    <motion.div
                                        key={student.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.025, duration: 0.2 }}
                                        onClick={() => !isSaving && handleToggle(student.id)}
                                        className={`flex items-center justify-between px-5 py-3.5 transition-colors cursor-pointer select-none ${!isPresent ? 'bg-rose-50/40 dark:bg-rose-900/10 hover:bg-rose-50 dark:hover:bg-rose-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {/* Avatar */}
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${isPresent ? 'bg-primary/10 text-primary' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'}`}>
                                                {student.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm truncate">{student.full_name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {student.groups?.name && (
                                                        <span className="text-xs text-slate-400 truncate">{student.groups.name}</span>
                                                    )}
                                                    {/* SMS status badge — only if absent */}
                                                    {!isPresent && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${smsSent ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                                            {smsSent ? 'SMS ✓' : 'SMS yuborilmagan'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Toggle */}
                                        <div className="flex items-center gap-2.5 flex-shrink-0">
                                            <motion.span
                                                key={isPresent ? 'present' : 'absent'}
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`text-xs font-bold w-14 text-right ${isPresent ? 'text-green-600 dark:text-green-400' : 'text-rose-500 dark:text-rose-400'}`}
                                            >
                                                {isPresent ? 'Keldi' : 'Kelmadi'}
                                            </motion.span>
                                            <div
                                                className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-300 ${isPresent ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <motion.div
                                                    animate={{ x: isPresent ? 24 : 2 }}
                                                    transition={{ type: 'spring', stiffness: 600, damping: 35 }}
                                                    className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-md flex items-center justify-center"
                                                >
                                                    {isSaving && (
                                                        <div className="w-2.5 h-2.5 border-[1.5px] border-slate-200 border-t-primary rounded-full animate-spin" />
                                                    )}
                                                </motion.div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>

        {/* SMS Modal */}
        <AnimatePresence>
            {smsModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setSmsModalOpen(false)}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800"
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">SMS Yuborish</h3>
                                <p className="text-xs text-slate-400 mt-0.5">{smsPending} ta o'quvchiga yuboriladi</p>
                            </div>
                            <button onClick={() => setSmsModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                                <FiX className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            {templates.length === 0 ? (
                                <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
                                    Shablon topilmadi. SMS Sozlamalari sahifasidan shablon qo'shing.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {templates.map(tpl => (
                                        <label
                                            key={tpl.id}
                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedTemplateId === tpl.id
                                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <input type="radio" name="template" value={tpl.id} checked={selectedTemplateId === tpl.id} onChange={() => setSelectedTemplateId(tpl.id)} className="mt-0.5 accent-primary" />
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white text-sm">{tpl.name}</p>
                                                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tpl.body}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                            <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={handleSendSms}
                                disabled={sendingSms || templates.length === 0}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl transition shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {sendingSms ? <FiLoader className="animate-spin w-4 h-4" /> : <FiMessageSquare className="w-4 h-4" />}
                                {sendingSms ? 'Yuborilmoqda...' : 'Yuborish'}
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
        </>
    );
};

export default AttendancePage;
