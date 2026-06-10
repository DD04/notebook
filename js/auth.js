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
const gwRecoveryQuestionGroup = document.getElementById('gwRecoveryQuestionGroup');
const gwRecoveryQuestion = document.getElementById('gwRecoveryQuestion');
const gwRecoveryAnswerGroup = document.getElementById('gwRecoveryAnswerGroup');
const gwRecoveryAnswer = document.getElementById('gwRecoveryAnswer');
const gwUsername = document.getElementById('gwUsername');
const gwPassword = document.getElementById('gwPassword');
const gatewayAuthError = document.getElementById('gatewayAuthError');
const gatewayAuthSubmitBtn = document.getElementById('gatewayAuthSubmitBtn');

const gwAuthToggleQuestion = document.getElementById('gwAuthToggleQuestion');
const gwAuthToggleBtn = document.getElementById('gwAuthToggleBtn');
const gwForgotPasswordBtn = document.getElementById('gwForgotPasswordBtn');

// Forgot Password Panel (密保兩階段重設)
const gatewayForgotForm = document.getElementById('gatewayForgotForm');
const gwForgotDesc = document.getElementById('gwForgotDesc');
const gwForgotStep1Group = document.getElementById('gwForgotStep1Group');
const gwForgotUsername = document.getElementById('gwForgotUsername');
const gwForgotNextBtn = document.getElementById('gwForgotNextBtn');

const gwForgotStep2Group = document.getElementById('gwForgotStep2Group');
const gwForgotQuestionText = document.getElementById('gwForgotQuestionText');
const gwForgotAnswer = document.getElementById('gwForgotAnswer');
const gwForgotNewPassword = document.getElementById('gwForgotNewPassword');
const gwForgotConfirmPassword = document.getElementById('gwForgotConfirmPassword');
const gwForgotSubmitBtn = document.getElementById('gwForgotSubmitBtn');

const gatewayForgotError = document.getElementById('gatewayForgotError');
const gatewayForgotSuccess = document.getElementById('gatewayForgotSuccess');
const gwForgotBackToLoginBtn = document.getElementById('gwForgotBackToLoginBtn');

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

    if (gwForgotNextBtn) {
        gwForgotNextBtn.addEventListener('click', handleForgotNext);
    }

    if (gatewayForgotForm) {
        gatewayForgotForm.addEventListener('submit', handleForgotSubmit);
    }
}

export function showAuthPanel() {
    isSignUpMode = false;
    updateAuthPanelUI();
    
    if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
    if (gatewayForgotForm) gatewayForgotForm.classList.add('d-none');
    if (gatewayAuthForm) gatewayAuthForm.classList.remove('d-none');
    if (gatewayOverlay) gatewayOverlay.classList.add('active');
}

export function showForgotPanel() {
    if (gatewayAuthForm) gatewayAuthForm.classList.add('d-none');
    if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
    
    if (gatewayForgotForm) {
        gatewayForgotForm.classList.remove('d-none');
        
        // Reset to Step 1
        if (gwForgotStep1Group) gwForgotStep1Group.classList.remove('d-none');
        if (gwForgotStep2Group) gwForgotStep2Group.classList.add('d-none');
        if (gwForgotDesc) gwForgotDesc.textContent = "請輸入您的帳號以查詢密保問題。";
        
        if (gwForgotUsername) gwForgotUsername.value = '';
        if (gwForgotAnswer) gwForgotAnswer.value = '';
        if (gwForgotNewPassword) gwForgotNewPassword.value = '';
        if (gwForgotConfirmPassword) gwForgotConfirmPassword.value = '';
        
        if (gatewayForgotError) gatewayForgotError.classList.add('d-none');
        if (gatewayForgotSuccess) gatewayForgotSuccess.classList.add('d-none');
    }
    
    if (gatewayTitle) gatewayTitle.textContent = "忘記密碼";
    if (gatewaySubtitle) gatewaySubtitle.textContent = "回答密保問題以重設您的密碼";
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
        if (gwRecoveryQuestionGroup) gwRecoveryQuestionGroup.classList.remove('d-none');
        if (gwRecoveryAnswerGroup) gwRecoveryAnswerGroup.classList.remove('d-none');
        if (gwRecoveryAnswer) gwRecoveryAnswer.required = true;
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
        if (gwRecoveryQuestionGroup) gwRecoveryQuestionGroup.classList.add('d-none');
        if (gwRecoveryAnswerGroup) gwRecoveryAnswerGroup.classList.add('d-none');
        if (gwRecoveryAnswer) {
            gwRecoveryAnswer.required = false;
            gwRecoveryAnswer.value = '';
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
    const question = gwRecoveryQuestion ? gwRecoveryQuestion.value : '';
    const answer = gwRecoveryAnswer ? gwRecoveryAnswer.value.trim() : '';
    
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
            if (!question || !answer) {
                throw new Error("密保問題與答案為必填項目。");
            }
            user = await storage.signUp(username, password, nickname, question, answer);
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

// 忘記密碼 - 第一階段：查詢密保問題
async function handleForgotNext(e) {
    e.preventDefault();
    if (gatewayForgotError) gatewayForgotError.classList.add('d-none');
    if (gatewayForgotSuccess) gatewayForgotSuccess.classList.add('d-none');

    const username = gwForgotUsername.value.trim();
    if (!username) {
        if (gatewayForgotError) {
            gatewayForgotError.textContent = "請輸入帳號。";
            gatewayForgotError.classList.remove('d-none');
        }
        return;
    }

    if (gwForgotNextBtn) {
        gwForgotNextBtn.disabled = true;
        gwForgotNextBtn.textContent = "查詢中...";
    }

    try {
        const question = await storage.getUserQuestion(username);
        if (!question) {
            throw new Error("該帳號不存在，或未設定密保問題。");
        }

        // Show Step 2
        if (gwForgotQuestionText) gwForgotQuestionText.textContent = question;
        if (gwForgotStep1Group) gwForgotStep1Group.classList.add('d-none');
        if (gwForgotStep2Group) gwForgotStep2Group.classList.remove('d-none');
        if (gwForgotDesc) gwForgotDesc.textContent = "請回答密保問題並設定新密碼。";
        
        // Ensure inputs are required in Step 2
        if (gwForgotAnswer) gwForgotAnswer.required = true;
        if (gwForgotNewPassword) gwForgotNewPassword.required = true;
        if (gwForgotConfirmPassword) gwForgotConfirmPassword.required = true;
    } catch (err) {
        console.error("Query question error:", err);
        if (gatewayForgotError) {
            gatewayForgotError.textContent = err.message || "查詢失敗，請重試。";
            gatewayForgotError.classList.remove('d-none');
        }
    } finally {
        if (gwForgotNextBtn) {
            gwForgotNextBtn.disabled = false;
            gwForgotNextBtn.textContent = "下一步：查詢密保問題";
        }
    }
}

// 忘記密碼 - 第二階段：提交重設
async function handleForgotSubmit(e) {
    e.preventDefault();
    if (gatewayForgotError) gatewayForgotError.classList.add('d-none');
    if (gatewayForgotSuccess) gatewayForgotSuccess.classList.add('d-none');

    const username = gwForgotUsername.value.trim();
    const answer = gwForgotAnswer.value.trim();
    const newPassword = gwForgotNewPassword.value;
    const confirmPassword = gwForgotConfirmPassword.value;

    if (!answer || !newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
        if (gatewayForgotError) {
            gatewayForgotError.textContent = "兩次輸入的新密碼不一致。";
            gatewayForgotError.classList.remove('d-none');
        }
        return;
    }

    if (newPassword.length < 6) {
        if (gatewayForgotError) {
            gatewayForgotError.textContent = "新密碼長度至少需為 6 個字元。";
            gatewayForgotError.classList.remove('d-none');
        }
        return;
    }

    if (gwForgotSubmitBtn) {
        gwForgotSubmitBtn.disabled = true;
        gwForgotSubmitBtn.textContent = "重設中...";
    }

    try {
        await storage.resetPasswordByQuestion(username, answer, newPassword);
        
        if (gatewayForgotSuccess) {
            gatewayForgotSuccess.textContent = "密碼重設成功！3秒後將自動為您登入...";
            gatewayForgotSuccess.classList.remove('d-none');
        }

        // Auto login after 3 seconds
        setTimeout(async () => {
            try {
                const user = await storage.signIn(username, newPassword);
                hideAuthPanel();
                if (authSuccessCallback) {
                    authSuccessCallback(user);
                }
            } catch (loginErr) {
                console.error("Auto login failed after reset:", loginErr);
                showAuthPanel(); // Back to login screen
            }
        }, 3000);
    } catch (err) {
        console.error("Reset password error:", err);
        if (gatewayForgotError) {
            gatewayForgotError.textContent = err.message || "密碼重設失敗，請檢查答案是否正確。";
            gatewayForgotError.classList.remove('d-none');
        }
    } finally {
        if (gwForgotSubmitBtn) {
            gwForgotSubmitBtn.disabled = false;
            gwForgotSubmitBtn.textContent = "重設密碼";
        }
    }
}
