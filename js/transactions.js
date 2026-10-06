export function sortTransactions(records) {
    return records.sort((a, b) =>
        (b.date || '').localeCompare(a.date || '') ||
        (b.created_at || '').localeCompare(a.created_at || '')
    );
}

export function setFormSaving(form, button, saving) {
    form.setAttribute('aria-busy', String(saving));
    form.querySelectorAll('button[type="submit"]').forEach(el => { el.disabled = saving; });
    button.disabled = saving;
}
