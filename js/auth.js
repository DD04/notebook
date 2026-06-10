// js/auth.js - Gateway Authentication UI Controller
import * as storage from './storage.js';
import { getText } from './i18n.js';

let authSuccessCallback = null;

// DOM Elements from Gateway Authentication Panel
const gatewayOverlay = document.getElementById('gatewayOverlay');
const gatewayTitle = document.getElementById('gatewayTitle');
const gatewaySubtitle = document.getElementById('gatewaySubtitle');

const gatewayAuthForm = document.getElementById('gatewayAuthForm');
const gatewayDbForm = document.getElementById('gatewayDbForm');

const gwNicknameGroup = document.getElementById('gwNicknameGroup');
const gwNickname = document.getElementById('gwNickname');
const gwEmailGroup = document.getElementById('gwEmailGroup');
const gwEmail = document.getElementById('gwEmail');
const gwUsername = document.getElementById('gwUsername');
const gwPassword = document.getElementById('gwPassword');
const gatewayAuthError = document.getElementById('gatewayAuthError');
const gatewayAuthSubmitBtn = document.getElementById('gatewayAuthSubmitBtn');

const gwAuthToggleQuestion = document.getElementById('gwAuthToggleQuestion');
const gwAuthToggleBtn = document.getElementById('gwAuthToggleBtn');
const gwForgotPasswordBtn = document.getElementById('gwForgotPasswordBtn');

// Forgot Password Panel Elements
const gatewayForgotForm = document.getElementById('gatewayForgotForm');
const gwForgotInput = document.getElementById('gwForgotInput');
const gatewayForgotError = document.getElementById('gatewayForgotError');
const gatewayForgotSuccess = document.getElementById('gatewayForgotSuccess');
const gatewayForgotSubmitBtn = document.getElementById('gatewayForgotSubmitBtn');
const gwForgotBackToLoginBtn = document.getElementById('gwForgotBackToLoginBtn');

// Reset Password Panel Elements
const gatewayResetForm = document.getElementById('gatewayResetForm');
const gwNewPassword = document.getElementById('gwNewPassword');
const gwConfirmNewPassword = document.getElementById('gwConfirmNewPassword');
const gatewayResetError = document.getElementById('gatewayResetError');
const gatewayResetSuccess = document.getElementById('gatewayResetSuccess');
const gatewayResetSubmitBtn = document.getElementById('gatewayResetSubmitBtn');

let isSignUpMode = false;

export function initAuth(onAuthSuccess) {
    authSuccessCallback = onAuthSuccess;
    
    if (gwAuthToggleBtn) {
        gwAuthToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMode();
        });
    }
    
    if (gatewayAuthForm) {
        gatewayAuthForm.addEventListener('submit', handleAuthSubmit);
    }

    if (gwForgotPasswordBtn) {
        gwForgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPanel();
        });
    }

    if (gwForgotBackToLoginBtn) {
        gwForgotBackToLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthPanel();
        });
    }

    if (gatewayForgotForm) {
        gatewayForgotForm.addEventListener('submit', handleForgotSubmit);
    }

    if (gatewayResetForm) {
        gatewayResetForm.addEventListener('submit', handleResetSubmit);
    }
}

export function showAuthPanel() {
    isSignUpMode = false;
    updateAuthPanelUI();
    
    if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
    if (gatewayForgotForm) gatewayForgotForm.classList.add('d-none');
    if (gatewayResetForm) gatewayResetForm.classList.add('d-none');
    if (gatewayAuthForm) gatewayAuthForm.classList.remove('d-none');
    if (gatewayOverlay) gatewayOverlay.classList.add('active');
}

export function showForgotPanel() {
    if (gatewayAuthForm) gatewayAuthForm.classList.add('d-none');
    if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
    if (gatewayResetForm) gatewayResetForm.classList.add('d-none');
    
    if (gatewayForgotForm) {
        gatewayForgotForm.classList.remove('d-none');
        if (gwForgotInput) gwForgotInput.value = '';
        if (gatewayForgotError) gatewayForgotError.classList.add('d-none');
        if (gatewayForgotSuccess) gatewayForgotSuccess.classList.add('d-none');
    }
    
    if (gatewayTitle) gatewayTitle.textContent = "忘記密碼";
    if (gatewaySubtitle) gatewaySubtitle.textContent = "重設您的帳戶密碼";
    if (gatewayOverlay) gatewayOverlay.classList.add('active');
}

export function showResetPanel() {
    if (gatewayAuthForm) gatewayAuthForm.classList.add('d-none');
    if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
    if (gatewayForgotForm) gatewayForgotForm.classList.add('d-none');
    
    if (gatewayResetForm) {
        gatewayResetForm.classList.remove('d-none');
        if (gwNewPassword) gwNewPassword.value = '';
        if (gwConfirmNewPassword) gwConfirmNewPassword.value = '';
        if (gatewayResetError) gatewayResetError.classList.add('d-none');
        if (gatewayResetSuccess) gatewayResetSuccess.classList.add('d-none');
    }
    
    if (gatewayTitle) gatewayTitle.textContent = "重設新密碼";
    if (gatewaySubtitle) gatewaySubtitle.textContent = "請輸入您要設定的新密碼";
    if (gatewayOverlay) gatewayOverlay.classList.add('active');
}

export function hideAuthPanel() {
    if (gatewayOverlay) gatewayOverlay.classList.remove('active');
}

function toggleMode() {
    isSignUpMode = !isSignUpMode;
    updateAuthPanelUI();
}

function updateAuthPanelUI() {
    if (!gatewayTitle) return;
    
    if (isSignUpMode) {
        gatewayTitle.textContent = getText('gw_auth_signup');
        gatewaySubtitle.textContent = getText('gw_auth_signup_desc');
        if (gwNicknameGroup) gwNicknameGroup.classList.remove('d-none');
        if (gwNickname) gwNickname.required = true;
        if (gwEmailGroup) gwEmailGroup.classList.remove('d-none');
        if (gwEmail) gwEmail.required = true;
        if (gatewayAuthSubmitBtn) gatewayAuthSubmitBtn.textContent = getText('gw_btn_signup');
        if (gwAuthToggleQuestion) gwAuthToggleQuestion.textContent = getText('gw_switch_to_signin').split('？')[0] + '？';
        if (gwAuthToggleBtn) gwAuthToggleBtn.textContent = getText('gw_btn_signin');
    } else {
        gatewayTitle.textContent = getText('gw_auth_signin');
        gatewaySubtitle.textContent = getText('gw_auth_signin_desc');
        if (gwNicknameGroup) gwNicknameGroup.classList.add('d-none');
        if (gwNickname) {
            gwNickname.required = false;
            gwNickname.value = '';
        }
        if (gwEmailGroup) gwEmailGroup.classList.add('d-none');
        if (gwEmail) {
            gwEmail.required = false;
            gwEmail.value = '';
        }
        if (gatewayAuthSubmitBtn) gatewayAuthSubmitBtn.textContent = getText('gw_btn_signin');
        if (gwAuthToggleQuestion) gwAuthToggleQuestion.textContent = getText('gw_switch_to_signup').split('？')[0] + '？';
        if (gwAuthToggleBtn) gwAuthToggleBtn.textContent = getText('gw_btn_signup');
    }
    if (gatewayAuthError) gatewayAuthError.classList.add('d-none');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (gatewayAuthError) gatewayAuthError.classList.add('d-none');
    
    const username = gwUsername.value.trim();
    const password = gwPassword.value;
    const nickname = gwNickname ? gwNickname.value.trim() : '';
    const email = gwEmail ? gwEmail.value.trim() : '';
    
    if (gatewayAuthSubmitBtn) {
        gatewayAuthSubmitBtn.disabled = true;
        gatewayAuthSubmitBtn.textContent = isSignUpMode ? getText('gw_btn_signup') + '...' : getText('gw_btn_signin') + '...';
    }
    
    try {
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            throw new Error("帳號只能包含英文、數字與下劃線。");
        }

        let user;
        if (isSignUpMode) {
            if (!email) {
                throw new Error("真實備用信箱為必填項目。");
            }
            user = await storage.signUp(email, password, nickname, username);
        } else {
            user = await storage.signIn(username, password);
        }
        
        hideAuthPanel();
        if (authSuccessCallback) {
            authSuccessCallback(user);
        }
    } catch (err) {
        console.error("Auth error:", err);
        if (gatewayAuthError) {
            gatewayAuthError.textContent = err.message || "Authentication failed.";
            gatewayAuthError.classList.remove('d-none');
        }
    } finally {
        if (gatewayAuthSubmitBtn) {
            gatewayAuthSubmitBtn.disabled = false;
            gatewayAuthSubmitBtn.textContent = isSignUpMode ? getText('gw_btn_signup') : getText('gw_btn_signin');
        }
    }
}

async function handleForgotSubmit(e) {
    e.preventDefault();
    if (gatewayForgotError) gatewayForgotError.classList.add('d-none');
    if (gatewayForgotSuccess) gatewayForgotSuccess.classList.add('d-none');
    
    const input = gwForgotInput.value.trim();
    if (!input) return;
    
    if (gatewayForgotSubmitBtn) {
        gatewayForgotSubmitBtn.disabled = true;
        gatewayForgotSubmitBtn.textContent = "傳送中...";
    }
    
    try {
        await storage.sendPasswordResetEmail(input);
        if (gatewayForgotSuccess) {
            gatewayForgotSuccess.textContent = "重設信件已寄出，請至您的真實信箱收信。";
            gatewayForgotSuccess.classList.remove('d-none');
        }
    } catch (err) {
        console.error("Forgot password error:", err);
        if (gatewayForgotError) {
            gatewayForgotError.textContent = err.message || "發送失敗，請確認輸入的資料是否正確。";
            gatewayForgotError.classList.remove('d-none');
        }
    } finally {
        if (gatewayForgotSubmitBtn) {
            gatewayForgotSubmitBtn.disabled = false;
            gatewayForgotSubmitBtn.textContent = "傳送重設信件";
        }
    }
}

async function handleResetSubmit(e) {
    e.preventDefault();
    if (gatewayResetError) gatewayResetError.classList.add('d-none');
    if (gatewayResetSuccess) gatewayResetSuccess.classList.add('d-none');
    
    const newPwd = gwNewPassword.value;
    const confirmPwd = gwConfirmNewPassword.value;
    
    if (newPwd !== confirmPwd) {
        if (gatewayResetError) {
            gatewayResetError.textContent = "兩次輸入的密碼不一致。";
            gatewayResetError.classList.remove('d-none');
        }
        return;
    }
    
    if (gatewayResetSubmitBtn) {
        gatewayResetSubmitBtn.disabled = true;
        gatewayResetSubmitBtn.textContent = "更新中...";
    }
    
    try {
        await storage.updatePassword(newPwd);
        if (gatewayResetSuccess) {
            gatewayResetSuccess.textContent = "密碼重設成功！3秒後將自動為您登入...";
            gatewayResetSuccess.classList.remove('d-none');
        }
        
        setTimeout(async () => {
            hideAuthPanel();
            const user = await storage.getCurrentUser();
            if (authSuccessCallback && user) {
                authSuccessCallback(user);
            }
        }, 3000);
    } catch (err) {
        console.error("Reset password error:", err);
        if (gatewayResetError) {
            gatewayResetError.textContent = err.message || "密碼更新失敗，重設連結可能已過期。";
            gatewayResetError.classList.remove('d-none');
        }
    } finally {
        if (gatewayResetSubmitBtn) {
            gatewayResetSubmitBtn.disabled = false;
            gatewayResetSubmitBtn.textContent = "更新密碼";
        }
    }
}
