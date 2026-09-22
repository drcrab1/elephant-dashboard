const formatPhoneNumber = (value) => {
    if (!value) return '';
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length <= 3) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    if (raw.length <= 11) return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
};
import React, { useState } from 'react';
import firebase, { auth, db } from './firebase';
import { Icons } from './ui-components';

const ADMIN_EMAIL = 's01025144826@gmail.com';

// --- Authentication (Real Firebase Auth) ---
        const LoginScreen = ({ onLogin }) => {
            const [mode, setMode] = useState('login'); // 'login' | 'signup'
            const [name, setName] = useState('');
            const [phone, setPhone] = useState('');
            const [isLoading, setIsLoading] = useState(false);

            const handleGoogleAuth = async () => {
                if (mode === 'signup' && (!name || !phone)) return alert('직원 등록을 위해 실명과 휴대폰 번호를 모두 입력해주세요.');

                setIsLoading(true);
                try {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    // Force prompt to ensure they can select account
                    provider.setCustomParameters({ prompt: 'select_account' });
                    const result = await auth.signInWithPopup(provider);
                    const userEmail = result.user.email;

                    if (mode === 'signup') {
                        await db.collection('users').doc(userEmail).set({
                            name,
                            phone,
                            role: userEmail === ADMIN_EMAIL ? 'admin' : 'driver',
                            createdAt: new Date().toISOString()
                        });
                    }

                    // Fetch from DB to ensure name/phone are loaded
                    const docSnap = await db.collection('users').doc(userEmail).get();
                    let finalName = result.user.displayName || userEmail.split('@')[0];
                    let finalPhone = '';

                    if (docSnap.exists) {
                        finalName = docSnap.data().name;
                        finalPhone = docSnap.data().phone || '';
                    } else {
                        if (userEmail === ADMIN_EMAIL) finalName = '대표님 (관리자)';
                    }

                    onLogin({ email: userEmail, name: finalName, phone: finalPhone });
                } catch (error) {
                    console.error(error);
                    alert('구글 로그인 중 에러가 발생했습니다:\n' + error.message);
                    auth.signOut();
                } finally {
                    setIsLoading(false);
                }
            };

            return (
                <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
                    <div className="sm:mx-auto sm:w-full sm:max-w-md animate-fade-in relative z-10">
                        <div className="mx-auto w-16 h-16 flex items-center justify-center bg-white rounded-2xl shadow-sm mb-6 border border-gray-100">
                            <span className="text-blue-600"><Icons.Logo /></span>
                        </div>
                        <h2 className="mt-2 text-center text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                            코끼리물류 파트너스
                        </h2>
                        <p className="mt-2 text-center text-[15px] font-medium text-gray-500">
                            {mode === 'login' ? '실제 구글 계정으로 연동하여 로그인합니다' : '구글 계정과 연동할 직원 정보를 입력해주세요'}
                        </p>
                    </div>

                    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md animate-fade-in relative z-10" style={{ animationDelay: '0.1s' }}>
                        <div className="bg-white py-10 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:rounded-[24px] sm:px-10 border border-gray-100">

                            <div className="flex p-1 bg-gray-100 rounded-xl mb-8">
                                <button type="button" onClick={() => setMode('login')} className={`flex-1 py-2.5 text-[14px] font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>기존 로그인</button>
                                <button type="button" onClick={() => setMode('signup')} className={`flex-1 py-2.5 text-[14px] font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>신규 직원 등록</button>
                            </div>

                            <div className="space-y-5">
                                {mode === 'signup' && (
                                    <div className="space-y-5 mb-6">
                                        <div className="animate-fade-in">
                                            <label htmlFor="name" className="block text-[14px] font-bold text-gray-700 mb-2">실명 (이름) <span className="text-red-500">*</span></label>
                                            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E68ED] focus:border-transparent transition-all font-medium text-[15px]" />
                                        </div>
                                        <div className="animate-fade-in" style={{ animationDelay: '0.05s' }}>
                                            <label htmlFor="phone" className="block text-[14px] font-bold text-gray-700 mb-2">휴대폰 번호 <span className="text-red-500">*</span></label>
                                            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} placeholder="010-0000-0000" className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2E68ED] focus:border-transparent transition-all font-extrabold tracking-wide text-[15px]" />
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button onClick={handleGoogleAuth} disabled={isLoading} className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-[15px] font-bold text-white bg-[#2E68ED] hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50">
                                        <Icons.Google /> {isLoading ? '구글 연동 중...' : (mode === 'login' ? 'Google 계정으로 로그인' : '정보 입력 후 Google 연동 가입')}
                                    </button>
                                    {mode === 'login' && <p className="text-center text-xs text-gray-400 mt-4 font-bold">크롬 브라우저 사용자 권장</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

export { LoginScreen };