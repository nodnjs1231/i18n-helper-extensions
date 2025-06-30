// content script가 로드되었는지 추적
let contentScriptLoaded = {};

// content script 주입 상태 초기화
chrome.runtime.onInstalled.addListener(() => {
    contentScriptLoaded = {};
});

// 탭이 업데이트될 때마다 content script 상태 초기화
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        contentScriptLoaded[tabId] = false;
        injectContentScript(tabId);
    }
});

// 탭이 제거될 때 상태 정리
chrome.tabs.onRemoved.addListener((tabId) => {
    delete contentScriptLoaded[tabId];
});

// content script 주입 함수
async function injectContentScript(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js'],
            });
            await chrome.scripting.insertCSS({
                target: { tabId: tabId },
                files: ['styles.css'],
            });
            contentScriptLoaded[tabId] = true;
        }
    } catch (error) {
        console.error('Content script 주입 중 오류:', error);
    }
}

// popup과 content script 간의 메시지 중계
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkContentScript') {
        const tabId = message.tabId;
        sendResponse({ isLoaded: contentScriptLoaded[tabId] || false });
        return true;
    }
});
