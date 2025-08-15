// Rate Limit Monitor - Content Script
console.log('Rate Limit Monitor: Content script loaded');

// 注入拦截脚本
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// 创建UI显示组件
function createRateLimitUI() {
  // 检查是否已存在
  if (document.getElementById('rate-limit-monitor-ui')) {
    return;
  }
  
  const ui = document.createElement('div');
  ui.id = 'rate-limit-monitor-ui';
  ui.innerHTML = `
    <div id="rate-limit-display" style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      display: none;
      min-width: 200px;
      border: 2px solid #cc0000;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 600;">🚫 Rate Limited</span>
        <button id="rate-limit-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          padding: 0;
          margin-left: 10px;
        ">×</button>
      </div>
      <div id="rate-limit-info">
        <div id="rate-limit-countdown" style="font-size: 16px; font-weight: 600; margin-bottom: 4px;"></div>
        <div id="rate-limit-details" style="font-size: 12px; opacity: 0.9;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(ui);
  
  // 添加关闭按钮事件
  document.getElementById('rate-limit-close').addEventListener('click', () => {
    hideRateLimitUI();
  });
  
  // 添加样式
  if (!document.getElementById('rate-limit-monitor-styles')) {
    const style = document.createElement('style');
    style.id = 'rate-limit-monitor-styles';
    style.textContent = `
      #rate-limit-display {
        transition: all 0.3s ease;
      }
      #rate-limit-display.show {
        display: block !important;
        animation: slideIn 0.3s ease;
      }
      #rate-limit-display.hide {
        animation: slideOut 0.3s ease;
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// 显示rate limit UI
function showRateLimitUI(data) {
  createRateLimitUI();
  const display = document.getElementById('rate-limit-display');
  const countdown = document.getElementById('rate-limit-countdown');
  const details = document.getElementById('rate-limit-details');
  
  if (data.resetAt) {
    const resetTime = data.resetAt * 1000; // 转换为毫秒
    const domain = data.domain || 'API';
    
    details.textContent = `${domain} - Resets at ${new Date(resetTime).toLocaleTimeString()}`;
    
    // 开始倒计时
    startCountdown(countdown, resetTime);
    
    display.classList.add('show');
    display.style.display = 'block';
  } else {
    countdown.textContent = 'Rate limited';
    details.textContent = `${data.domain || 'API'} - Reset time unknown`;
    display.classList.add('show');
    display.style.display = 'block';
  }
}

// 隐藏rate limit UI
function hideRateLimitUI() {
  const display = document.getElementById('rate-limit-display');
  if (display) {
    display.classList.remove('show');
    display.classList.add('hide');
    setTimeout(() => {
      display.style.display = 'none';
      display.classList.remove('hide');
    }, 300);
  }
  
  // 清除倒计时
  if (window.rateLimitCountdownInterval) {
    clearInterval(window.rateLimitCountdownInterval);
    window.rateLimitCountdownInterval = null;
  }
}

// 倒计时功能
function startCountdown(element, resetTime) {
  // 清除之前的倒计时
  if (window.rateLimitCountdownInterval) {
    clearInterval(window.rateLimitCountdownInterval);
  }
  
  function updateCountdown() {
    const now = Date.now();
    const remaining = resetTime - now;
    
    if (remaining <= 0) {
      element.textContent = 'Limit Reset!';
      setTimeout(() => {
        hideRateLimitUI();
        // 通知background清除数据
        chrome.runtime.sendMessage({
          type: 'CLEAR_RATE_LIMIT',
          domain: getCurrentDomain()
        });
      }, 2000);
      clearInterval(window.rateLimitCountdownInterval);
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    if (minutes > 0) {
      element.textContent = `${minutes}m ${seconds}s remaining`;
    } else {
      element.textContent = `${seconds}s remaining`;
    }
  }
  
  updateCountdown();
  window.rateLimitCountdownInterval = setInterval(updateCountdown, 1000);
}

// 获取当前域名
function getCurrentDomain() {
  return window.location.hostname;
}

// 监听rate limit事件
window.addEventListener('rateLimitDetected', (event) => {
  console.log('Rate limit detected in content script:', event.detail);
  
  // 发送到background script
  chrome.runtime.sendMessage({
    type: 'RATE_LIMIT_DETECTED',
    data: event.detail
  });
  
  // 显示UI
  showRateLimitUI(event.detail);
});

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  switch (message.type) {
    case 'RATE_LIMIT_UPDATE':
      if (message.status) {
        showRateLimitUI({
          domain: message.domain,
          resetAt: message.status.resetAt
        });
      } else {
        hideRateLimitUI();
      }
      break;

    case 'RATE_LIMIT_CLEARED_ALL':
      hideRateLimitUI();
      break;
  }
  
  sendResponse({ success: true });
});

// 页面加载时检查是否有现有的rate limit
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({
    type: 'GET_RATE_LIMIT_STATUS',
    domain: getCurrentDomain()
  }, (response) => {
    if (response && response.status) {
      showRateLimitUI({
        domain: getCurrentDomain(),
        resetAt: response.status.resetAt
      });
    }
  });
});

// 立即注入脚本
injectScript();

// 如果DOM已加载，立即检查状态
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'GET_RATE_LIMIT_STATUS',
        domain: getCurrentDomain()
      }, (response) => {
        if (response && response.status) {
          showRateLimitUI({
            domain: getCurrentDomain(),
            resetAt: response.status.resetAt
          });
        }
      });
    }, 1000);
  });
} else {
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'GET_RATE_LIMIT_STATUS',
      domain: getCurrentDomain()
    }, (response) => {
      if (response && response.status) {
        showRateLimitUI({
          domain: getCurrentDomain(),
          resetAt: response.status.resetAt
        });
      }
    });
  }, 1000);
}

console.log('Rate Limit Monitor: Content script setup complete');
