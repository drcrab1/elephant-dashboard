import { jsPDF } from 'jspdf';
import { toCanvas } from 'html-to-image';

const HEADING = /^H[1-6]$/;

// 긴 문서 화면을 A4 여러 장짜리 PDF로 만듭니다. 쪽 경계는 조항·문단 사이에서 잡아 글자가 잘리지 않게 합니다.
export const elementToA4Pdf = async (element, { margin = 8, pixelRatio = 2 } = {}) => {
    const canvas = await toCanvas(element, {
        pixelRatio,
        backgroundColor: '#ffffff',
        style: { opacity: '1', visibility: 'visible', transform: 'none' },
    });
    const elW = element.offsetWidth;
    const elH = element.offsetHeight;
    const ratio = canvas.width / elW;
    const usableW = 210 - margin * 2;
    const usableH = 297 - margin * 2;
    const pageHpx = (usableH * elW) / usableW;

    // 쪽을 나눌 수 있는 위치: 블록 요소의 아래 끝 (제목 바로 아래는 제외해 제목만 홀로 남지 않게 함)
    const top = element.getBoundingClientRect().top;
    const cuts = [];
    element.querySelectorAll('*').forEach((el) => {
        if (HEADING.test(el.tagName)) return;
        const d = getComputedStyle(el).display;
        if (!['block', 'list-item', 'table', 'table-row', 'flex'].includes(d)) return;
        const r = el.getBoundingClientRect();
        if (r.height > 0) cuts.push(r.bottom - top);
    });

    const ranges = [];
    let start = 0;
    while (elH - start > pageHpx + 1) {
        const limit = start + pageHpx;
        const fit = cuts.filter((c) => c > start + pageHpx * 0.4 && c <= limit + 0.5);
        const end = fit.length ? Math.max(...fit) : limit;
        ranges.push([start, end]);
        start = end;
    }
    ranges.push([start, elH]);

    const pdf = new jsPDF('p', 'mm', 'a4');
    ranges.forEach(([a, b], i) => {
        const sy = Math.round(a * ratio);
        const sh = Math.min(canvas.height - sy, Math.round((b - a) * ratio));
        if (sh <= 0) return;
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sh;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
        if (i > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', margin, margin, usableW, (sh / ratio) * (usableW / elW));
    });
    return pdf;
};
