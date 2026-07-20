// public/footer.js

'use strict';

window.addEventListener('DOMContentLoaded', () => {
    const footer = document.createElement('footer');
    const currentYear = new Date().getFullYear();

    footer.className = 'site-footer';

    footer.innerHTML = `
        <div class="site-footer__inner">
            <div class="site-footer__brand">
                <img
                    src="/logo2.png?v=8"
                    alt=""
                    height="30"
                >
                <span>FancyAlt</span>
            </div>

            <span class="site-footer__copyright">
                &copy; ${currentYear}
                <a href="/" class="site-footer__copyright-link">
                    FancyAlt
                </a>.
                All rights reserved.
            </span>
        </div>
    `;

    document.body.appendChild(footer);
});