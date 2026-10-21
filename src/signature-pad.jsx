import React, { useRef, useState, useEffect } from 'react';

// 터치/마우스 서명 패드 (반응형)
export const SignaturePad = ({ onChange }) => {
    const ref = useRef(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);

    useEffect(() => {
        const ctx = ref.current.getContext('2d');
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111';
    }, []);

    const pos = (e) => {
        const c = ref.current;
        const r = c.getBoundingClientRect();
        const pt = e.touches ? e.touches[0] : e;
        return { x: ((pt.clientX - r.left) / r.width) * c.width, y: ((pt.clientY - r.top) / r.height) * c.height };
    };
    const start = (e) => {
        e.preventDefault();
        drawing.current = true;
        const { x, y } = pos(e);
        const ctx = ref.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
    };
    const move = (e) => {
        if (!drawing.current) return;
        e.preventDefault();
        const { x, y } = pos(e);
        const ctx = ref.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    const end = () => {
        if (!drawing.current) return;
        drawing.current = false;
        setHasInk(true);
        onChange(ref.current.toDataURL('image/png'));
    };
    const clear = () => {
        const c = ref.current;
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
        setHasInk(false);
        onChange(null);
    };

    return (
        <div>
            <canvas
                ref={ref}
                width={600}
                height={220}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 touch-none"
                onMouseDown={start}
                onMouseMove={move}
                onMouseUp={end}
                onMouseLeave={end}
                onTouchStart={start}
                onTouchMove={move}
                onTouchEnd={end}
            />
            <div className="flex items-center justify-between mt-2">
                <span className="text-[12px] text-gray-400 font-medium">{hasInk ? '서명이 입력되었습니다.' : '위 칸에 손가락 또는 마우스로 서명해주세요.'}</span>
                <button type="button" onClick={clear} className="text-[12px] font-bold text-gray-500 hover:text-red-500">지우기</button>
            </div>
        </div>
    );
};
