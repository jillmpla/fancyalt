// public/js/app.js

'use strict';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

const MODE_HELP = {
    concise: 'Short alt text for everyday use.',
    detailed: 'A fuller description with more visual detail.',
    social: 'A natural description for social media.',
    story: 'A short creative story inspired by the image.',
    moderateOnly:
        'Checks image safety without creating a description.',
};

const MODE_RESULT_CONFIG = {
    concise: {
        title: 'Alt text',
        icon: 'fa-solid fa-universal-access',
        primary: true,
    },

    detailed: {
        title: 'Detailed description',
        icon: 'fa-regular fa-eye',
        primary: true,
    },

    social: {
        title: 'Social media description',
        icon: 'fa-solid fa-share-nodes',
        primary: true,
    },

    story: {
        title: 'Creative story',
        icon: 'fa-solid fa-book-open',
        primary: true,
    },
};

const elements = {};

let activeSource = 'upload';
let selectedFile = null;
let previewObjectUrl = null;
let jsonEditor = null;
let latestResult = null;
let toastTimer = null;

window.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    cacheElements();
    initializeTheme();
    initializeSourceTabs();
    initializeUploadArea();
    initializeFormControls();
    initializeResultsControls();
    updateModeInterface();
}

function cacheElements() {
    elements.themeToggle =
        document.getElementById('themeToggle');

    elements.themeIcon =
        document.getElementById('themeIcon');

    elements.themeLabel =
        document.getElementById('themeLabel');

    elements.sourceTabs =
        Array.from(
            document.querySelectorAll('.source-tab')
        );

    elements.uploadPanel =
        document.getElementById('uploadPanel');

    elements.urlPanel =
        document.getElementById('urlPanel');

    elements.analysisForm =
        document.getElementById('analysisForm');

    elements.uploadZone =
        document.getElementById('uploadZone');

    elements.imageInput =
        document.getElementById('imageInput');

    elements.imagePreview =
        document.getElementById('imagePreview');

    elements.previewImage =
        document.getElementById('previewImage');

    elements.previewName =
        document.getElementById('previewName');

    elements.previewSize =
        document.getElementById('previewSize');

    elements.removeImageButton =
        document.getElementById('removeImageButton');

    elements.imageUrl =
        document.getElementById('imageUrl');

    elements.mode =
        document.getElementById('mode');

    elements.modeHelp =
        document.getElementById('modeHelp');

    elements.maxLength =
        document.getElementById('maxLength');

    elements.lengthField =
        document.getElementById('lengthField');

    elements.includeVisibleText =
        document.getElementById('includeVisibleText');

    elements.visibleTextField =
        document.getElementById('visibleTextField');

    elements.formAlert =
        document.getElementById('formAlert');

    elements.analyzeButton =
        document.getElementById('analyzeButton');

    elements.resultsSection =
        document.getElementById('resultsSection');

    elements.humanResults =
        document.getElementById('humanResults');

    elements.safetyBanner =
        document.getElementById('safetyBanner');

    elements.jsonTree =
        document.getElementById('jsonTree');

    elements.newAnalysisButton =
        document.getElementById('newAnalysisButton');

    elements.toastMessage =
        document.getElementById('toastMessage');
}

function initializeTheme() {
    const savedTheme =
        localStorage.getItem('fancyalt-theme');

    const prefersDark =
        window.matchMedia?.(
            '(prefers-color-scheme: dark)'
        ).matches;

    applyTheme(
        savedTheme === 'dark' ||
        (!savedTheme && prefersDark)
    );

    elements.themeToggle.addEventListener(
        'click',
        () => {
            const useDark =
                !document.body.classList.contains(
                    'dark-mode'
                );

            applyTheme(useDark);

            localStorage.setItem(
                'fancyalt-theme',
                useDark ? 'dark' : 'light'
            );

            renderJson(latestResult);
        }
    );
}

function applyTheme(useDarkTheme) {
    document.body.classList.toggle(
        'dark-mode',
        useDarkTheme
    );

    elements.themeToggle.setAttribute(
        'aria-pressed',
        String(useDarkTheme)
    );

    elements.themeToggle.setAttribute(
        'aria-label',
        useDarkTheme
            ? 'Switch to light theme'
            : 'Switch to dark theme'
    );

    elements.themeIcon.className =
        useDarkTheme
            ? 'fa-solid fa-sun'
            : 'fa-solid fa-moon';

    elements.themeLabel.textContent =
        useDarkTheme ? 'Light' : 'Dark';
}

function initializeSourceTabs() {
    for (const tab of elements.sourceTabs) {
        tab.addEventListener(
            'click',
            () => activateSourceTab(
                tab.dataset.panel
            )
        );

        tab.addEventListener(
            'keydown',
            handleTabKeyboardNavigation
        );
    }
}

function activateSourceTab(panelId) {
    activeSource =
        panelId === 'urlPanel'
            ? 'url'
            : 'upload';

    for (const tab of elements.sourceTabs) {
        const isActive =
            tab.dataset.panel === panelId;

        tab.classList.toggle(
            'active',
            isActive
        );

        tab.setAttribute(
            'aria-selected',
            String(isActive)
        );

        tab.tabIndex =
            isActive ? 0 : -1;
    }

    elements.uploadPanel.hidden =
        activeSource !== 'upload';

    elements.urlPanel.hidden =
        activeSource !== 'url';

    clearFormAlert();

    if (activeSource === 'upload') {
        elements.uploadZone.focus();
    } else {
        elements.imageUrl.focus();
    }
}

function handleTabKeyboardNavigation(event) {
    if (
        event.key !== 'ArrowLeft' &&
        event.key !== 'ArrowRight'
    ) {
        return;
    }

    event.preventDefault();

    const currentIndex =
        elements.sourceTabs.indexOf(
            event.currentTarget
        );

    const direction =
        event.key === 'ArrowRight'
            ? 1
            : -1;

    const nextIndex =
        (
            currentIndex +
            direction +
            elements.sourceTabs.length
        ) % elements.sourceTabs.length;

    const nextTab =
        elements.sourceTabs[nextIndex];

    activateSourceTab(
        nextTab.dataset.panel
    );

    nextTab.focus();
}

function initializeUploadArea() {
    elements.imageInput.addEventListener(
        'change',
        handleFileSelection
    );

    elements.removeImageButton.addEventListener(
        'click',
        clearSelectedImage
    );

    elements.uploadZone.addEventListener(
        'keydown',
        (event) => {
            if (
                event.key !== 'Enter' &&
                event.key !== ' '
            ) {
                return;
            }

            event.preventDefault();
            elements.imageInput.click();
        }
    );

    for (
        const eventName
        of ['dragenter', 'dragover']
    ) {
        elements.uploadZone.addEventListener(
            eventName,
            (event) => {
                event.preventDefault();

                elements.uploadZone.classList.add(
                    'drag-active'
                );
            }
        );
    }

    for (
        const eventName
        of ['dragleave', 'drop']
    ) {
        elements.uploadZone.addEventListener(
            eventName,
            (event) => {
                event.preventDefault();

                elements.uploadZone.classList.remove(
                    'drag-active'
                );
            }
        );
    }

    elements.uploadZone.addEventListener(
        'drop',
        (event) => {
            const file =
                event.dataTransfer?.files?.[0];

            if (file) {
                setSelectedFile(file);
            }
        }
    );
}

function handleFileSelection(event) {
    const file =
        event.target.files?.[0];

    if (!file) {
        clearSelectedImage();
        return;
    }

    setSelectedFile(file);
}

function setSelectedFile(file) {
    clearFormAlert();

    const validationError =
        validateSelectedFile(file);

    if (validationError) {
        clearSelectedImage();
        showFormAlert(validationError);
        return;
    }

    selectedFile = file;

    try {
        const transfer =
            new DataTransfer();

        transfer.items.add(file);

        elements.imageInput.files =
            transfer.files;
    } catch {
        // selectedFile is still used for submission.
    }

    revokePreviewUrl();

    previewObjectUrl =
        URL.createObjectURL(file);

    elements.previewImage.src =
        previewObjectUrl;

    elements.previewName.textContent =
        file.name;

    elements.previewSize.textContent =
        formatFileSize(file.size);

    elements.uploadZone.hidden = true;
    elements.imagePreview.hidden = false;
}

function clearSelectedImage() {
    selectedFile = null;
    elements.imageInput.value = '';

    revokePreviewUrl();

    elements.previewImage.removeAttribute(
        'src'
    );

    elements.previewName.textContent = '';
    elements.previewSize.textContent = '';

    elements.imagePreview.hidden = true;
    elements.uploadZone.hidden = false;
}

function revokePreviewUrl() {
    if (!previewObjectUrl) {
        return;
    }

    URL.revokeObjectURL(
        previewObjectUrl
    );

    previewObjectUrl = null;
}

function validateSelectedFile(file) {
    if (!ALLOWED_FILE_TYPES.has(file.type)) {
        return 'Choose a JPEG, PNG, or WEBP image.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        return 'The image is larger than the 5 MB limit.';
    }

    return null;
}

function formatFileSize(sizeInBytes) {
    if (sizeInBytes < 1024) {
        return `${sizeInBytes} bytes`;
    }

    const sizeInKilobytes =
        sizeInBytes / 1024;

    if (sizeInKilobytes < 1024) {
        return `${sizeInKilobytes.toFixed(1)} KB`;
    }

    return `${
        (sizeInKilobytes / 1024).toFixed(1)
    } MB`;
}

function initializeFormControls() {
    elements.analysisForm.addEventListener(
        'submit',
        handleSubmit
    );

    elements.mode.addEventListener(
        'change',
        updateModeInterface
    );
}

function updateModeInterface() {
    const mode =
        elements.mode.value;

    const isModerationOnly =
        mode === 'moderateOnly';

    elements.modeHelp.textContent =
        MODE_HELP[mode] ||
        MODE_HELP.concise;

    elements.lengthField.hidden =
        isModerationOnly;

    elements.visibleTextField.hidden =
        isModerationOnly;
}

async function handleSubmit(event) {
    event.preventDefault();

    clearFormAlert();

    const validationError =
        validateForm();

    if (validationError) {
        showFormAlert(validationError);
        return;
    }

    setLoading(true);

    try {
        const response =
            activeSource === 'upload'
                ? await submitUpload()
                : await submitUrl();

        const result =
            await readJsonResponse(response);

        if (!response.ok) {
            throw new Error(
                result.error ||
                'The image could not be analyzed.'
            );
        }

        showResults(result);
    } catch (error) {
        showFormAlert(
            error.message ||
            'Something went wrong. Please try again.'
        );
    } finally {
        setLoading(false);
    }
}

function validateForm() {
    if (
        activeSource === 'upload' &&
        !selectedFile
    ) {
        return 'Choose an image to analyze.';
    }

    if (activeSource === 'url') {
        const value =
            elements.imageUrl.value.trim();

        if (!value) {
            return 'Enter a public image URL.';
        }

        try {
            const url = new URL(value);

            if (
                !['http:', 'https:'].includes(
                    url.protocol
                )
            ) {
                return 'Use an HTTP or HTTPS image URL.';
            }
        } catch {
            return 'Enter a valid public image URL.';
        }
    }

    return null;
}

async function submitUpload() {
    const formData =
        new FormData();

    formData.append(
        'image',
        selectedFile
    );

    appendCommonFields(formData);

    return fetch(
        '/api/generate-caption',
        {
            method: 'POST',
            body: formData,
        }
    );
}

async function submitUrl() {
    const payload = {
        imageUrl:
            elements.imageUrl.value.trim(),

        mode:
            elements.mode.value,

        includeVisibleText:
            elements.includeVisibleText.checked,
    };

    if (elements.maxLength.value) {
        payload.maxLength =
            Number(elements.maxLength.value);
    }

    return fetch(
        '/api/analyze-url',
        {
            method: 'POST',

            headers: {
                'Content-Type':
                    'application/json',
            },

            body:
                JSON.stringify(payload),
        }
    );
}

function appendCommonFields(formData) {
    formData.append(
        'mode',
        elements.mode.value
    );

    formData.append(
        'includeVisibleText',
        String(
            elements.includeVisibleText.checked
        )
    );

    if (elements.maxLength.value) {
        formData.append(
            'maxLength',
            elements.maxLength.value
        );
    }
}

async function readJsonResponse(response) {
    const contentType =
        response.headers.get(
            'content-type'
        ) || '';

    if (
        !contentType.includes(
            'application/json'
        )
    ) {
        return {
            error:
                'The server returned an unexpected response.',
        };
    }

    return response.json();
}

function setLoading(isLoading) {
    elements.analyzeButton.disabled =
        isLoading;

    elements.analyzeButton.classList.toggle(
        'is-loading',
        isLoading
    );

    elements.analysisForm.setAttribute(
        'aria-busy',
        String(isLoading)
    );
}

function showFormAlert(message) {
    elements.formAlert.textContent =
        message;

    elements.formAlert.hidden =
        false;
}

function clearFormAlert() {
    elements.formAlert.textContent = '';
    elements.formAlert.hidden = true;
}

function initializeResultsControls() {
    elements.newAnalysisButton.addEventListener(
        'click',
        resetAnalysis
    );

    elements.humanResults.addEventListener(
        'click',
        handleCopyClick
    );
}

function showResults(result) {
    latestResult = result;

    renderSafetyBanner(result);
    renderHumanResults(result);
    renderJson(result);

    elements.resultsSection.hidden =
        false;

    elements.resultsSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });

    elements.resultsSection.focus({
        preventScroll: true,
    });
}

function renderSafetyBanner(result) {
    const moderation =
        result.moderation || {};

    const flagged =
        Boolean(
            result.flagged ??
            moderation.flagged
        );

    elements.safetyBanner.replaceChildren();

    const icon =
        document.createElement('i');

    icon.className =
        flagged
            ? 'fa-solid fa-triangle-exclamation'
            : 'fa-solid fa-circle-check';

    icon.setAttribute(
        'aria-hidden',
        'true'
    );

    const text =
        document.createElement('span');

    const categories =
        Array.isArray(
            moderation.flaggedCategories
        )
            ? moderation.flaggedCategories
            : [];

    text.textContent =
        flagged
            ? `Safety review flagged${
                categories.length
                    ? `: ${categories.join(', ')}`
                    : ' this image.'
            }`
            : 'No safety concerns were flagged.';

    elements.safetyBanner.append(
        icon,
        text
    );

    elements.safetyBanner.className =
        `safety-banner ${
            flagged
                ? 'flagged'
                : 'safe'
        }`;

    elements.safetyBanner.hidden =
        false;
}

function renderHumanResults(result) {
    elements.humanResults.replaceChildren();

    if (result.mode === 'moderateOnly') {
        addTextCard({
            title: 'Safety check',
            icon: 'fa-solid fa-shield-halved',
            value: formatModerationResult(result),
            primary: true,
        });

        return;
    }

    const config =
        MODE_RESULT_CONFIG[result.mode];

    const output =
        result.output || {};

    if (!config || !output.text) {
        addTextCard({
            title: 'Result',
            icon: 'fa-solid fa-circle-info',
            value:
                'The API completed the request but did not return the expected output.',
            primary: true,
        });

        return;
    }

    addTextCard({
        ...config,
        value: output.text,
        copyable: true,
    });

    if (
        Object.prototype.hasOwnProperty.call(
            output,
            'visibleText'
        )
    ) {
        addTextCard({
            title: 'Text shown in the image',
            icon: 'fa-solid fa-font',
            value:
                formatVisibleText(output),
            copyable:
                Array.isArray(output.visibleText) &&
                output.visibleText.length > 0,
        });
    }
}

function formatModerationResult(result) {
    const moderation =
        result.moderation || {};

    const categories =
        Array.isArray(
            moderation.flaggedCategories
        )
            ? moderation.flaggedCategories
            : [];

    if (!result.flagged) {
        return 'No safety concerns were flagged.';
    }

    if (categories.length === 0) {
        return 'This image was flagged for safety review.';
    }

    return `Flagged categories: ${categories.join(', ')}.`;
}

function addTextCard({
    title,
    icon,
    value,
    primary = false,
    copyable = false,
}) {
    if (!value) {
        return;
    }

    const card =
        createResultCard(
            title,
            icon,
            primary
        );

    const content =
        document.createElement('p');

    content.className =
        'result-card__content';

    content.textContent =
        value;

    card.appendChild(content);

    if (copyable) {
        card
            .querySelector(
                '.result-card__header'
            )
            .appendChild(
                createCopyButton(value)
            );
    }

    elements.humanResults.appendChild(card);
}

function createResultCard(
    title,
    iconClass,
    primary = false
) {
    const card =
        document.createElement('article');

    card.className =
        primary
            ? 'result-card result-card--primary'
            : 'result-card';

    const header =
        document.createElement('div');

    header.className =
        'result-card__header';

    const heading =
        document.createElement('h3');

    heading.className =
        'result-card__title';

    const icon =
        document.createElement('i');

    icon.className =
        iconClass;

    icon.setAttribute(
        'aria-hidden',
        'true'
    );

    const label =
        document.createElement('span');

    label.textContent =
        title;

    heading.append(
        icon,
        label
    );

    header.appendChild(heading);
    card.appendChild(header);

    return card;
}

function createCopyButton(value) {
    const button =
        document.createElement('button');

    button.type = 'button';
    button.className =
        'copy-button';

    button.dataset.copyText =
        value;

    button.setAttribute(
        'aria-label',
        'Copy result'
    );

    const icon =
        document.createElement('i');

    icon.className =
        'fa-regular fa-copy';

    icon.setAttribute(
        'aria-hidden',
        'true'
    );

    const label =
        document.createElement('span');

    label.textContent =
        'Copy';

    button.append(
        icon,
        label
    );

    return button;
}

function formatVisibleText(output) {
    if (!output.containsText) {
        return 'No meaningful visible text detected.';
    }

    if (
        !Array.isArray(output.visibleText) ||
        output.visibleText.length === 0
    ) {
        return 'Visible text was detected.';
    }

    return output.visibleText.join('\n');
}

async function handleCopyClick(event) {
    const button =
        event.target.closest(
            '[data-copy-text]'
        );

    if (!button) {
        return;
    }

    try {
        await navigator.clipboard.writeText(
            button.dataset.copyText
        );

        showToast('Copied');
    } catch {
        showToast(
            'Could not copy automatically.'
        );
    }
}

function renderJson(result) {
    if (!result) {
        return;
    }

    if (
        jsonEditor &&
        typeof jsonEditor.destroy ===
            'function'
    ) {
        jsonEditor.destroy();
        jsonEditor = null;
    }

    elements.jsonTree.replaceChildren();

    if (
        typeof window.JSONEditor !==
        'function'
    ) {
        const fallback =
            document.createElement('pre');

        fallback.className =
            'json-fallback';

        fallback.textContent =
            JSON.stringify(
                result,
                null,
                2
            );

        elements.jsonTree.appendChild(
            fallback
        );

        return;
    }

    jsonEditor =
        new window.JSONEditor(
            elements.jsonTree,
            {
                mode: 'view',
                modes: ['view'],
                mainMenuBar: false,
                navigationBar: false,
                statusBar: false,
                onEditable: () => false,
            }
        );

    jsonEditor.set(result);
    jsonEditor.expandAll();
}

function resetAnalysis() {
    latestResult = null;

    elements.resultsSection.hidden =
        true;

    elements.humanResults.replaceChildren();
    elements.safetyBanner.replaceChildren();
    elements.safetyBanner.hidden = true;

    if (
        jsonEditor &&
        typeof jsonEditor.destroy ===
            'function'
    ) {
        jsonEditor.destroy();
    }

    jsonEditor = null;
    elements.jsonTree.replaceChildren();

    elements.analysisForm.reset();

    clearSelectedImage();
    clearFormAlert();
    updateModeInterface();

    activateSourceTab('uploadPanel');

    document.getElementById(
        'analyzer'
    ).scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function showToast(message) {
    clearTimeout(toastTimer);

    elements.toastMessage.textContent =
        message;

    elements.toastMessage.hidden =
        false;

    toastTimer = setTimeout(
        () => {
            elements.toastMessage.hidden =
                true;
        },
        1800
    );
}
