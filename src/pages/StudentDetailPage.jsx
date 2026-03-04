import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { FiArrowLeft, FiUser, FiPhone, FiCheckCircle, FiXCircle, FiSend, FiClock, FiGrid, FiX, FiMessageSquare, FiAlertCircle, FiPrinter } from 'react-icons/fi';
import { getSmsHistory } from '../services/smsSettingsService';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const StudentDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [student, setStudent] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sendingSms, setSendingSms] = useState(false);
    const [smsModal, setSmsModal] = useState(false);
    const [smsText, setSmsText] = useState('');
    const [smsHistory, setSmsHistory] = useState([]);
    const [exportModal, setExportModal] = useState(false);

    useEffect(() => {
        fetchStudentData();
    }, [id]);

    const fetchStudentData = async () => {
        setLoading(true);
        try {
            const { data: studentData, error: sError } = await supabase
                .from('students')
                .select('*, groups(id, name)')
                .eq('id', id)
                .single();

            if (sError) throw sError;
            setStudent(studentData);

            const { data: attData, error: aError } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', id)
                .order('date', { ascending: false });

            if (aError) throw aError;
            setAttendance(attData);

            const history = await getSmsHistory(id);
            setSmsHistory(history);
        } catch (error) {
            toast.error(`Ma'lumotlarni yuklashda xatolik`);
            navigate('/students');
        } finally {
            setLoading(false);
        }
    };

    const handleSingleSms = async (attendanceId) => {
        setSendingSms(true);
        try {
            toast.loading('SMS yuborilmoqda...', { id: 'singleSms' });
            const { error } = await supabase.functions.invoke('sms-sender', {
                body: { specific_id: attendanceId }
            });
            if (error) throw error;
            toast.success('SMS muvaffaqiyatli yuborildi', { id: 'singleSms' });
            fetchStudentData();
        } catch (error) {
            toast.error('SMS yuborishda xatolik yuz berdi', { id: 'singleSms' });
        } finally {
            setSendingSms(false);
        }
    };

    const handleCustomSms = async (e) => {
        e.preventDefault();
        if (!smsText.trim()) return;
        setSendingSms(true);
        try {
            toast.loading('SMS yuborilmoqda...', { id: 'customSms' });
            const { error } = await supabase.functions.invoke('sms-sender', {
                body: { phone: student.parent_phone, message: smsText }
            });
            if (error) throw error;
            toast.success('SMS muvaffaqiyatli yuborildi!', { id: 'customSms' });
            setSmsModal(false);
            setSmsText('');
        } catch (error) {
            toast.error('SMS yuborishda xatolik yuz berdi', { id: 'customSms' });
        } finally {
            setSendingSms(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const presentCount = attendance.filter(a => a.status === 'present').length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;
    const attendancePercentage = attendance.length > 0
        ? Math.round((presentCount / attendance.length) * 100)
        : 0;

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    };

    const safeName = (student?.full_name ?? 'hisobot').replace(/\s+/g, '_');

    const generatePDF = () => {
        setExportModal(false);
        try {
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const m = 14;

            // Header strip
            doc.setFillColor(37, 99, 235);
            doc.rect(0, 0, pageW, 38, 'F');

            // Thin accent bar
            doc.setFillColor(96, 165, 250);
            doc.rect(0, 38, pageW, 2, 'F');

            // App label
            doc.setTextColor(147, 197, 253);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text('DAVOMAT TIZIMI  /  O\'QUVCHI HISOBOTI', m, 10);

            // Student name — only ASCII-safe chars
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            const displayName = student?.full_name ?? '';
            doc.text(displayName, m, 25);

            // Sub info
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(186, 213, 255);
            const parts = [];
            if (student?.groups?.name) parts.push(`Guruh: ${student.groups.name}`);
            if (student?.parent_phone) parts.push(`Tel: ${student.parent_phone}`);
            doc.text(parts.join('    |    '), m, 33);

            // Stats boxes
            const sY = 48;
            const boxes = [
                { label: 'Jami darslar', val: attendance.length, bg: [239, 246, 255], fg: [37, 99, 235] },
                { label: 'Kelgan', val: presentCount, bg: [240, 253, 244], fg: [22, 163, 74] },
                { label: 'Kelmagan', val: absentCount, bg: [255, 241, 242], fg: [220, 38, 38] },
                {
                    label: 'Davomat %',
                    val: `${attendancePercentage}%`,
                    bg: attendancePercentage >= 80 ? [240, 253, 244] : attendancePercentage >= 50 ? [255, 251, 235] : [255, 241, 242],
                    fg: attendancePercentage >= 80 ? [22, 163, 74] : attendancePercentage >= 50 ? [180, 83, 9] : [220, 38, 38],
                },
            ];
            const bW = (pageW - m * 2 - 9) / 4;
            boxes.forEach((b, i) => {
                const x = m + i * (bW + 3);
                doc.setFillColor(...b.bg);
                doc.roundedRect(x, sY, bW, 20, 2, 2, 'F');
                doc.setTextColor(...b.fg);
                doc.setFontSize(15);
                doc.setFont('helvetica', 'bold');
                doc.text(String(b.val), x + bW / 2, sY + 11, { align: 'center' });
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(b.label, x + bW / 2, sY + 17, { align: 'center' });
            });

            // Section header
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Barcha yo\'qlamalar', m, sY + 30);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.25);
            doc.line(m, sY + 32, pageW - m, sY + 32);

            // Table
            autoTable(doc, {
                startY: sY + 35,
                head: [['No', 'Sana', 'Holat', 'SMS holati']],
                body: attendance.map((rec, idx) => [
                    idx + 1,
                    formatDate(rec.date),
                    rec.status === 'present' ? 'Keldi' : 'Kelmadi',
                    rec.status === 'absent'
                        ? (rec.sms_sent ? 'SMS yuborildi' : 'SMS yuborilmadi')
                        : '-',
                ]),
                margin: { left: m, right: m },
                styles: {
                    font: 'helvetica',
                    fontSize: 9,
                    cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
                    lineColor: [226, 232, 240],
                    lineWidth: 0.15,
                    textColor: [30, 41, 59],
                },
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8.5,
                    cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
                },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 11, halign: 'center', textColor: [148, 163, 184] },
                    1: { cellWidth: 32, fontStyle: 'bold' },
                    2: { cellWidth: 28 },
                    3: { cellWidth: 40 },
                },
                didParseCell(data) {
                    if (data.section !== 'body') return;
                    if (data.column.index === 2) {
                        data.cell.styles.textColor =
                            data.cell.raw === 'Keldi' ? [21, 128, 61] : [185, 28, 28];
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (data.column.index === 3) {
                        if (data.cell.raw === 'SMS yuborildi')
                            data.cell.styles.textColor = [37, 99, 235];
                        else if (data.cell.raw === 'SMS yuborilmadi')
                            data.cell.styles.textColor = [156, 163, 175];
                    }
                },
                didDrawPage(data) {
                    // Footer on each page
                    doc.setDrawColor(226, 232, 240);
                    doc.setLineWidth(0.25);
                    doc.line(m, pageH - 10, pageW - m, pageH - 10);
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(148, 163, 184);
                    const today = new Date().toLocaleDateString('ru-RU');
                    doc.text(`Sana: ${today}    Davomat tizimi`, m, pageH - 5.5);
                    doc.text(
                        `${data.pageNumber} / ${doc.internal.getNumberOfPages()}`,
                        pageW - m, pageH - 5.5, { align: 'right' }
                    );
                },
            });

            doc.save(`${safeName}_davomat.pdf`);
            toast.success('PDF yuklab olindi!');
        } catch (e) {
            toast.error('PDF yaratishda xatolik');
            console.error(e);
        }
    };

    const generateExcel = async () => {
        setExportModal(false);
        try {
            const wb = new ExcelJS.Workbook();
            wb.creator = 'Davomat Tizimi';
            wb.created = new Date();

            const ws = wb.addWorksheet("Davomat", {
                pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true },
            });

            // ── Column widths ──
            ws.columns = [
                { key: 'no',     width: 6  },
                { key: 'date',   width: 18 },
                { key: 'status', width: 16 },
                { key: 'sms',    width: 22 },
            ];

            // ── Helper styles ──
            const headerFill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            const headerFont   = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            const titleFont    = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
            const subFont      = { name: 'Calibri', color: { argb: 'FFBAD5FF' }, size: 10 };
            const labelFont    = { name: 'Calibri', bold: true, color: { argb: 'FF64748B' }, size: 9 };
            const thinBorder   = { style: 'thin', color: { argb: 'FFE2E8F0' } };
            const cellBorder   = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            const center       = { horizontal: 'center', vertical: 'middle' };
            const left         = { horizontal: 'left',   vertical: 'middle' };

            // ── Row 1: App title banner ──
            ws.mergeCells('A1:D1');
            const titleCell = ws.getCell('A1');
            titleCell.value = 'DAVOMAT TIZIMI  —  O\'QUVCHI HISOBOTI';
            titleCell.fill  = headerFill;
            titleCell.font  = { name: 'Calibri', bold: true, color: { argb: 'FFBAD5FF' }, size: 9, italic: true };
            titleCell.alignment = center;
            ws.getRow(1).height = 22;

            // ── Row 2: Student name ──
            ws.mergeCells('A2:D2');
            const nameCell = ws.getCell('A2');
            nameCell.value = student?.full_name ?? '';
            nameCell.fill  = headerFill;
            nameCell.font  = titleFont;
            nameCell.alignment = { ...center, indent: 1 };
            ws.getRow(2).height = 36;

            // ── Row 3: Group + Phone ──
            ws.mergeCells('A3:D3');
            const infoCell = ws.getCell('A3');
            infoCell.value = [
                student?.groups?.name ? `Guruh: ${student.groups.name}` : null,
                student?.parent_phone ? `Tel: ${student.parent_phone}` : null,
            ].filter(Boolean).join('    |    ');
            infoCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
            infoCell.font  = subFont;
            infoCell.alignment = { ...center };
            ws.getRow(3).height = 22;

            // ── Row 4: Spacer ──
            ws.getRow(4).height = 8;

            // ── Row 5: Stats labels ──
            const statLabels = ['Jami darslar', 'Kelgan', 'Kelmagan', 'Davomat %'];
            const statValues = [attendance.length, presentCount, absentCount, `${attendancePercentage}%`];
            const statLabelColors = ['FFDBEAFE', 'FFBBF7D0', 'FFFECDD3', attendancePercentage >= 80 ? 'FFBBF7D0' : attendancePercentage >= 50 ? 'FFFEF08A' : 'FFFECDD3'];
            const statValueColors = ['FF1D4ED8', 'FF15803D', 'FFB91C1C', attendancePercentage >= 80 ? 'FF15803D' : attendancePercentage >= 50 ? 'FFB45309' : 'FFB91C1C'];

            const labelRow = ws.getRow(5);
            const valueRow = ws.getRow(6);
            labelRow.height = 18;
            valueRow.height = 28;

            ['A', 'B', 'C', 'D'].forEach((col, i) => {
                const lCell = ws.getCell(`${col}5`);
                lCell.value = statLabels[i];
                lCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: statLabelColors[i] } };
                lCell.font  = labelFont;
                lCell.alignment = center;
                lCell.border = cellBorder;

                const vCell = ws.getCell(`${col}6`);
                vCell.value = statValues[i];
                vCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: statLabelColors[i] } };
                vCell.font  = { name: 'Calibri', bold: true, size: 16, color: { argb: statValueColors[i] } };
                vCell.alignment = center;
                vCell.border = cellBorder;
            });

            // ── Row 7: Spacer ──
            ws.getRow(7).height = 10;

            // ── Row 8: Table header ──
            const tableHeaders = ['№', 'Sana', 'Holat', 'SMS holati'];
            const hRow = ws.getRow(8);
            hRow.height = 22;
            tableHeaders.forEach((h, i) => {
                const col = ['A','B','C','D'][i];
                const cell = ws.getCell(`${col}8`);
                cell.value = h;
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
                cell.font  = { ...headerFont, size: 10 };
                cell.alignment = i === 0 ? center : left;
                cell.border = cellBorder;
            });

            // ── Data rows ──
            attendance.forEach((rec, idx) => {
                const rowNum = 9 + idx;
                const isPresent = rec.status === 'present';
                const rowBg = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';
                const row = ws.getRow(rowNum);
                row.height = 18;

                const values = [
                    idx + 1,
                    formatDate(rec.date),
                    isPresent ? 'Keldi' : 'Kelmadi',
                    rec.status === 'absent' ? (rec.sms_sent ? 'SMS yuborildi' : 'SMS yuborilmadi') : '—',
                ];
                const cols = ['A','B','C','D'];

                cols.forEach((col, ci) => {
                    const cell = ws.getCell(`${col}${rowNum}`);
                    cell.value = values[ci];
                    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
                    cell.alignment = ci === 0 ? center : left;
                    cell.border = cellBorder;

                    if (ci === 0) {
                        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
                    } else if (ci === 1) {
                        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
                    } else if (ci === 2) {
                        cell.font = {
                            name: 'Calibri', size: 10, bold: true,
                            color: { argb: isPresent ? 'FF15803D' : 'FFB91C1C' },
                        };
                        cell.fill = {
                            type: 'pattern', pattern: 'solid',
                            fgColor: { argb: isPresent ? 'FFF0FDF4' : 'FFFFF1F2' },
                        };
                    } else if (ci === 3) {
                        const isSent = rec.sms_sent && rec.status === 'absent';
                        cell.font = {
                            name: 'Calibri', size: 9,
                            color: { argb: isSent ? 'FF2563EB' : 'FF94A3B8' },
                        };
                    }
                });
            });

            // ── Footer row ──
            const footerRow = 9 + attendance.length + 1;
            ws.mergeCells(`A${footerRow}:D${footerRow}`);
            const footerCell = ws.getCell(`A${footerRow}`);
            footerCell.value = `Chop etilgan: ${new Date().toLocaleDateString('ru-RU')}   |   Davomat tizimi`;
            footerCell.font  = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF94A3B8' } };
            footerCell.alignment = { horizontal: 'right' };
            ws.getRow(footerRow).height = 16;

            // ── Generate & save ──
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            saveAs(blob, `${safeName}_davomat.xlsx`);
            toast.success('Excel yuklab olindi!');
        } catch (e) {
            toast.error('Excel yaratishda xatolik');
            console.error(e);
        }
    };

    return (
        <div className="space-y-6 sm:space-y-8 pb-12">
            {/* Back Button */}
            <button
                onClick={() => navigate('/students')}
                className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-semibold group"
            >
                <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                Orqaga qaytish
            </button>

            {/* Profile Header */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 md:p-12 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-center sm:text-left">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner overflow-hidden border-2 border-slate-100 dark:border-slate-800 flex-shrink-0">
                        {student.avatar_url ? (
                            <img src={student.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <FiUser className="w-12 h-12 sm:w-16 sm:h-16" />
                        )}
                    </div>
                    <div className="flex-1 space-y-3">
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">{student.full_name}</h1>
                        <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">
                                <FiGrid className="text-primary flex-shrink-0" />
                                <b className="text-slate-900 dark:text-white uppercase">{student.groups?.name || 'Guruhsiz'}</b>
                            </span>
                            <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">
                                <FiPhone className="text-primary flex-shrink-0" />
                                {student.parent_phone}
                            </span>
                        </div>
                        <button
                            onClick={() => setSmsModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition-all shadow-lg shadow-primary/25 active:scale-95"
                        >
                            <FiMessageSquare className="w-4 h-4" />
                            SMS Yuborish
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-3 sm:gap-6 flex-shrink-0">
                        <div className="text-center bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl min-w-[80px] sm:min-w-[100px] border border-slate-100 dark:border-slate-700">
                            <p className="text-xl sm:text-2xl font-black text-primary">{attendance.length}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Darslar</p>
                        </div>
                        <div className="text-center bg-green-50 dark:bg-green-900/20 p-4 rounded-3xl min-w-[80px] sm:min-w-[100px] border border-green-100 dark:border-green-900/30">
                            <p className="text-xl sm:text-2xl font-black text-green-600 dark:text-green-400">{attendancePercentage}%</p>
                            <p className="text-xs font-bold text-green-500/70 uppercase tracking-tighter">Davomat</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Contact info */}
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 h-fit space-y-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ma'lumotlar</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 group">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors flex-shrink-0">
                                <FiPhone />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Ota-ona telefoni</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{student.parent_phone}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 group">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors flex-shrink-0">
                                <FiGrid />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Guruh</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{student.groups?.name || 'Guruhsiz'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 group">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors flex-shrink-0">
                                <FiClock />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Ro'yxatdan o'tgan</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-200">{new Date(student.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-900/30 text-center">
                            <p className="text-2xl font-black text-green-600 dark:text-green-400">{presentCount}</p>
                            <p className="text-xs font-bold text-green-500/70 uppercase tracking-tighter">Kelgan</p>
                        </div>
                        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-center">
                            <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{absentCount}</p>
                            <p className="text-xs font-bold text-rose-500/70 uppercase tracking-tighter">Kelmagan</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setSmsModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl font-bold hover:bg-primary-dark transition-all shadow-lg shadow-primary/25"
                    >
                        <FiSend className="w-4 h-4" />
                        Xabar Yuborish
                    </button>
                </div>

                {/* Attendance History */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Davomat Tarixi</h3>
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setExportModal(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-sm font-semibold transition-all"
                            >
                                <FiPrinter className="w-3.5 h-3.5" />
                                Yuklab olish
                            </button>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 text-xs font-bold">
                                {presentCount} Kelgan
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 text-xs font-bold">
                                {absentCount} Kelmagan
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {attendance.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 italic">Hali davomat ma'lumotlari yo'q</div>
                            ) : (
                                attendance.slice(0, 10).map((record) => (
                                    <div key={record.id} className="p-4 sm:p-6 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${record.status === 'present' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'}`}>
                                                {record.status === 'present' ? <FiCheckCircle /> : <FiXCircle />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base">{new Date(record.date).toLocaleDateString()}</p>
                                                <p className={`text-xs font-semibold ${record.status === 'present' ? 'text-green-500' : 'text-rose-500'}`}>
                                                    {record.status === 'present' ? 'Darsda qatnashdi' : 'Darsda qatnashmadi'}
                                                </p>
                                            </div>
                                        </div>

                                        {record.status === 'absent' && (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${record.sms_sent ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    <FiSend className="w-3 h-3" />
                                                    <span className="hidden sm:inline">{record.sms_sent ? 'SMS Yuborilgan' : 'SMS Yuborilmagan'}</span>
                                                </div>
                                                {!record.sms_sent && (
                                                    <button
                                                        onClick={() => handleSingleSms(record.id)}
                                                        disabled={sendingSms}
                                                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                                                        title="SMS yuborish"
                                                    >
                                                        <FiSend className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    {attendance.length > 10 && (
                        <p className="text-center text-slate-400 text-sm font-medium italic">Faqat oxirgi 10 ta yozuv ko'rsatilmoqda</p>
                    )}
                </div>

                {/* SMS History */}
                <div className="space-y-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">SMS Tarixi</h3>
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        {smsHistory.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 italic">Hali SMS yuborilmagan</div>
                        ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                {smsHistory.map(record => (
                                    <div key={record.id} className="p-4 sm:p-5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${record.status === 'sent' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'}`}>
                                            {record.status === 'sent' ? <FiCheckCircle className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{record.message}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                                <span className="text-xs text-slate-400">{new Date(record.sent_at).toLocaleString()}</span>
                                                <span className={`text-xs font-bold ${record.status === 'sent' ? 'text-blue-500' : 'text-rose-500'}`}>
                                                    {record.status === 'sent' ? 'Yuborildi' : 'Xatolik'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Export Format Modal */}
            <AnimatePresence>
                {exportModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setExportModal(false)}
                            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Yuklab olish formati</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">{student?.full_name} — davomat hisoboti</p>
                                </div>
                                <button onClick={() => setExportModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <FiX className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                            <div className="p-5 grid grid-cols-2 gap-3">
                                <button
                                    onClick={generatePDF}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 hover:border-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all group"
                                >
                                    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6 text-rose-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">PDF</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Chop etishga tayyor</p>
                                    </div>
                                </button>
                                <button
                                    onClick={generateExcel}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 hover:border-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-all group"
                                >
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM9 17l-3-3h2v-4h2v4h2l-3 3z"/>
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold text-green-700 dark:text-green-400 text-sm">Excel</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Tahrirlash mumkin</p>
                                    </div>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom SMS Modal */}
            <AnimatePresence>
                {smsModal && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSmsModal(false)}
                            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800"
                        >
                            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">SMS Yuborish</h3>
                                    <p className="text-sm text-slate-500 mt-0.5">{student.full_name} · {student.parent_phone}</p>
                                </div>
                                <button onClick={() => setSmsModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <FiX className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                            <form onSubmit={handleCustomSms} className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Xabar matni</label>
                                    <textarea
                                        autoFocus
                                        rows={4}
                                        required
                                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:outline-none transition-all text-slate-900 dark:text-white resize-none"
                                        placeholder="Xabar matnini kiriting..."
                                        value={smsText}
                                        onChange={(e) => setSmsText(e.target.value)}
                                    />
                                    <p className="text-xs text-slate-400 text-right">{smsText.length} belgi</p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={sendingSms || !smsText.trim()}
                                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-primary/30 disabled:opacity-50"
                                >
                                    <FiSend className="w-4 h-4" />
                                    {sendingSms ? 'Yuborilmoqda...' : 'SMS Yuborish'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StudentDetailPage;
