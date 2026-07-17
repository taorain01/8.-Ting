(function () {
    'use strict';

    const api = window.electronAPI;
    if (!api?.isElectron) return;

    document.body.classList.add('is-electron');
    const bar = document.getElementById('ting-titlebar');
    if (bar) bar.hidden = false;

    const btnMin = document.getElementById('ttb-min');
    const btnMax = document.getElementById('ttb-max');
    const btnClose = document.getElementById('ttb-close');
    const icoMax = btnMax?.querySelector('.ttb-ico-max');
    const icoRestore = btnMax?.querySelector('.ttb-ico-restore');

    function setMaximized(isMaximized) {
        if (!icoMax || !icoRestore) return;
        icoMax.hidden = isMaximized;
        icoRestore.hidden = !isMaximized;
        if (btnMax) btnMax.title = isMaximized ? 'Khôi phục' : 'Phóng to';
    }

    btnMin?.addEventListener('click', () => api.minimizeWindow());
    btnMax?.addEventListener('click', () => api.toggleMaximizeWindow());
    btnClose?.addEventListener('click', () => api.closeWindow());
    api.onMaximizeChanged?.(setMaximized);
    api.isWindowMaximized?.().then(setMaximized).catch(() => {});
})();
