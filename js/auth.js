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
const gwUsername = document.getElementById('gwUsername');
const gwPassword = document.getElementById('gwPassword');
const gatewayAuthError = document.getElementById('gatewayAuthError');
const gatewayAuthSubmitBtn = document.getElementById('gatewayAuthSubmitBtn');

const gwAuthToggleQuestion = document.getElementById('gwAuthToggleQuestion');
const gwAuthToggleBtn = document.getElementById('gwAuthToggleBtn');

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
}

export function showAuthPanel() {
    isSignUpMode = false;
    updateAuthPanelUI();
    
    if (gatewayDbForm) gatewayDbForm.classList.add('d-none');
    if (gatewayAuthForm) gatewayAuthForm.classList.remove('d-none');
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
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error("帳號只能包含英文、數字與下劃線。");
    }
    const email = `${username}@notebook.local`;
    const password = gwPassword.value;
    const nickname = gwNickname ? gwNickname.value.trim() : '';
    
    if (gatewayAuthSubmitBtn) {
        gatewayAuthSubmitBtn.disabled = true;
        gatewayAuthSubmitBtn.textContent = isSignUpMode ? getText('gw_btn_signup') + '...' : getText('gw_btn_signin') + '...';
    }
    
    try {
        let user;
        if (isSignUpMode) {
            user = await storage.signUp(email, password, nickname);
        } else {
            user = await storage.signIn(email, password);
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
