// Load optional libraries only when the corresponding feature is used.
const pending = new Map();

export function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve();
    if (!pending.has(src)) {
        pending.set(src, new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                if (window[globalName]) resolve();
                else { pending.delete(src); script.remove(); reject(new Error(`Unable to load ${globalName}`)); }
            };
            script.onerror = () => {
                pending.delete(src);
                script.remove();
                reject(new Error(`Unable to load ${globalName}`));
            };
            document.head.appendChild(script);
        }));
    }
    return pending.get(src);
}

export function loadCharts() {
    return loadScript('https://cdn.jsdelivr.net/npm/chart.js', 'Chart');
}
