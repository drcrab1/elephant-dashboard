const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'asia-northeast3' });

const ADMIN_EMAIL = 's01025144826@gmail.com';
const ROUTE_COLUMNS = ['503AB', '503CD', '402CD', '001CD', '901CD', '452ABCD', '454ABD', '452D+454B', '323CD'];

// CSV 한 줄을 콤마 기준으로 나누고 앞뒤 공백/따옴표를 정리합니다. (schedule.jsx와 동일한 규칙)
const parseTodaysDriverNames = (csvText, todayLabel) => {
    const rows = csvText.split('\n');
    const names = new Set();
    rows.forEach((r) => {
        const cols = r.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 12) return;
        if (cols[0].replace(/\s+/g, '') === '출근일') return;
        const rawDate = cols[0].replace(/\s+/g, '');
        if (rawDate !== todayLabel) return;
        ROUTE_COLUMNS.forEach((route, i) => {
            const driverName = (cols[3 + i] || '').trim();
            if (driverName) names.add(driverName);
        });
    });
    return Array.from(names);
};

// 기사 이름 -> 이메일 매칭 (비상연락망 contacts 기준, 정확히 일치 우선, 안되면 포함관계로 보완)
const resolveEmailsByName = async (driverNames) => {
    if (driverNames.length === 0) return [];
    const contactsSnap = await db.collection('contacts').get();
    const contacts = contactsSnap.docs.map((d) => d.data()).filter((c) => c.email && c.name);
    const emails = new Set();
    driverNames.forEach((name) => {
        const exact = contacts.find((c) => c.name === name);
        if (exact) { emails.add(exact.email); return; }
        const partial = contacts.find((c) => name.includes(c.name) || c.name.includes(name));
        if (partial) emails.add(partial.email);
    });
    return Array.from(emails);
};

// 이메일 목록으로 users 컬렉션에서 fcmTokens를 모읍니다. {email: [token, ...]}
const getTokensByEmail = async (emails) => {
    const result = {};
    await Promise.all(emails.map(async (email) => {
        const doc = await db.collection('users').doc(email).get();
        const tokens = doc.exists ? (doc.data().fcmTokens || []) : [];
        if (tokens.length > 0) result[email] = tokens;
    }));
    return result;
};

// 모든 가입자의 fcmTokens를 모읍니다.
const getAllTokens = async () => {
    const snap = await db.collection('users').get();
    const result = {};
    snap.docs.forEach((d) => {
        const tokens = d.data().fcmTokens || [];
        if (tokens.length > 0) result[d.id] = tokens;
    });
    return result;
};

// 실제 발송 + 무효 토큰 정리
const sendToTokenMap = async (tokenMap, notification) => {
    const emailByToken = {};
    const allTokens = [];
    Object.entries(tokenMap).forEach(([email, tokens]) => {
        tokens.forEach((t) => { emailByToken[t] = email; allTokens.push(t); });
    });
    if (allTokens.length === 0) return { successCount: 0, failureCount: 0 };

    const chunks = [];
    for (let i = 0; i < allTokens.length; i += 500) chunks.push(allTokens.slice(i, i + 500));

    let successCount = 0;
    let failureCount = 0;
    const invalidByEmail = {};

    for (const chunk of chunks) {
        const res = await admin.messaging().sendEachForMulticast({
            tokens: chunk,
            notification,
            webpush: { fcmOptions: { link: 'https://elephant-logistics.web.app' } }
        });
        successCount += res.successCount;
        failureCount += res.failureCount;
        res.responses.forEach((r, idx) => {
            if (!r.success) {
                const badToken = chunk[idx];
                const email = emailByToken[badToken];
                if (!invalidByEmail[email]) invalidByEmail[email] = [];
                invalidByEmail[email].push(badToken);
            }
        });
    }

    await Promise.all(Object.entries(invalidByEmail).map(([email, tokens]) =>
        db.collection('users').doc(email).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens)
        }).catch(() => {})
    ));

    return { successCount, failureCount };
};

// 사람마다 다른 내용을 보낼 때 사용 (예: 각자 빠뜨린 서류 목록이 다름)
const sendPersonalizedMessages = async (items) => {
    // items: [{ email, title, body }]
    const messages = [];
    const emailByToken = {};

    await Promise.all(items.map(async (item) => {
        const doc = await db.collection('users').doc(item.email).get();
        const tokens = doc.exists ? (doc.data().fcmTokens || []) : [];
        tokens.forEach((t) => {
            emailByToken[t] = item.email;
            messages.push({
                token: t,
                notification: { title: item.title, body: item.body },
                webpush: { fcmOptions: { link: 'https://elephant-logistics.web.app' } }
            });
        });
    }));

    if (messages.length === 0) return { successCount: 0, failureCount: 0 };

    let successCount = 0;
    let failureCount = 0;
    const invalidByEmail = {};

    for (let i = 0; i < messages.length; i += 500) {
        const chunk = messages.slice(i, i + 500);
        const res = await admin.messaging().sendEach(chunk);
        successCount += res.successCount;
        failureCount += res.failureCount;
        res.responses.forEach((r, idx) => {
            if (!r.success) {
                const badToken = chunk[idx].token;
                const em = emailByToken[badToken];
                if (!invalidByEmail[em]) invalidByEmail[em] = [];
                invalidByEmail[em].push(badToken);
            }
        });
    }

    await Promise.all(Object.entries(invalidByEmail).map(([em, tokens]) =>
        db.collection('users').doc(em).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens)
        }).catch(() => {})
    ));

    return { successCount, failureCount };
};

// --- 관리자가 누르면, 서류 미제출자 각자에게 본인이 빠뜨린 서류 목록으로 알림 발송 ---
exports.sendDocumentReminders = onCall(async (request) => {
    const email = request.auth && request.auth.token && request.auth.token.email;
    if (!email || email !== ADMIN_EMAIL) {
        throw new HttpsError('permission-denied', '관리자만 발송할 수 있습니다.');
    }
    const { reminders } = request.data || {};
    if (!Array.isArray(reminders) || reminders.length === 0) {
        throw new HttpsError('invalid-argument', '알림을 보낼 대상이 없습니다.');
    }
    const items = reminders
        .filter((r) => r && r.email && Array.isArray(r.missingDocs) && r.missingDocs.length > 0)
        .map((r) => ({
            email: r.email,
            title: '서류 제출 안내',
            body: `${r.missingDocs.join(', ')} 제출이 필요해요. 빠른 시일 내에 제출 부탁드립니다.`
        }));
    return sendPersonalizedMessages(items);
});

// --- 관리자가 누르면 즉시 발송. emails를 지정하면 선택한 사람에게만, 안 하면 전체 가입자에게 ---
exports.sendImportantNotice = onCall(async (request) => {
    const email = request.auth && request.auth.token && request.auth.token.email;
    if (!email || email !== ADMIN_EMAIL) {
        throw new HttpsError('permission-denied', '관리자만 공지를 발송할 수 있습니다.');
    }
    const { title, body, emails } = request.data || {};
    if (!title || !body) throw new HttpsError('invalid-argument', '제목과 내용이 필요합니다.');

    const tokenMap = Array.isArray(emails) && emails.length > 0
        ? await getTokensByEmail(emails)
        : await getAllTokens();
    return sendToTokenMap(tokenMap, { title, body });
});

// --- 관리자가 퇴사 처리/재활성화할 때 호출: 구글(Firebase Auth) 계정을 실제로 비활성화/활성화 ---
exports.setAccountDisabled = onCall(async (request) => {
    const caller = request.auth && request.auth.token && request.auth.token.email;
    if (!caller || caller !== ADMIN_EMAIL) {
        throw new HttpsError('permission-denied', '관리자만 계정을 비활성화할 수 있습니다.');
    }
    const { email, disabled } = request.data || {};
    if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', '대상 이메일이 필요합니다.');
    if (email === ADMIN_EMAIL) throw new HttpsError('invalid-argument', '관리자 계정은 비활성화할 수 없습니다.');
    let target;
    try {
        target = await admin.auth().getUserByEmail(email);
    } catch (e) {
        if (e.code === 'auth/user-not-found') return { ok: true, found: false };
        throw new HttpsError('internal', e.message);
    }
    await admin.auth().updateUser(target.uid, { disabled: !!disabled });
    if (disabled) await admin.auth().revokeRefreshTokens(target.uid);
    return { ok: true, found: true };
});

// --- 접속·처리 기록(접속기록) 저장: 계정, 일시, 접속지(IP), 수행 업무 ---
// 서버(관리자 권한)에서만 기록하고 Firestore 규칙으로 클라이언트의 수정·삭제를 막아 위·변조를 방지합니다.
// 보관기간: 최소 3년 (접속기록 1~2년, 권한 변경 기록 3년 요건을 모두 충족). 자동 삭제하지 않습니다.
const AUDIT_ACTIONS = new Set([
    'login', 'page_view', 'doc_view', 'doc_upload', 'doc_delete',
    'contract_download', 'contract_send', 'contract_sign', 'contract_delete',
    'member_update', 'member_delete', 'permission_change', 'export',
    'pledge_sign', 'training_complete', 'privacy_record_save', 'record_delete',
]);
exports.logAccess = onCall(async (request) => {
    const email = request.auth && request.auth.token && request.auth.token.email;
    if (!email) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    const { action, detail, target } = request.data || {};
    if (!AUDIT_ACTIONS.has(action)) throw new HttpsError('invalid-argument', '허용되지 않는 기록 유형입니다.');
    const headers = (request.rawRequest && request.rawRequest.headers) || {};
    const ip = String(headers['x-forwarded-for'] || (request.rawRequest && request.rawRequest.ip) || '').split(',')[0].trim();
    await db.collection('accessLogs').add({
        email,
        role: email === ADMIN_EMAIL ? 'admin' : 'driver',
        action,
        detail: String(detail || '').slice(0, 200),
        target: String(target || '').slice(0, 100),
        ip,
        userAgent: String(headers['user-agent'] || '').slice(0, 160),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});

// --- 퇴사자 개인정보 자동 파기: 퇴사 처리 후 보유기간(12개월)이 지나면 매일 새벽 3시에 파기하고 파기 대장에 기록 ---
// 파기 대상: 회원정보(users), 비상연락망 항목, 서류 사본(문서 기록 + 저장소 사진), 차량 유지비 기록, 구글(Firebase) 로그인 계정
// 보존(파기하지 않음): 계약서·동의서·서약서·교육 이수 기록·접속기록·업무내역·안전보건 기록 — 법령·정산·증빙 목적의 별도 보존 대상
const RETENTION_MONTHS = 12;
const STORAGE_BUCKET = 'elephant-logistics.firebasestorage.app';

const deleteByEmail = async (collection, email) => {
    const snap = await db.collection(collection).where('email', '==', email).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    return snap.size;
};

exports.purgeExpiredPersonalData = onSchedule({ schedule: '0 3 * * *', timeZone: 'Asia/Seoul' }, async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    const snap = await db.collection('users').where('isActive', '==', false).get();
    for (const doc of snap.docs) {
        const u = doc.data();
        const resignedAt = u.resignedAt && u.resignedAt.toDate ? u.resignedAt.toDate() : null;
        if (!resignedAt || resignedAt > cutoff) continue;
        const email = doc.id;
        if (email === ADMIN_EMAIL) continue;
        try {
            const counts = {};
            counts.contacts = await deleteByEmail('contacts', email);
            counts.vehicleDocs = await deleteByEmail('vehicleDocs', email);
            counts.vehicleCosts = await deleteByEmail('vehicleCosts', email);
            try {
                await admin.storage().bucket(STORAGE_BUCKET).deleteFiles({ prefix: `vehicleDocs/${email}/` });
            } catch (se) { console.warn('저장소 파일 삭제 확인 필요', email, se.message); }
            let authDeleted = false;
            try {
                const au = await admin.auth().getUserByEmail(email);
                await admin.auth().deleteUser(au.uid);
                authDeleted = true;
            } catch (ae) { if (ae.code !== 'auth/user-not-found') console.warn('로그인 계정 삭제 확인 필요', email, ae.message); }
            await doc.ref.delete();
            await db.collection('destructionLogs').add({
                category: '퇴사자 계정·회원정보',
                subject: `${u.name || '이름 없음'} — 회원정보·비상연락망·서류 사본(${counts.vehicleDocs}건)·유지비 기록(${counts.vehicleCosts}건)·로그인 계정${authDeleted ? '' : '(없음)'}`,
                reason: '보유기간 경과',
                method: '전자파일 영구 삭제(복구 불가)',
                count: `서류 ${counts.vehicleDocs}건, 유지비 ${counts.vehicleCosts}건, 연락처 ${counts.contacts}건`,
                performer: '시스템(자동 파기)',
                createdBy: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('퇴사자 개인정보 파기 완료', email, counts);
        } catch (e) {
            console.error('퇴사자 개인정보 파기 실패', email, e);
        }
    }
});

// --- 10분마다 실행: 설정된 시각이 되면, 오늘 배차된 기사님께만 TBM 알림 발송 ---
exports.dailyTbmReminder = onSchedule({ schedule: 'every 10 minutes', timeZone: 'Asia/Seoul' }, async () => {
    const settingsRef = db.collection('settings').doc('notificationSettings');
    const settingsDoc = await settingsRef.get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    const tbmHour = typeof settings.tbmHour === 'number' ? settings.tbmHour : 21;
    const tbmMinute = typeof settings.tbmMinute === 'number' ? settings.tbmMinute : 0;

    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (settings.lastSentDate === todayStr) return; // 오늘 이미 발송함
    if (now.getHours() !== tbmHour) return;
    if (now.getMinutes() < tbmMinute || now.getMinutes() >= tbmMinute + 10) return; // 10분 창 안에서만 발송

    const scheduleSettingsDoc = await db.collection('settings').doc('schedule').get();
    const csvUrl = scheduleSettingsDoc.exists ? scheduleSettingsDoc.data().csvUrl : '';
    if (!csvUrl) { await settingsRef.set({ lastSentDate: todayStr }, { merge: true }); return; }

    const todayLabel = `${now.getMonth() + 1}월${now.getDate()}일`;

    try {
        const res = await fetch(csvUrl);
        const csvText = await res.text();
        const driverNames = parseTodaysDriverNames(csvText, todayLabel);
        const emails = await resolveEmailsByName(driverNames);
        const tokenMap = await getTokensByEmail(emails);
        await sendToTokenMap(tokenMap, {
            title: '오늘 TBM 체크해주세요',
            body: '배차 전 안전미팅(TBM) 체크와 오늘 전달사항을 남겨주세요.'
        });
    } catch (e) {
        console.error('TBM 알림 발송 실패', e);
    } finally {
        await settingsRef.set({ lastSentDate: todayStr }, { merge: true });
    }
});

// --- 새 가입자가 생기면(users 문서 생성) 관리자에게 즉시 알림 ---
exports.notifyAdminOnNewSignup = onDocumentCreated('users/{email}', async (event) => {
    const email = event.params.email;
    if (email === ADMIN_EMAIL) return; // 관리자 본인 가입은 알림 대상 아님

    const data = event.data.data() || {};
    const adminDoc = await db.collection('users').doc(ADMIN_EMAIL).get();
    const tokens = adminDoc.exists ? (adminDoc.data().fcmTokens || []) : [];
    if (tokens.length === 0) return;

    await sendToTokenMap({ [ADMIN_EMAIL]: tokens }, {
        title: '새로운 가입자가 있어요',
        body: `${data.name || email}님이 방금 가입했어요.`
    });
});

// --- 매주 월요일 오전 9시: 만료 임박 서류·계약 요약을 관리자에게 발송 ---
exports.weeklyComplianceDigest = onSchedule({ schedule: '0 9 * * 1', timeZone: 'Asia/Seoul' }, async () => {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    today.setHours(0, 0, 0, 0);

    // 서류 만료 임박 (30일 이내)
    const docsSnap = await db.collection('vehicleDocs').get();
    const expiringDocs = [];
    docsSnap.docs.forEach((d) => {
        const data = d.data();
        if (!data.expiryDate) return;
        const expiry = new Date(data.expiryDate);
        if (isNaN(expiry.getTime())) return;
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 30) {
            expiringDocs.push(`${data.name} ${data.docType}(D-${daysLeft})`);
        }
    });

    // 계약 만료 임박 (90일 이내, 위수탁계약서 기준)
    const contractsSnap = await db.collection('contracts').get();
    const expiringContracts = [];
    contractsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.templateType !== 'standard_consignment' || !data.variables || !data.variables.targetDate) return;
        const start = new Date(data.variables.targetDate);
        if (isNaN(start.getTime())) return;
        const expiry = new Date(start);
        expiry.setFullYear(expiry.getFullYear() + 1);
        const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 90) {
            expiringContracts.push(`${data.name}(D-${daysLeft})`);
        }
    });

    if (expiringDocs.length === 0 && expiringContracts.length === 0) return;

    const bodyParts = [];
    if (expiringDocs.length > 0) {
        bodyParts.push(`서류 만료 임박 ${expiringDocs.length}건: ${expiringDocs.slice(0, 5).join(', ')}${expiringDocs.length > 5 ? ' 외' : ''}`);
    }
    if (expiringContracts.length > 0) {
        bodyParts.push(`계약 만료 임박 ${expiringContracts.length}건: ${expiringContracts.slice(0, 5).join(', ')}${expiringContracts.length > 5 ? ' 외' : ''}`);
    }

    const adminDoc = await db.collection('users').doc(ADMIN_EMAIL).get();
    const tokens = adminDoc.exists ? (adminDoc.data().fcmTokens || []) : [];
    if (tokens.length === 0) return;

    await sendToTokenMap({ [ADMIN_EMAIL]: tokens }, {
        title: '이번 주 만료 임박 항목이 있어요',
        body: bodyParts.join(' / ')
    });
});
