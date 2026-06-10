// js/auth.js - Authentication UI and Session Controller
import * as storage from './storage.js';

let authSuccessCallback = null;

// DOM Elements
const authModal = document.getElementById('authModal');
const authModalTitle = document.getElementById('authModalTitle');
const authForm = document.getElementById('authForm');
const authNicknameGroup = document.getElementById('authNicknameGroup');
const authNickname = document.getElementById('authNickname');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authErrorMessage = document.getElementById('authErrorMessage');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authToggleQuestion = document.getElementById('authToggleQuestion');
const authToggleBtn = document.getElementById('authToggleBtn');
const authModalClose = document.getElementById('authModalClose');

let isSignUpMode = false; // Toggle between Login and Registration

export function initAuth(onAuthSuccess) {
    authSuccessCallback = onAuthSuccess;
    
    // Register event listeners
    authToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMode();
    });
    
    authForm.addEventListener('submit', handleAuthSubmit);
    
    authModalClose.addEventListener('click', hideAuthModal);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) hideAuthModal();
    });
}

export function showAuthModal() {
    isSignUpMode = false;
    updateModalUI();
    authErrorMessage.classList.add('d-none');
    authForm.reset();
    authModal.classList.add('active');
}

export function hideAuthModal() {
    authModal.classList.remove('active');
}

function toggleMode() {
    isSignUpMode = !isSignUpMode;
    updateModalUI();
}

function updateModalUI() {
    if (isSignUpMode) {
        authModalTitle.textContent = 'Create Account';
        authNicknameGroup.classList.remove('d-none');
        authNickname.required = true;
        authSubmitBtn.textContent = 'Sign Up';
        authToggleQuestion.textContent = 'Already have an account?';
        authToggleBtn.textContent = 'Sign In';
    } else {
        authModalTitle.textContent = 'Sign In';
        authNicknameGroup.classList.add('d-none');
        authNickname.required = false;
        authSubmitBtn.textContent = 'Sign In';
        authToggleQuestion.textContent = "Don't have an account?";
        authToggleBtn.textContent = 'Sign Up';
    }
    authErrorMessage.classList.add('d-none');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    authErrorMessage.classList.add('d-none');
    
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const nickname = authNickname.value.trim();
    
    authSubmitBtn.disabled = true;
    const originalBtnText = authSubmitBtn.textContent;
    authSubmitBtn.textContent = isSignUpMode ? 'Signing Up...' : 'Signing In...';
    
    try {
        let user;
        if (isSignUpMode) {
            user = await storage.signUp(email, password, nickname);
        } else {
            user = await storage.signIn(email, password);
        }
        
        hideAuthModal();
        if (authSuccessCallback) {
            authSuccessCallback(user);
        }
    } catch (err) {
        console.error("Auth error:", err);
        authErrorMessage.textContent = err.message || "Authentication failed.";
        authErrorMessage.classList.remove('d-none');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = originalBtnText;
    }
}
