class I18nPopup {
    constructor() {
        this.translations = new Map();
        this.selectedLanguages = new Set(['ko']);
        this.initializeExtension();
    }

    async initializeExtension() {
        try {
            await this.setupEventListeners();
            await this.loadTranslations();
        } catch (error) {
            console.error('초기화 중 오류 발생:', error);
            this.showError('확장 프로그램 초기화 중 오류가 발생했습니다.');
        }
    }

    showError(message) {
        const container = document.querySelector('.ihe-container');
        if (!container) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'ihe-error-message';
        errorDiv.textContent = message;
        container.insertBefore(errorDiv, container.firstChild);
    }

    async setupEventListeners() {
        // 언어 선택 체크박스
        document.querySelectorAll('input[name="lang"]').forEach((checkbox) => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedLanguages.add(e.target.value);
                } else {
                    this.selectedLanguages.delete(e.target.value);
                }
                this.renderTranslationList();
            });
        });

        // 페이지 텍스트 추출 버튼
        const extractButton = document.getElementById('extractPage');
        if (extractButton) {
            extractButton.addEventListener('click', () => this.extractPageTexts());
        }

        // JSON 내보내기 버튼
        const exportButton = document.getElementById('exportJson');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportTranslations());
        }

        // 데이터 초기화 버튼
        const clearButton = document.getElementById('clearData');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearData());
        }
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                throw new Error('현재 탭을 찾을 수 없습니다.');
            }
            return tab;
        } catch (error) {
            console.error('현재 탭 정보 가져오기 실패:', error);
            throw error;
        }
    }

    async sendMessageToTab(message) {
        try {
            const tab = await this.getCurrentTab();
            return await chrome.tabs.sendMessage(tab.id, message);
        } catch (error) {
            console.error('탭에 메시지 전송 실패:', error);
            this.showError('페이지와의 통신에 실패했습니다.');
            throw error;
        }
    }

    async extractPageTexts() {
        const extractButton = document.getElementById('extractPage');
        const loadingIcon = extractButton.querySelector('.ihe-loading-icon');

        try {
            loadingIcon.classList.add('ihe-show');
            extractButton.disabled = true;
            this.setProgress(0, 1, '텍스트 추출 중...');

            // 1. 한글 텍스트만 추출
            await this.sendMessageToTab({
                action: 'extractPage',
                languages: ['ko'],
            });
            await this.loadTranslations();
            const koEntries = Array.from(this.translations.entries()).filter(([_, v]) => v.ko && v.ko.trim());

            // 2. 기존 번역 데이터 불러오기 및 병합
            const oldData = await chrome.storage.local.get('translations');
            const mergedTranslations = new Map(Object.entries(oldData.translations || {}));

            // 3. 한글 → 영어 번역(key 생성) 및 en/ja 번역, 병합
            let processed = 0;
            const total = koEntries.length;
            for (const [_, value] of koEntries) {
                const koText = value.ko;
                const enKey = await this.translateText(koText, 'ko', 'en');
                if (mergedTranslations.has(enKey)) continue; // 이미 있으면 skip
                const enText = await this.translateText(koText, 'ko', 'en');
                const jaText = await this.translateText(koText, 'ko', 'ja');
                mergedTranslations.set(enKey, {
                    ko: koText,
                    en: enText,
                    ja: jaText,
                    sourceUrl: value.sourceUrl,
                });
                processed++;
                this.setProgress(processed, total, `번역 중... (${processed}/${total})`);
            }

            this.translations = mergedTranslations;
            await chrome.storage.local.set({ translations: Object.fromEntries(this.translations) });
            this.renderTranslationList();
            await this.updateStats();
            this.setProgress(total, total, '완료');
        } catch (error) {
            console.error('텍스트 추출/번역 중 오류:', error);
            this.showError('텍스트 추출/번역 중 오류가 발생했습니다.');
        } finally {
            loadingIcon.classList.remove('ihe-show');
            extractButton.disabled = false;
        }
    }

    setProgress(done, total, msg) {
        const statusMessage = document.getElementById('ihe-statusMessage');
        const progressBar = document.querySelector('.ihe-progress-fill');
        const percent = total > 0 ? (done / total) * 100 : 0;
        statusMessage.textContent = msg || '';
        progressBar.style.width = `${percent}%`;
    }

    async translateText(text, from, to) {
        try {
            // 무료 Google 번역 API (비공식, 데모용)
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) return text;
            const data = await res.json();
            return data[0][0][0] || text;
        } catch (e) {
            return text;
        }
    }

    async loadTranslations() {
        try {
            const data = await chrome.storage.local.get('translations');
            this.translations = new Map(Object.entries(data.translations || {}));
            this.renderTranslationList();
        } catch (error) {
            console.error('번역 데이터 로드 중 오류:', error);
            this.showError('번역 데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    renderTranslationList() {
        const container = document.getElementById('translationList');
        if (!container) return;

        container.innerHTML = '';

        if (this.translations.size === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'ihe-empty-message';
            emptyMessage.textContent = '추출된 텍스트가 없습니다.';
            container.appendChild(emptyMessage);
            return;
        }

        const filteredTranslations = new Map(
            Array.from(this.translations.entries()).filter(([_, translation]) => Array.from(this.selectedLanguages).some((lang) => translation[lang]))
        );

        if (filteredTranslations.size === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'ihe-empty-message';
            emptyMessage.textContent = '선택한 언어의 텍스트가 없습니다.';
            container.appendChild(emptyMessage);
            return;
        }

        filteredTranslations.forEach((translation, key) => {
            const item = this.createTranslationItem(key, translation);
            container.appendChild(item);
        });
    }

    createTranslationItem(key, translation) {
        const div = document.createElement('div');
        div.className = 'ihe-translation-item';

        const content = Array.from(this.selectedLanguages)
            .map((lang) => (translation[lang] ? `<div class="ihe-text-${lang}">${this.escapeHtml(translation[lang])}</div>` : ''))
            .filter(Boolean)
            .join('');

        div.innerHTML = `
            <div class="ihe-translation-key">${this.escapeHtml(key)}</div>
            <div class="ihe-translation-text">${content}</div>
            <div class="ihe-translation-source">${this.escapeHtml(translation.sourceUrl || '')}</div>
        `;
        return div;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    async exportTranslations() {
        try {
            const translations = Object.fromEntries(this.translations);
            const exportData = { ko: {}, en: {}, ja: {} };
            for (const [key, value] of Object.entries(translations)) {
                if (value.ko) exportData.ko[key] = value.ko;
                if (value.en) exportData.en[key] = value.en;
                if (value.ja) exportData.ja[key] = value.ja;
            }
            // ko/en/ja 모두 내보내기
            for (const lang of ['ko', 'en', 'ja']) {
                if (Object.keys(exportData[lang]).length === 0) continue;
                const blob = new Blob([JSON.stringify(exportData[lang], null, 2)], {
                    type: 'application/json',
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${lang}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
            }
        } catch (error) {
            console.error('번역 내보내기 중 오류:', error);
            this.showError('번역 내보내기 중 오류가 발생했습니다.');
        }
    }

    async clearData() {
        try {
            if (confirm('모든 번역 데이터를 초기화하시겠습니까?')) {
                await chrome.storage.local.remove(['translations']);
                this.translations.clear();
                this.renderTranslationList();
                await this.updateStats();
            }
        } catch (error) {
            console.error('데이터 초기화 중 오류:', error);
            this.showError('데이터 초기화 중 오류가 발생했습니다.');
        }
    }

    async updateStats() {
        try {
            const stats = await this.sendMessageToTab({ action: 'getStats' });
            const statusMessage = document.getElementById('ihe-statusMessage');
            statusMessage.textContent = `처리된 텍스트: ${stats.processedCount} / 남은 텍스트: ${stats.remainingCount}`;

            const progressBar = document.querySelector('.ihe-progress-fill');
            const total = stats.processedCount + stats.remainingCount;
            const progress = total > 0 ? (stats.processedCount / total) * 100 : 0;
            progressBar.style.width = `${progress}%`;
        } catch (error) {
            console.error('통계 업데이트 중 오류:', error);
        }
    }
}

// 팝업 초기화
document.addEventListener('DOMContentLoaded', () => {
    const popup = new I18nPopup();
});
