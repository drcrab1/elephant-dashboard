import React from 'react';
import { isChunkError, reloadOnce } from './chunk-reload';


export class ErrorBoundary extends React.Component {
    state = { error: null };

    static getDerivedStateFromError(error) { return { error }; }

    componentDidCatch(error) {
        console.error('화면 오류:', error);
        if (isChunkError(error)) reloadOnce();
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center', fontFamily: 'sans-serif' }}>
                <p style={{ fontWeight: 800, fontSize: 18 }}>화면을 불러오는 중 문제가 생겼습니다.</p>
                <p style={{ color: '#6b7280', fontSize: 14 }}>새 버전이 올라온 직후에 생길 수 있습니다. 새로고침하면 대부분 해결됩니다.</p>
                <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: 12, background: '#2E68ED', color: '#fff', fontWeight: 700 }}>새로고침</button>
            </div>
        );
    }
}
