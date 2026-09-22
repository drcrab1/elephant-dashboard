import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ui-components.js
const Icons = {
    Home: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    Menu: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="3" x2="21" y1="12" y2="12" /><line x1="3" x2="21" y1="6" y2="6" /><line x1="3" x2="21" y1="18" y2="18" /></svg>,
    X: (props) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" /></svg>,
    Logo: () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18v-4H3v4" /><path d="M18 18v-4h3v4" /><path d="M12 11v7" /><path d="M9 11v7" /><path d="M21 8a4 4 0 0 0-4-4H7a5 5 0 0 0-5 5v5h3v-2a2 2 0 0 1 4 0v2h6a3 3 0 0 0 3-3V8z" /><path d="M8 8h1" /></svg>,
    Dashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>,
    Contract: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>,
    Schedule: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>,
    Safety: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>,
    Phone: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    Truck: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3" /><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2" /><path d="M14 17h1" /><circle cx="7.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>,
    Clipboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>,
    Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>,
    Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></svg>,
    Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>,
    ChevronLeft: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>,
    ChevronRight: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>,
    Settings: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 1 1-2-2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    Google: () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px"><path fill="#fbc02d" d="M43.6 20.1H42V20H24v8h11.3C34.7 32.8 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3.1l6.1-6.1C34.4 5.5 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c11 0 20-8.5 20-19.1 0-2-.2-3.9-.4-5.8z" /><path fill="#e53935" d="M6.3 14.7l6.6 4.8C14.7 15.6 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3.1l6.1-6.1C34.4 5.5 29.5 3 24 3 16.3 3 9.7 7.5 6.3 14.7z" /><path fill="#4caf50" d="M24 45c5.3 0 10.1-2 13.9-5.4l-7-5.5c-2 1.3-4.4 2.1-6.9 2.1-5.6 0-10.4-3.5-12.2-8.5l-6.7 4.9C8.3 40.2 15.5 45 24 45z" /><path fill="#1565c0" d="M43.6 20.1H42V20H24v8h11.3c-.9 3-2.6 5.5-4.8 7.2l7 5.5C41.6 37.1 44 31.4 44 24c0-1.4-.2-2.7-.4-4z" /></svg>,
    Camera: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>,
    CheckCircle: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    Phone: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    PhoneCall: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    Edit2: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>,
    Trash2: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>,
    Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" x2="16.65" y1="21" y2="16.65" /></svg>,
    AlertTriangle: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>,
    Building: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" /></svg>,
    Users: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    FileText: () => <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    Map: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="21"></line></svg>,
    Bell: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>,
    Table: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /></svg>
};

// --- Draggable Layer Node ---
const DraggableNode = ({ id, initialX, initialY, onUpdate, children }) => {
    const nodeRef = useRef(null);
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: initialX, y: initialY });

    const handleMouseDown = useCallback((e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        e.stopPropagation();
        isDragging.current = true;
        startPos.current = { x: e.clientX, y: e.clientY };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }, []);

    const handleTouchStart = (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        e.stopPropagation();
        isDragging.current = true;
        startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }

    const moveLogics = (clientX, clientY) => {
        if (!isDragging.current) return;
        const dx = clientX - startPos.current.x;
        const dy = clientY - startPos.current.y;
        currentPos.current = { x: currentPos.current.x + dx, y: currentPos.current.y + dy };
        startPos.current = { x: clientX, y: clientY };
        if (nodeRef.current) nodeRef.current.style.transform = `translate(${currentPos.current.x}px, ${currentPos.current.y}px)`;
    };

    const handleMouseMove = (e) => { moveLogics(e.clientX, e.clientY); };
    const handleTouchMove = (e) => { e.preventDefault(); moveLogics(e.touches[0].clientX, e.touches[0].clientY); };

    const endLogics = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        onUpdate(id, currentPos.current.x, currentPos.current.y);
    }

    const handleMouseUp = endLogics;
    const handleTouchEnd = endLogics;

    return (
        <div ref={nodeRef} onMouseDown={handleMouseDown} onTouchStart={handleTouchStart} style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${initialX}px, ${initialY}px)`, cursor: 'move', zIndex: 10 }}>
            {children}
        </div>
    );
};

// --- HTML5 Canvas Signature Pad (Standalone modal mode) ---
const SignaturePadModal = ({ onSave, onClose }) => {
    const canvasRef = useRef(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    }, []);

    const getCoords = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return e.touches ? { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top } : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const start = (e) => { e.preventDefault(); isDrawing.current = true; const { x, y } = getCoords(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e) => { if (!isDrawing.current) return; e.preventDefault(); const { x, y } = getCoords(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(x, y); ctx.stroke(); };
    const stop = () => isDrawing.current = false;
    const handleSave = () => onSave(canvasRef.current.toDataURL('image/png'));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-[500px]">
                <h3 className="font-bold mb-4">서명 그리기</h3>
                <canvas ref={canvasRef} width={450} height={200} className="border border-gray-300 w-full bg-gray-50 mb-4 touch-none" onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseOut={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop} />
                <div className="flex gap-2">
                    <button onClick={handleSave} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold">확인</button>
                    <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">취소</button>
                </div>
            </div>
        </div>
    )
};

// --- PDF Template Component (Hidden) ---
const CONTRACT_ARTICLES = [
    { title: "제1조(목적)", content: "이 계약은 “위탁자”가 “수탁자”에게 위탁하는 택배 운송 업무에 관하여 “위탁자”와 “수탁자”간의 권리와 의무를 정하는 것을 목적으로 한다." },
    { title: "제2조(기본원칙)", content: "① “위탁자”와 “수탁자”는 이 계약에 따라 택배 운송 업무를 수행함에 있어 상호 대등한 입장에서 신의성실의 원칙에 따라 자신의 권리를 행사하며 의무를 이행한다. ② “위탁자”와 “수탁자”는 이 계약의 이행과 관련하여 「생활물류서비스산업발전법」, 「독점규제 및 공정거래에 관한 법률」등 관련 법령의 규정을 준수한다." },
    { title: "제3조(용어의 정의)", content: "① “택배”라 함은 고객의 요청에 따라 운송을 위탁받은 화물을 집화, 분류, 배송 등의 과정을 거쳐 수화인의 주택, 사무실 또는 기타의 장소에서 인도하는 것을 말한다. ② “집화”라 함은 고객으로부터 수령한 화물을 “위탁자”가 지정한 장소까지 운송하여 하차, 적재하는 작업을 말한다. ③ “분류”라 함은 서브터미널 등 택배화물의 분류시설‧장소에서 다수의 화물을 택배기사 1인당 담당구역별로 구분하는 작업을 말한다. ④ “배송”이라 함은 분류된 화물을 택배 운송차량에 상차하여 차량운행을 통해 운송장에 기재된 장소에서 고객에게 인도하는 것을 말한다. ⑤ 택배의 집화, 배송에 수반되는 전산입력 및 택배운임 수취, 고객응대, 스캔 등 부수적인 업무는 집화, 배송업무로 본다." },
    { title: "제4조(계약의 주요내용)", content: "① “위탁자”와 “수탁자” 간 계약의 주요내용은 다음과 같다.\n\n● 계약기간: {startDate}부터 {endDate}까지 ({contractMonths}개월)\n● 담당구역: {route}\n● 수수료:\n○ 집화수수료: 1건당 {pickupFee}원 또는 택배사업자 – 영업점 간 수수료 기준 금액의 {pickupPct}%\n○ 배송수수료: 1건당 {deliveryFee}원 또는 택배사업자 – 영업점 간 수수료 기준 금액의 {deliveryPct}%\n● 지급일: 매월 {paymentDay}일\n● 기타 차량내역: 자동차 등록번호 {carNumber}\n● 종사자격: 종사자격증 번호 {licenseNumber}\n\n② “수탁자”는 집화, 배송 외에 분류작업을 수행 / 미수행 한다. ③ 전항에 따라 분류작업을 수행하는 경우 분류수수료는 시간당 {sortingFee}원으로 한다. 단, 분류된 화물을 택배차량에 상차하는 시간({sortingExclHours}시간)은 분류수수료 지급시 포함하지 않는다. ④ 제3항의 분류수수료는 시간당 최저임금에 상당하는 금액으로 하며, 이 경우 수수료는 「택배기사 과로방지 대책 사회적 합의기구 합의문(2차, ’21. 6. 22)」에 따른 분류인력 투입비용 이상으로 한다." },
    { title: "제5조(수수료의 지급)", content: "① “수탁자”는 택배업무 수행 내역을 매월 {maDate}일을 기준으로 마감하고, 익월 {reqDate}일까지 “위탁자”에게 수수료를 청구하여야 한다. 다만, 청구일이 휴무일인 경우에는 휴무일 익일에 수수료를 청구한다. ② “위탁자”는 “수탁자”가 청구한 날로부터 {payDue}일 이내에 위탁수수료를 현금으로 지급하며, 지급일이 휴무일인 경우에는 휴무일 익일에 지급한다. ③ “위탁자”는 “수탁자”에게 수수료 지급내역(지급명세서, 전자문서 등)을 교부하고, “수탁자”가 지급내역을 상시 열람할 수 있도록 하여야 한다. ④ “수탁자”가 고객으로부터 수취한 선착불 금액이 있는 경우 수취한 날로부터 {cashInDue}일 이내에 “위탁자”에게 입금하여야 한다. ⑤ “수탁자”는 “위탁자”의 수수료 정산 및 공제 내역에 대하여 서면으로 이의를 제기할 수 있으며, “위탁자”는 이의제기 받은 날로부터 {appealDue}일 이내에 그에 대한 확인 결과를 서면으로 통지하여야 한다." },
    { title: "제6조(택배 배송업무의 수행)", content: "① 계약 당사자는 고객의 화물을 안전하게 배송하는 등 서비스 품질 제고를 위해 노력해야 한다. ② “수탁자”는 「화물자동차 운수사업법」에 따라 허가받은 화물자동차를 이용하여 운송하여야 하며, 위탁업무 수행 과정에서 「생활물류서비스산업발전법」, 「도로교통법」, 「자동차관리법」 등 관련 법령을 준수하여야 한다. ③ “수탁자”는 원활한 택배서비스 제공을 위해 ㅇㅇ택배사로부터 위탁받은 “위탁자”의 규정 및 지침을 준수한다. ④ “수탁자”는 정부기관 및 ㅇㅇ택배사의 요청에 따른 “위탁자”의 실태조사, 자료요청 등에 적극 협조한다. ⑤ “수탁자”는 이 계약의 이행에 필요한 택배용품, 전산장비, 차량 등을 구비하여야 하며, “위탁자”는 필요시 계약기간동안 이를 지원 또는 대여할 수  있습니다. ⑥ “수탁자”는 고객과 관련된 정보를 본 계약을 이행하는 것 이외의 용도나 목적으로 사용하거나, 제3자에게 제공‧공개하여서는 아니 된다. ⑦ “수탁자”는 본 계약에 관한 권리의 일부 또는 전부를 “위탁자”의 사전 서면 동의 없이 제3자에게 양도할 수 없다. ⑧ “수탁자”가 동승인력을 사용할 경우에, “위탁자”는 그에 대한 책임을 지지 않는다. ⑨ “수탁자”가 “위탁자”에게 사전에 통지를 하지 않았거나, “수탁자”가 정당하지 않은 사유로 수탁업무를 해태하여 택배서비스 이행에 차질이 발생한 경우, “위탁자”는 제3자에게 수탁업무를 대신하도록 할 수 있으며, 이 경우 해당 수수료는 업무를 수행한 자에게 지급한다." },
    { title: "제7조(위탁자의 준수사항)", content: "① “위탁자”는 다음 각 호의 어느 하나에 해당하는 행위로서 공정한 거래를 저해할 우려가 있는 행위를 하거나 제3자에게 이를 행하도록 하지 않는다.\n1. 정당한 사유 없이 수수료의 전부 또는 일부의 지급을 지연하거나 거부하는 행위\n2. 계약 기간 중 사전 합의 없이 담당 구역, 수수료 지급 기준 등 거래조건을 “수탁자”에게 불리하게 변경하는 행위\n3. “수탁자”가 부담하여야 할 정당한 사유가 없음에도 불구하고 “위탁자”가 수취하기로 사전에 약정한 수수료, 관리비 등과 별도의 비용을 징수하는 행위\n4. 부당하게 계약 내용의 범위를 벗어나는 업무를 수행하도록 강요하는 행위(“위탁자”와 “수탁자”의 합의하에 타 업무를 수행할 경우 타 업무에 수반되는 비용을 일방적으로 “수탁자”에게 부담시키지 않는다.)\n5. 정당한 사유 없이 “수탁자”의 업무 수행에 필요한 시스템 접근을 차단하는 행위\n6. 계약 종료 시 정당한 사유 없이 수수료 정산을 거부하거나 지연하는 행위\n7. 계약 종료 시 “수탁자”에게 후임자를 구할 책임을 부담시키는 행위\n8. 계약 종료 이후 정당한 사유 없이 동종 업종의 타 사업자와의 계약을 방해하는 행위\n9. 천재지변, 전쟁, 내란 기타 불가항력적인 사유 시에 배송지연 책임을 전가시키는 행위\n② “위탁자”는 다음 각 호의 어느 하나에 해당하는 행위로서 “수탁자”를 부당하게 처우하거나 제3자에게 이를 행하도록 하지 않는다.\n10. “수탁자”의 사생활의 자유를 부당하게 침해하는 행위\n11. “수탁자”의 국적, 성별, 종교, 장애 등을 이유로 하여 합리적인 사유 없이 업무수행 환경이나 조건을 차별하거나 그 밖의 불리한 조치를 하는 행위\n③ “위탁자”는 “수탁자”에게 적정 수준의 휴일을 제공하여 “수탁자”의 쉴 권리를 보장할 수 있도록 노력하여야 한다." },
    { title: "제8조(안전보건 조치 등)", content: "① “위탁자”는 「산업안전보건법」 제77조에 따른 안전‧보건조치와 교육을 실시하여야 하며, “수탁자”는 이에 협조하여야 한다. ② “수탁자”는 「고용보험법」, 「산업재해보상보험법」 및 「고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률」에 따라 고용보험과 산업재해보상보험에 가입하여야 하며, “위탁자”는 “수탁자”의 수수료에서 원천공제하여 보험료를 납부할 수 있다. ③ “위탁자”는 “수탁자”의 일 평균 작업시간이 일 8시간을 지속적으로 초과할 경우 “위탁자”는 연 1회 이상 심혈관질환 등 건강검진 및 추가 프로그램을 실시하고, 그 결과에 따라 적정한 휴식시간 보장 등 별도의 건강관리 조치를 취하여야 한다. ④ “위탁자”는 “수탁자”가 작업시간 중 건강이상을 호소할 경우 긴급진료를 받을 수 있도록 하고, “수탁자”는 그 진료내역서를 “위탁자”와 공유한다." },
    { title: "제9조(작업시간 조정 등)", content: "① 계약 당사자는 “수탁자”의 최대 작업시간이 일 12시간, 주 60시간을 초과하지 않도록 노력한다. ② 제1항에도 불구하고, 야간 배송 업무의 특성에 따라 업무 종료 시각은 익일 07시를 원칙으로 한다. 다만, 설·추석 등 원청(쿠팡)에서 지정하는 특별한 기간이나 불가피한 연장 사유가 발생하여 원청의 시간 연장 요청이 있을 경우에는 이에 따른다. ③ “수탁자”의 작업시간이 4주 동안 1주 평균 64시간을 초과할 경우, 계약 당사자는 물량 · 배송구역 조정 협의를 통해 최대 작업시간 내로 감축할 수 있도록 노력하여야 한다. 단, 물량·배송구역 조정에 대한 협의가 되지 않을 경우에는 영업점을 대표하는 자, 택배기사를 대표하는 자가 추천하는 자를 포함하여 국토교통부가 구성한 조정위원회에서 조정할 수. ④ 제3항에 따라 물량·배송구역조정을 할 경우에는 서면으로 계약을 변경하여야 한다." },
    { title: "제10조(손해배상)", content: "① 택배화물의 훼손, 멸실, 분실, 운송지연 등으로 고객에게 손해가 발생한 경우에 “위탁자”와 “수탁자”는 귀책사유에 따라 그 손해배상 책임을 부담하며, “위탁자”가 “수탁자”를 대신해 우선 배상하는 경우에는 “수탁자”에게 구상권을 행사할 수 있다. ② “위탁자”는 손해배상에 대한 기준(금액, 비율 등)을 일방적으로 정하여 “수탁자”가 따르도록 거래조건을 설정하지 않으며, “수탁자”의 고의 또는 과실에 의하지 않은 손해배상책임은 “수탁자”에게만 일방적으로 부담시키지 않는다." },
    { title: "제11조(계약의 갱신 및 해지)", content: "① “위탁자”와 “수탁자”는 상호 합의하는 경우에는 계약을 해지할 수 있다. ② “위탁자”는 계약기간 만료 전 150일부터 60일까지 사이에 “수탁자”가 계약의 갱신을 요구하는 경우로서 총 계약기간(“위탁자”와 “수탁자”가 최초 위탁계약을 체결한 날부터 이 계약의 종료일까지의 기간을 말한다)이 6년 이하인 때에는 「생활물류서비스산업발전법 시행령」 제5조(택배서비스 운송 위탁계약의 갱신거절사유 등)에서 규정한 경우를 제외하고는 이를 거절할 수 없다. ③ “위탁자”는 제2항에 따른 갱신 요구를 거절하는 경우에는 그 요구를 받은 날부터 15일 이내에 “수탁자”에게 거절의 사유를 적어 서면으로 통지하여야 한다. ④ “위탁자”가 제3항에 따른 거절의 통지를 하지 않거나, 계약기간 만료 전 150일부터 60일까지 사이에 “수탁자”에게 계약변경, 계약갱신 등에 대해 서면으로 통지하지 않는 경우에는 이 계약과 같은 조건으로 1년간 다시 계약을 체결한 것으로 본다. ⑤ “위탁자”는 계약을 해지하려는 경우에는 “수탁자”에게 60일 이상의 유예기간을 두고 계약의 위반 사실을 구체적으로 밝히고 이를 시정하지 아니하면 그 계약을 해지한다는 사실을 서면으로 2회 이상 통지하여야 한다. ⑥ 제5항에도 불구하고 「생활물류서비스산업발전법 시행령」 제6조(택배서비스 운송 위탁계약 해지 통지의 생략사유)에서 규정한 경우에 해당 시 즉시 계약을 해지할 수. ⑦ “수탁자”의 사정으로 계약을 해지 할 경우, “수탁자”는 계약해지 60일 전에 “위탁자”에게 통지하고 업무가 원활하게 이전되도록 협조한다." },
    { title: "제12조(개인정보 수집)", content: "① “위탁자”는 계약체결을 위해 필요한 “수탁자”의 개인정보를 “수탁자”의 동의 (별지 제1호 서식)를 받아 수집‧이용할 수 있다. ② “위탁자”는 「화물자동차 운수사업법」 제9조의2에 따른 범죄경력 조회를 위해 국토교통부장관 또는 시‧도지사가 “수탁자”의 개인정보를 요청할 경우 요청자에게 이를 제공할 수 있다. ③ “위탁자”는 제1항 및 제2항의 목적 외 다른 용도로 “수탁자”의 개인정보를 사용할 수 없으며, 제3자에게 제공하여서는 아니 된다." },
    { title: "제13조(분쟁 해결)", content: "① “위탁자”와 “수탁자”는 이 계약에 명시되지 아니한 사항 또는 계약의 해석에 관한 사항에 다툼이 있는 경우에는 쌍방의 합의에 의해 해결한다. ② 제1항에 따라 해결되지 않는 경우에는 민사소송법에 따라 법원에서의 소송(訴訟)을 통해 분쟁을 해결한다." },
    { title: "제14조(소의 관할)", content: "본 계약에 관한 소송은 민사소송법에 따르거나, 양 당사자의 합의에 의해 정한 곳을 관할 법원으로 한다." },
    { title: "제15조(부속합의)", content: "① “위탁자”와 “수탁자”는 이 계약의 내용을 보충하거나, 이 계약에서 정하지 아니한 사항을 규정하기 위하여 부속 합의서를 작성할 수 있다. ② 전항의 부속합의는 이 계약의 내용에 배치 또는 위반되지 않는 범위 내에서 이 계약의 내용으로 인정된다." },
    { title: "제16조 (계약의 효력)", content: "① “위탁자”와 “수탁자”는 이 계약을 체결하기 전에 충분한 협의를 거쳤고, 계약 내용을 모두 숙지하였으며, 이 계약을 증명하기 위하여 “위탁자”와 “수탁자”는 쌍방이 기명날인한 계약서 원본 2부를 작성하여 각 1부씩 보관한다. ② 이 계약서의 내용은 “위탁자”와 “수탁자”사이의 서면 합의에 의해서만 변경되거나 수정될 수 있으며, 그 변경 및 수정은 “위탁자”와 “수탁자”가 해당 서면에 서명함과 동시에 그 효력을 발생한다." }
];

const getProxiedImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http') && url.includes('firebasestorage.googleapis.com')) {
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
    }
    return url;
};

const AutoFitPreview = ({ naturalWidth, children }) => {
    const outerRef = useRef(null);
    const innerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [scaledHeight, setScaledHeight] = useState(null);

    useEffect(() => {
        const recompute = () => {
            if (!outerRef.current || !innerRef.current) return;
            const containerWidth = outerRef.current.clientWidth;
            const nextScale = containerWidth > 0 ? Math.min(1, containerWidth / naturalWidth) : 1;
            setScale(nextScale);
            setScaledHeight(innerRef.current.scrollHeight * nextScale);
        };
        recompute();
        const ro = new ResizeObserver(recompute);
        if (outerRef.current) ro.observe(outerRef.current);
        if (innerRef.current) ro.observe(innerRef.current);
        return () => ro.disconnect();
    }, [naturalWidth]);

    return (
        <div ref={outerRef} style={{ width: '100%', height: scaledHeight || undefined, overflow: 'hidden' }}>
            <div ref={innerRef} style={{ width: naturalWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {children}
            </div>
        </div>
    );
};

const PdfTemplate = ({ contract, templateRef, preview = false }) => {
    const repName = (contract && contract.reqAdminName && !contract.reqAdminName.includes('대표님') && contract.reqAdminName !== '김코끼리' && contract.reqAdminName !== '김 코 끼 리') ? contract.reqAdminName : '권오민';
    if (!contract) return null;
    if (contract.templateType === 'custom') {
        const customStyle = preview
            ? { width: '1000px', backgroundColor: '#ffffff', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
            : { width: '1000px', position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -9999, backgroundColor: '#ffffff' };
        const customContent = (
            <div ref={preview ? undefined : templateRef} style={customStyle}>
                {contract.bgImage && <img src={contract.bgImage} style={{ width: '100%', display: 'block' }} alt="bg" />}
                {contract.textFields && contract.textFields.map(f => (
                    <div key={f.id} style={{ position: 'absolute', top: f.y, left: f.x, fontSize: '18px', fontWeight: 'bold', color: 'black', whiteSpace: 'nowrap' }}>
                        {f.text}
                    </div>
                ))}
                {contract.signatureField && (
                    <img src={contract.signatureField.dataUrl} style={{ position: 'absolute', top: contract.signatureField.y, left: contract.signatureField.x, width: '120px', mixBlendMode: 'multiply' }} alt="sig" />
                )}
            </div>
        );
        return preview ? <AutoFitPreview naturalWidth={1000}>{customContent}</AutoFitPreview> : customContent;
    }

    const standardStyle = preview
        ? { width: '800px', backgroundColor: '#ffffff', padding: '56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }
        : { width: '800px', position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -9999, backgroundColor: '#ffffff', padding: '56px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' };

    const standardContent = (
        <div id="pdf-print-area" ref={preview ? undefined : templateRef} style={standardStyle}>
            <div className="border-[2px] border-black p-10 flex flex-col relative text-black font-sans text-[12px] leading-relaxed">
                <h1 className="text-3xl font-extrabold mt-8 mb-12 text-center tracking-widest">{contract.title}</h1>

                {contract.templateType === 'standard_consignment' && (
                    <div className="flex-1 space-y-6 text-justify">
                        <div className="mb-4 text-justify text-[13px]">
                            쿠팡 로지스틱스 서비스 코끼리물류(이하 “위탁자”라 함)와 택배종사자 <span className="font-bold underline px-2">{contract.name}</span> (이하 “수탁자”라 함)은 택배 운송 업무에 관하여 다음과 같이 위‧수탁계약을 체결한다.
                        </div>
                        <div className="space-y-4">
                            {CONTRACT_ARTICLES.map((art, idx) => {
                                let content = art.content;
                                if (art.title.includes('제4조')) {
                                    content = content
                                        .replace('{startDate}', contract.variables?.targetDate || '20   년  월  일')
                                        .replace('{endDate}', (() => {
                                            if (contract.variables?.targetEndDate) {
                                                return contract.variables.targetEndDate;
                                            }
                                            if (contract.variables?.targetDate) {
                                                const d = new Date(contract.variables.targetDate);
                                                d.setFullYear(d.getFullYear() + 1);
                                                d.setDate(d.getDate() - 1);
                                                return d.toISOString().split('T')[0];
                                            }
                                            return '20   년  월  일';
                                        })())
                                        .replace('{contractMonths}', (() => {
                                            if (contract.variables?.targetDate && contract.variables?.targetEndDate) {
                                                const start = new Date(contract.variables.targetDate);
                                                const end = new Date(contract.variables.targetEndDate);
                                                let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                                                if (end.getDate() >= start.getDate() - 1) months += 1;
                                                return String(Math.max(months, 1));
                                            }
                                            return '12';
                                        })())
                                        .replace('● 담당구역: {route}\n● 수수료:\n○ 집화수수료: 1건당 {pickupFee}원 또는 택배사업자 – 영업점 간 수수료 기준 금액의 {pickupPct}%\n○ 배송수수료: 1건당 {deliveryFee}원 또는 택배사업자 – 영업점 간 수수료 기준 금액의 {deliveryPct}%', 
                                                 (() => {
                                                     const fees = contract.variables?.routeFees || [
                                                         { route: contract.variables?.route || '미지정', unitPrice: contract.variables?.unitPrice || '미지정' }
                                                     ];
                                                     return fees.map((rf, rIdx) => 
                                                         `● 담당구역${fees.length > 1 ? ' (' + (rIdx + 1) + ')' : ''}: ${rf.route || '미지정'}\n● 수수료(단가)${fees.length > 1 ? ' (' + (rIdx + 1) + ')' : ''}: 1건당 ${rf.unitPrice && rf.unitPrice !== '미지정' ? Number(rf.unitPrice).toLocaleString() + '원' : '미지정'}`
                                                     ).join('\n\n');
                                                 })())
                                        .replace('{paymentDay}', '15')
                                        .replace('{carNumber}', contract.variables?.carNumber || '____________________')
                                        .replace('{licenseNumber}', contract.variables?.licenseNumber || '____________________')
                                        .replace('{sortingFee}', '0')
                                        .replace('{sortingExclHours}', '____');
                                }
                                if (art.title.includes('제5조')) {
                                    content = content
                                        .replace('{maDate}', '25')
                                        .replace('{reqDate}', '5')
                                        .replace('{payDue}', '15')
                                        .replace('{cashInDue}', '3')
                                        .replace('{appealDue}', '10');
                                }
                                return (
                                    <div key={idx} className="text-justify">
                                        <h4 className="font-bold mb-1.5">{art.title}</h4>
                                        <p className="whitespace-pre-wrap">{content}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {contract.templateType === 'standard_supplementary' && (
                    <div className="flex-1 text-[17px] leading-relaxed space-y-6">
                        <p className="font-bold">합의 대상자: {contract.name} 기사님</p>
                        <p>본 부속합의서는 기존에 체결된 물류운송 위수탁 계약서의 효력을 유지하며, 특정 노선 또는 추가 업무에 대한 배송 단가 합의를 명확히 함을 목적으로 작성되었다.</p>
                        
                        <div className="flex flex-col mt-8 mb-8 border border-black max-w-[600px] mx-auto text-center shadow-sm text-sm">
                            <div className="flex bg-gray-100 border-b border-black font-extrabold">
                                <div className="w-16 p-3 border-r border-black">순번</div>
                                <div className="flex-1 p-3 border-r border-black">담당구역</div>
                                <div className="flex-1 p-3">위탁 합의 단가</div>
                            </div>
                            {(() => {
                                const fees = contract.variables?.routeFees || [
                                    { route: contract.variables?.route || '지정구역', unitPrice: contract.variables?.unitPrice || '0' }
                                ];
                                return fees.map((rf, idx) => (
                                    <div className="flex border-b border-black last:border-b-0 font-bold" key={idx}>
                                        <div className="w-16 p-3 border-r border-black flex items-center justify-center">{idx + 1}</div>
                                        <div className="flex-1 p-3 border-r border-black flex items-center justify-center">{rf.route || '-'}</div>
                                        <div className="flex-1 p-3 text-[#1E5DDE] flex items-center justify-center">{rf.unitPrice ? Number(rf.unitPrice).toLocaleString() + ' 원' : '-'}</div>
                                    </div>
                                ));
                            })()}
                        </div>

                        <div className="mt-10 space-y-3 text-[14px]">
                            <h4 className="font-bold text-[15px]">■ 수탁자 성실 수행 의무</h4>
                            <p>① "수탁자"는 배송 업무 수행률을 월 95% 이상 유지하도록 성실히 노력한다.</p>
                            <p>② "수탁자"의 개인 사정으로 인해 정해진 근무 스케줄 외의 휴무가 발생하는 경우, "수탁자"는 본인의 책임과 비용으로 대체 차량(용차) 등을 활용하여 배송 업무에 공백이 발생하지 않도록 조치한다.</p>
                            <p>③ "수탁자"는 프레시백(보냉가방 등) 회수율을 월 95% 이상 유지하도록 성실히 수행한다.</p>
                            <p>④ "수탁자"는 운행 전 앱 내 일일 안전점검(TBM, 차량 안전점검표 등)을 매일 빠짐없이 성실히 수행하며, 점검 중 발견된 차량 이상 사항은 즉시 "위탁자"에게 보고한다.</p>
                            <p>⑤ "수탁자"는 관계 법령에 따라 실시하는 근로자 건강검진을 성실히 수검하며, 정당한 사유 없이 이를 거부하거나 지연하지 아니한다.</p>
                        </div>

                        <p className="mt-12 text-center text-gray-700 font-bold leading-relaxed">위 명시된 단가 및 준수사항은 상호 합의 하에 즉시 효력이 발생하며,<br />양 당사자는 본 합의서의 내용에 전적으로 동의한다.</p>
                    </div>
                )}

                <div className="mt-12 pt-8 border-t-[2px] border-black flex justify-between px-8 pb-4">
                    <div className="text-sm">
                        <p className="font-extrabold mb-3 text-base">위탁자</p>
                        <p className="text-xs">상호: 코끼리물류</p>
                        <p className="text-xs font-bold">대표자: {repName} (인)</p>
                        <div className="relative w-16 h-16 -mt-8 ml-36">
                            <img src="/admin_seal.png" className="w-full h-full object-contain absolute top-0 left-0 mix-blend-multiply opacity-90" alt="seal" />
                        </div>
                    </div>

                    <div className="text-sm w-[250px]">
                        <p className="font-extrabold mb-3 text-base text-right pr-6">수탁자</p>
                        <p className="text-xs font-bold flex items-center justify-end gap-2 relative h-8">
                            성명: {contract.name}
                            {contract.signatureField && contract.signatureField.dataUrl ? (
                                <img src={getProxiedImageUrl(contract.signatureField.dataUrl)} className="absolute right-[-10px] top-[-30px] w-[120px] max-h-[80px] object-contain mix-blend-multiply opacity-90" alt="signature" />
                            ) : (
                                <span className="text-gray-400 font-normal text-[11px] ml-2">(서명)</span>
                            )}
                        </p>
                    </div>
                </div>
                <p className="text-center text-gray-500 font-bold mb-4 text-xs">계약서 작성 일자: {contract.date || '20   년  월  일'} | 전자서명 완료 일자: {contract.status === '서명완료' ? '2026-06-01' : (contract.signedDate || '-')}</p>
            </div>
        </div>
    );

    return preview ? <AutoFitPreview naturalWidth={800}>{standardContent}</AutoFitPreview> : standardContent;
};

const StatusCard = ({ title, subtitle, icon, bgClass, textClass, onClick }) => (
    <div onClick={onClick} className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-[0_2px_8px_rgb(0,0,0,0.02)] flex items-center gap-5 hover:shadow-[0_4px_16px_rgb(0,0,0,0.06)] transition-all duration-200 cursor-pointer group hover:border-[#EBF5FF]">
        <div className={`w-14 h-14 rounded-[14px] ${bgClass} ${textClass} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>{icon}</div>
        <div className="flex flex-col gap-1.5 justify-center">
            <h3 className="font-bold text-gray-900 text-[18px] leading-none group-hover:text-blue-600 transition-colors">{title}</h3>
            <p className="text-[14px] text-gray-400 font-medium leading-none">{subtitle}</p>
        </div>
    </div>
);

const DASHBOARD_ADMIN_EMAIL = 's01025144826@gmail.com';
const DASHBOARD_REQUIRED_DOCS = ['화물운송자격증', '운송사업허가증', '자동차등록증', '최초안전교육수료증'];

const DashboardHome = ({ setActivePage, user, contracts = [], vehicleDocs = [], contacts = [], safetyRecords = [] }) => {
    const isAdmin = user && user.email === DASHBOARD_ADMIN_EMAIL;

    const kpis = useMemo(() => {
        if (!isAdmin) return null;

        // 서류 미제출 인원
        const drivers = contacts.filter(c => c.role === '배송기사' || c.role === '조장');
        const missingDocsCount = drivers.filter(driver =>
            DASHBOARD_REQUIRED_DOCS.some(docType => !vehicleDocs.some(d => d.email === driver.email && d.docType === docType))
        ).length;

        // 계약 만료 임박 (90일 이내, 위수탁계약서 기준)
        const now = new Date();
        const expiringContracts = contracts.filter(c => {
            if (c.templateType !== 'standard_consignment' || !c.variables?.targetDate) return false;
            const start = new Date(c.variables.targetDate);
            if (isNaN(start.getTime())) return false;
            const expiry = new Date(start);
            expiry.setFullYear(expiry.getFullYear() + 1);
            const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            return daysLeft >= 0 && daysLeft <= 90;
        }).length;

        // 이번달 사고 건수
        const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const accidentsThisMonth = safetyRecords.filter(r => r.formType === 'accident_report' && (r.date || '').startsWith(monthPrefix)).length;

        return {
            missingDocsCount,
            expiringContracts,
            accidentsThisMonth,
            totalMembers: contacts.length
        };
    }, [isAdmin, contacts, vehicleDocs, contracts, safetyRecords]);

    const cards = [
        { title: '계약관리', subtitle: '전자서명·단가·조회', icon: <Icons.Contract />, bgClass: 'bg-[#EFF5FF]', textClass: 'text-[#3679EE]' },
        { title: '스케줄관리', subtitle: '배차·근무일정', icon: <Icons.Schedule />, bgClass: 'bg-[#F5F2FF]', textClass: 'text-[#965DE8]' },
        { title: '안전보건관리', subtitle: '교육·점검·사고보고', icon: <Icons.Safety />, bgClass: 'bg-[#EAFBF3]', textClass: 'text-[#1BC271]' },
        { title: '비상연락망', subtitle: '연락처·긴급전화', icon: <Icons.Phone />, bgClass: 'bg-[#FFF0EF]', textClass: 'text-[#FB5163]' },
        { title: '차량/서류관리', subtitle: '차량·정비·보험', icon: <Icons.Truck />, bgClass: 'bg-[#FFF7E8]', textClass: 'text-[#F59929]' },
        { title: '업무내역입력', subtitle: '일일보고·배송건수', icon: <Icons.Clipboard />, bgClass: 'bg-[#EBFBFB]', textClass: 'text-[#2DC4D1]' },
        { title: '노선관리', subtitle: '노선(라우트)·꿀팁·지도', icon: <Icons.Map />, bgClass: 'bg-[#F0F5FF]', textClass: 'text-[#4F46E5]' }
    ];
    return (
        <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative animate-fade-in w-full max-w-[100vw] md:max-w-[calc(100vw-260px)] overflow-x-hidden">
            <header className="mb-[32px] border-b border-gray-100 pb-6 w-full max-w-[1200px]">
                <h2 className="text-[26px] font-extrabold text-[#0F172A] mb-2 tracking-tight">대시보드</h2>
                <p className="text-[15px] text-gray-500 font-medium tracking-tight">코끼리물류 관리 시스템 - 스마트 에디터 활성화됨</p>
            </header>

            {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-[1200px]">
                    <button onClick={() => setActivePage('차량/서류관리')} className={`text-left rounded-2xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${kpis.missingDocsCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                        <p className={`text-[13px] font-bold mb-1 ${kpis.missingDocsCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>서류 미제출 인원</p>
                        <p className={`text-[26px] font-extrabold ${kpis.missingDocsCount > 0 ? 'text-amber-700' : 'text-[#0F172A]'}`}>{kpis.missingDocsCount}<span className="text-[15px] font-bold ml-1 opacity-60">명</span></p>
                    </button>
                    <button onClick={() => setActivePage('계약관리')} className={`text-left rounded-2xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${kpis.expiringContracts > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <p className={`text-[13px] font-bold mb-1 ${kpis.expiringContracts > 0 ? 'text-red-600' : 'text-gray-400'}`}>계약 만료 임박 (90일)</p>
                        <p className={`text-[26px] font-extrabold ${kpis.expiringContracts > 0 ? 'text-red-700' : 'text-[#0F172A]'}`}>{kpis.expiringContracts}<span className="text-[15px] font-bold ml-1 opacity-60">건</span></p>
                    </button>
                    <button onClick={() => setActivePage('안전보건관리')} className={`text-left rounded-2xl border p-5 shadow-sm transition-transform hover:-translate-y-0.5 ${kpis.accidentsThisMonth > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                        <p className={`text-[13px] font-bold mb-1 ${kpis.accidentsThisMonth > 0 ? 'text-red-600' : 'text-gray-400'}`}>이번달 사고 건수</p>
                        <p className={`text-[26px] font-extrabold ${kpis.accidentsThisMonth > 0 ? 'text-red-700' : 'text-[#0F172A]'}`}>{kpis.accidentsThisMonth}<span className="text-[15px] font-bold ml-1 opacity-60">건</span></p>
                    </button>
                    <button onClick={() => setActivePage('회원관리')} className="text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm transition-transform hover:-translate-y-0.5">
                        <p className="text-[13px] text-gray-400 font-bold mb-1">전체 등록 인원</p>
                        <p className="text-[26px] font-extrabold text-[#0F172A]">{kpis.totalMembers}<span className="text-[15px] font-bold ml-1 opacity-60">명</span></p>
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-6 max-w-[1200px]">
                {cards.map((card, idx) => <StatusCard key={idx} {...card} icon={React.cloneElement(card.icon, { width: 24, height: 24 })} onClick={() => setActivePage(card.title)} />)}
            </div>
        </main>
    );
}

const PageView = ({ title }) => (
    <main className="md:ml-[260px] ml-0 px-4 md:px-10 py-6 md:py-12 flex-1 relative animate-fade-in">
        <header className="mb-[40px] border-b border-gray-100 pb-6 w-full max-w-[1200px]"><h2 className="text-[26px] font-extrabold text-[#0F172A] mb-2">{title}</h2></header>
        <div className="max-w-[1200px] h-[400px] bg-white rounded-2xl p-10 border border-gray-100/80 shadow-sm flex flex-col items-center justify-center text-center">
            <h3 className="text-[22px] font-bold text-gray-900 mb-3">{title} 준비 중</h3>
            <p className="text-[16px] text-gray-500">실제 데이터 연동 후 개발될 예정입니다.</p>
        </div>
    </main>
);

const SIDEBAR_ADMIN_EMAIL = 's01025144826@gmail.com';

const Sidebar = ({ activePage, setActivePage, user, onLogout, onWithdraw, isSidebarOpen, setIsSidebarOpen }) => {
    const isAdmin = user && user.email === SIDEBAR_ADMIN_EMAIL;
    const menus = [
        { id: '대시보드', icon: <Icons.Dashboard /> },
        { id: '계약관리', icon: <Icons.Contract /> },
        { id: '스케줄관리', icon: <Icons.Schedule /> },
        { id: '안전보건관리', icon: <Icons.Safety /> },
        { id: '비상연락망', icon: <Icons.Phone /> },
        { id: '차량/서류관리', icon: <Icons.Truck /> },
        { id: '업무내역입력', icon: <Icons.Clipboard /> },
        { id: '노선관리', icon: <Icons.Map /> },
        ...(isAdmin ? [{ id: '회원관리', icon: <Icons.Users /> }, { id: '알림관리', icon: <Icons.Bell /> }, { id: '배차변환기', icon: <Icons.Table /> }] : [])
    ];
    return (
        <>
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}
            <aside className={`w-[260px] h-screen bg-white border-r fixed left-0 top-0 z-50 flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-xl md:shadow-none`}>
                <div className="px-6 py-5 flex items-center justify-between border-b border-transparent">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActivePage('대시보드'); setIsSidebarOpen(false); }}>
                        <img src="/logo.png" alt="코끼리물류" className="w-9 h-9 rounded-lg object-cover" />
                        <h1 className="text-[20px] font-bold text-gray-900 tracking-tight">코끼리물류</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
                        <Icons.X />
                    </button>
                </div>
                <nav className="flex-1 px-4 py-3 flex flex-col gap-1.5 overflow-y-auto">
                    {menus.map(m => (
                        <button key={m.id} onClick={() => { setActivePage(m.id); setIsSidebarOpen(false); }} className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-colors ${activePage === m.id ? 'bg-[#EBF5FF] text-[#1E5DDE]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                            <div className={activePage === m.id ? 'text-[#1E5DDE]' : 'text-gray-400'}>{m.icon}</div>{m.id}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t mt-auto space-y-2">
                    <button onClick={() => { onLogout(); setIsSidebarOpen(false); }} className="w-full py-2.5 bg-gray-50 hover:bg-red-50 text-red-600 rounded-lg text-sm font-bold transition-colors">로그아웃 ({user.name})</button>
                    {onWithdraw && (
                        <button onClick={() => { onWithdraw(); setIsSidebarOpen(false); }} className="w-full py-1.5 text-gray-400 hover:text-red-500 text-xs font-bold transition-colors text-center block">
                            회원탈퇴 (계정 영구삭제)
                        </button>
                    )}
                </div>
            </aside>
        </>
    );
};

const BottomNav = ({ activePage, setActivePage }) => {
    const navItems = [
        { id: '대시보드', label: '홈', icon: <Icons.Home /> },
        { id: '안전보건관리', label: '안전보건', icon: <Icons.Safety /> },
        { id: '비상연락망', label: '연락처', icon: <Icons.PhoneCall /> },
        { id: '스케줄관리', label: '스케줄', icon: <Icons.Schedule /> },
        { id: '업무내역입력', label: '업무내역', icon: <Icons.Clipboard /> }
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-gray-100 flex items-center justify-around px-2 z-40 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)] backdrop-blur-md bg-white/90">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`flex flex-col items-center gap-1 transition-all ${activePage === item.id ? 'text-blue-600' : 'text-gray-400'}`}
                >
                    <span className={`${activePage === item.id ? 'scale-110 text-blue-600' : 'scale-100'} transition-transform`}>{item.icon}</span>
                    <span className="text-[10px] font-bold">{item.label}</span>
                    {activePage === item.id && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-0.5 animate-pulse"></div>}
                </button>
            ))}
        </div>
    );
};

export { Icons, DraggableNode, SignaturePadModal, PdfTemplate, StatusCard, DashboardHome, PageView, Sidebar, BottomNav };
