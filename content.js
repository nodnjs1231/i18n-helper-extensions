// 텍스트 노드 추출
function extractTextNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
            // 스크립트와 스타일은 제외
            if (node.parentElement.tagName === 'SCRIPT' || node.parentElement.tagName === 'STYLE') {
                return NodeFilter.FILTER_REJECT;
            }
            // 공백만 있는 노드는 제외
            if (node.textContent.trim() === '') {
                return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }
    return textNodes;
}

// 키 생성
function generateKey(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// 텍스트 하이라이트
function highlightText(node) {
    const span = document.createElement('span');
    span.className = 'i18n-highlight';
    span.setAttribute('data-original-text', node.textContent.trim());
    span.setAttribute('data-i18n-key', generateKey(node.textContent.trim()));

    const wrapper = document.createElement('span');
    wrapper.className = 'i18n-wrapper';
    wrapper.appendChild(span);

    node.parentNode.insertBefore(wrapper, node);
    span.appendChild(node);

    // 클릭 이벤트 추가
    span.addEventListener('click', function (e) {
        e.stopPropagation();
        const text = this.getAttribute('data-original-text');
        const key = this.getAttribute('data-i18n-key');

        // 번역 데이터 저장
        const translations = JSON.parse(localStorage.getItem('i18n-translations') || '{}');
        translations[key] = {
            ko: text,
            en: '', // Google Translate API로 자동 번역 예정
            jp: '', // Google Translate API로 자동 번역 예정
        };
        localStorage.setItem('i18n-translations', JSON.stringify(translations));

        // 처리 완료 표시
        this.style.backgroundColor = '#e8f5e9';
        updateStats();
    });
}

// 통계 업데이트
function updateStats() {
    const processed = document.querySelectorAll('.i18n-highlight[style*="background-color: rgb(232, 245, 233)"]').length;
    const total = document.querySelectorAll('.i18n-highlight').length;

    chrome.runtime.sendMessage({
        type: 'statsUpdate',
        stats: {
            processed: processed,
            remaining: total - processed,
        },
    });
}

// 하이라이트 시작
function startHighlight() {
    const textNodes = extractTextNodes(document.body);
    textNodes.forEach(highlightText);

    // 스타일 추가
    const style = document.createElement('style');
    style.textContent = `
    .i18n-highlight {
      background-color: #fff3e0;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 2px;
    }
    .i18n-highlight:hover {
      background-color: #ffe0b2;
    }
  `;
    document.head.appendChild(style);

    updateStats();
}

// 하이라이트 제거
function stopHighlight() {
    const highlights = document.querySelectorAll('.i18n-wrapper');
    highlights.forEach((wrapper) => {
        const textNode = wrapper.querySelector('.i18n-highlight').firstChild;
        wrapper.parentNode.insertBefore(textNode, wrapper);
        wrapper.remove();
    });
}

// 번역 파일 내보내기
function exportTranslations() {
    const translations = JSON.parse(localStorage.getItem('i18n-translations') || '{}');

    // 파일 다운로드
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(translations, null, 2)));
    element.setAttribute('download', 'translations.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// 메시지 리스너
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.action) {
        case 'startHighlight':
            startHighlight();
            break;
        case 'stopHighlight':
            stopHighlight();
            break;
        case 'exportTranslations':
            exportTranslations();
            break;
    }
});

class I18nHelper {
    constructor() {
        this.processedNodes = new WeakSet();
        this.translations = new Map();
        this.stats = {
            processedCount: 0,
            remainingCount: 0,
        };
        this.setupMessageListener();
        this.setupMutationObserver();
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'extractPage':
                    this.extractTexts(request.languages);
                    sendResponse({ success: true });
                    break;
                case 'getStats':
                    sendResponse(this.stats);
                    break;
            }
            return true;
        });
    }

    setupMutationObserver() {
        // React와 같은 동적 콘텐츠 변경 감지
        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    this.handleDynamicContent(mutation.addedNodes);
                }
            }
        });

        // 옵저버 설정
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    handleDynamicContent(nodes) {
        nodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const textNodes = this.getTextNodes(node);
                textNodes.forEach((textNode) => {
                    if (!this.processedNodes.has(textNode)) {
                        this.processNode(textNode);
                    }
                });
            }
        });
    }

    processNode(node) {
        if (this.processedNodes.has(node)) return;

        const text = node.textContent.trim();
        if (!this.isValidText(text, this.currentLanguages)) return;

        this.processedNodes.add(node);
        this.updateStats();
    }

    isValidText(text, languages) {
        if (!text || typeof text !== 'string') return false;

        // 공백만 있는 텍스트 제외
        text = text.trim();
        if (!text) return false;

        // 숫자만 있는 텍스트 제외
        if (/^\d+$/.test(text)) return false;

        // 특수문자만 있는 텍스트 제외
        if (/^[!@#$%^&*(),.?":{}|<>]+$/.test(text)) return false;

        // React 프로퍼티 문자열 제외
        if (/^[a-zA-Z]+[A-Z][a-zA-Z]*$/.test(text)) return false;

        // 선택된 언어에 해당하는 텍스트인지 확인
        const hasKorean = /[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text);
        const hasEnglish = /[a-zA-Z]/.test(text);
        const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);

        return (languages.includes('ko') && hasKorean) || (languages.includes('en') && hasEnglish) || (languages.includes('ja') && hasJapanese);
    }

    detectLanguage(text) {
        const result = {
            ko: false,
            en: false,
            ja: false,
        };

        if (/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(text)) {
            result.ko = true;
        }
        if (/[a-zA-Z]/.test(text)) {
            result.en = true;
        }
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text)) {
            result.ja = true;
        }

        return result;
    }

    generateKey(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9가-힣ぁ-んァ-ン一-龯]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
    }

    async extractTexts(languages) {
        try {
            this.currentLanguages = languages;
            const textNodes = this.getTextNodes(document.body);
            // 기존 번역 데이터 불러오기
            const translations = await this.loadTranslations();
            this.translations = new Map(Object.entries(translations || {}));

            // React 컴포넌트 내부의 텍스트도 처리
            const shadowRoots = this.getShadowRoots(document.body);
            const shadowTextNodes = shadowRoots.flatMap((root) => this.getTextNodes(root));
            const allTextNodes = [...textNodes, ...shadowTextNodes];

            allTextNodes.forEach((node) => {
                if (this.processedNodes.has(node)) return;

                const text = node.textContent.trim();
                if (!this.isValidText(text, languages)) return;

                const key = this.generateKey(text);
                const detectedLanguages = this.detectLanguage(text);

                // 기존 데이터에 key가 있으면 skip (중복 방지)
                if (!this.translations.has(key)) {
                    this.translations.set(key, {
                        sourceUrl: window.location.href,
                    });
                }

                const translation = this.translations.get(key);
                for (const lang of Object.keys(detectedLanguages)) {
                    if (detectedLanguages[lang] && languages.includes(lang)) {
                        translation[lang] = text;
                    }
                }

                this.processedNodes.add(node);
            });

            await this.saveTranslations();
            this.updateStats();
        } catch (error) {
            console.error('텍스트 추출 중 오류:', error);
        }
    }

    getShadowRoots(node) {
        const roots = [];
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => {
                return node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            },
        });

        let currentNode;
        while ((currentNode = walker.nextNode())) {
            if (currentNode.shadowRoot) {
                roots.push(currentNode.shadowRoot);
            }
        }

        return roots;
    }

    getTextNodes(node) {
        const textNodes = [];
        const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (!node.parentElement) return NodeFilter.FILTER_REJECT;

                const style = window.getComputedStyle(node.parentElement);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }

                // 제외할 태그만 필터링(td, input, textarea, select, option, button, a)
                const tag = node.parentElement.tagName;
                const excludeTags = ['TD', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON', 'A'];
                if (excludeTags.includes(tag)) return NodeFilter.FILTER_REJECT;

                // React 관련 요소 필터링
                const isScript = tag === 'SCRIPT';
                const isStyle = tag === 'STYLE';
                const isHidden = node.parentElement.hidden;
                const isReactInternal = node.parentElement.hasAttribute('data-reactroot') || node.parentElement.hasAttribute('data-reactid');

                return !isScript && !isStyle && !isHidden && !isReactInternal ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
        });

        let currentNode;
        while ((currentNode = walk.nextNode())) {
            textNodes.push(currentNode);
        }

        return textNodes;
    }

    async loadTranslations() {
        try {
            const data = await chrome.storage.local.get('translations');
            return data.translations || {};
        } catch (error) {
            console.error('번역 데이터 로드 중 오류:', error);
            return {};
        }
    }

    async saveTranslations() {
        try {
            await chrome.storage.local.set({
                translations: Object.fromEntries(this.translations),
            });
        } catch (error) {
            console.error('번역 데이터 저장 중 오류:', error);
        }
    }

    updateStats() {
        // 실제 추출된 번역 데이터 개수로 처리
        const processedCount = Array.from(this.translations.values()).filter((tr) =>
            Object.keys(tr).some((k) => k === 'ko' || k === 'en' || k === 'ja')
        ).length;
        const totalNodes = this.getTextNodes(document.body).length;
        this.stats = {
            processedCount,
            remainingCount: Math.max(0, totalNodes - processedCount),
        };
    }

    // slugify: 영문자, 숫자, 언더스코어만 허용
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    generateKey(text) {
        // 기존 generateKey는 한글 등도 포함하므로, slugify로 영문만 보장
        return this.slugify(text);
    }
}

// 헬퍼 초기화
const helper = new I18nHelper();
