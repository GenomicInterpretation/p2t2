
(() => {
    var isChrome = !!window.chrome && !!window.chrome.webstore;
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    var isFirefox = typeof InstallTrigger !== 'undefined';
    if (isChrome || isSafari || isFirefox) {
        $('#checkBrowserTypeResult').html('');
    }
    else {
        $('#checkBrowserTypeResult').html('<small>*This visualization was optimized for Chrome, Firefox, or Safari.<br>*Using these browsers for more reliable performance.</small>');
    }
})();
$(function () {
    $('[data-toggle="tooltip"]').tooltip()
})
