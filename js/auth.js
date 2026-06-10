// js/auth.js - Gateway Authentication UI Controller
import * as storage from './storage.js';

let authSuccessCallback = null;

// DOM Elements from Gateway Authentication Panel
const gatewayOverlay = document.getElementById('gatewayOverlay');
const gatewayTitle = document.getElementById('gatewayTitle');
const gatewaySubtitle = document.getElementById('gatewaySubtitle');

const gatewayAuthForm = document.getElementById('gatewayAuthForm');
const gatewayDbForm = document.getElementById('gatewayDbForm');

const gwNicknameGroup = document.getElementById('gwNicknameGroup');
const gwNickname = document.getElementById('gwNickname');
const gwEmail = document.getElementById('gwEmail');
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
        gatewayTitle.textContent = 'Create Account';
        gatewaySubtitle.textContent = 'Sign up for a cloud account to sync your ledger.';
        if (gwNicknameGroup) gwNicknameGroup.classList.remove('d-none');
        if (gwNickname) gwNickname.required = true;
        if (gatewayAuthSubmitBtn) gatewayAuthSubmitBtn.textContent = 'Sign Up';
        if (gwAuthToggleQuestion) gwAuthToggleQuestion.textContent = 'Already have an account?';
        if (gwAuthToggleBtn) gwAuthToggleBtn.textContent = 'Sign In';
    } else {
        gatewayTitle.textContent = 'Sign In';
        gatewaySubtitle.textContent = 'Please sign in to sync your ledger.';
        if (gwNicknameGroup) gwNicknameGroup.classList.add('d-none');
        if (gwNickname) {
            gwNickname.required = false;
            gwNickname.value = '';
        }
        if (gatewayAuthSubmitBtn) gatewayAuthSubmitBtn.textContent = 'Sign In';
        if (gwAuthToggleQuestion) gwAuthToggleQuestion.textContent = "Don't have an account?";
        if (gwAuthToggleBtn) gwAuthToggleBtn.textContent = 'Sign Up';
    }
    if (gatewayAuthError) gatewayAuthError.classList.add('d-none');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (gatewayAuthError) gatewayAuthError.classList.add('d-none');
    
    const email = gwEmail.value.trim();
    const password = gwPassword.value;
    const nickname = gwNickname ? gwNickname.value.trim() : '';
    
    if (gatewayAuthSubmitBtn) {
        gatewayAuthSubmitBtn.disabled = true;
        gatewayAuthSubmitBtn.textContent = isSignUpMode ? 'Signing Up...' : 'Signing In...';
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
            gatewayAuthSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
    }
}
