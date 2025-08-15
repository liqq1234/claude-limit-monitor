// Rate Limit Monitor - Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');
  
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  const rateLimitsEl = document.getElementById('rate-limits');
  const noLimitsEl = document.getElementById('no-limits');
  const refreshBtn = document.getElementById('refresh-btn');
  const clearBtn = document.getElementById('clear-btn');
  
  // 格式化时间
  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
  
  // 格式化剩余时间
  function formatRemainingTime(ms) {
    if (ms <= 0) return '已恢复';
    
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}小时${remainingMinutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
  
  // 获取所有rate limit状态
  async function getAllRateLimitStatus() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result) => {
        const rateLimits = {};
        const now = Date.now();
        
        for (const [key, value] of Object.entries(result)) {
          if (key.startsWith('rateLimit_')) {
            const domain = key.replace('rateLimit_', '');
            const resetTime = value.resetAt * 1000;
            
            if (now < resetTime) {
              rateLimits[domain] = {
                resetAt: value.resetAt,
                resetTime: resetTime,
                remainingMs: resetTime - now,
                detectedAt: value.detectedAt,
                url: value.url
              };
            }
          }
        }
        
        resolve(rateLimits);
      });
    });
  }
  
  // 创建rate limit卡片
  function createRateLimitCard(domain, data) {
    const card = document.createElement('div');
    card.className = 'status-card rate-limited';
    card.innerHTML = `
      <div class="status-title">
        <span class="emoji">🚫</span>
        <span>${domain}</span>
      </div>
      <div class="countdown" data-reset-time="${data.resetTime}">
        ${formatRemainingTime(data.remainingMs)}
      </div>
      <div class="status-details">
        重置时间: ${formatTime(data.resetTime)}<br>
        检测时间: ${formatTime(data.detectedAt)}
        ${data.url ? `<br>URL: ${data.url}` : ''}
      </div>
    `;
    
    return card;
  }
  
  // 更新倒计时
  function updateCountdowns() {
    const countdowns = document.querySelectorAll('.countdown[data-reset-time]');
    const now = Date.now();
    let hasExpired = false;
    
    countdowns.forEach(countdown => {
      const resetTime = parseInt(countdown.dataset.resetTime);
      const remaining = resetTime - now;
      
      if (remaining <= 0) {
        countdown.textContent = '已恢复';
        countdown.style.color = '#28a745';
        hasExpired = true;
      } else {
        countdown.textContent = formatRemainingTime(remaining);
      }
    });
    
    // 如果有过期的，刷新状态
    if (hasExpired) {
      setTimeout(loadRateLimitStatus, 1000);
    }
  }
  
  // 加载rate limit状态
  async function loadRateLimitStatus() {
    try {
      const rateLimits = await getAllRateLimitStatus();
      const domains = Object.keys(rateLimits);
      
      rateLimitsEl.innerHTML = '';
      
      if (domains.length === 0) {
        noLimitsEl.style.display = 'block';
        rateLimitsEl.style.display = 'none';
      } else {
        noLimitsEl.style.display = 'none';
        rateLimitsEl.style.display = 'block';
        
        domains.forEach(domain => {
          const card = createRateLimitCard(domain, rateLimits[domain]);
          rateLimitsEl.appendChild(card);
        });
        
        // 开始倒计时更新
        if (window.countdownInterval) {
          clearInterval(window.countdownInterval);
        }
        window.countdownInterval = setInterval(updateCountdowns, 1000);
      }
      
    } catch (error) {
      console.error('Error loading rate limit status:', error);
      rateLimitsEl.innerHTML = `
        <div class="status-card">
          <div class="status-title">
            <span class="emoji">❌</span>
            <span>加载失败</span>
          </div>
          <div class="status-details">
            ${error.message}
          </div>
        </div>
      `;
    } finally {
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    }
  }
  
  // 清除所有rate limit
  async function clearAllRateLimits() {
    try {
      const result = await chrome.storage.local.get(null);
      const keysToRemove = [];
      
      for (const key of Object.keys(result)) {
        if (key.startsWith('rateLimit_')) {
          keysToRemove.push(key);
        }
      }
      
      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        
        // 通知background script
        chrome.runtime.sendMessage({
          type: 'CLEAR_ALL_RATE_LIMITS'
        });
        
        // 刷新显示
        await loadRateLimitStatus();
      }
      
    } catch (error) {
      console.error('Error clearing rate limits:', error);
    }
  }
  
  // 事件监听
  refreshBtn.addEventListener('click', loadRateLimitStatus);
  clearBtn.addEventListener('click', clearAllRateLimits);
  
  // 监听storage变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      let hasRateLimitChange = false;
      for (const key of Object.keys(changes)) {
        if (key.startsWith('rateLimit_')) {
          hasRateLimitChange = true;
          break;
        }
      }
      
      if (hasRateLimitChange) {
        loadRateLimitStatus();
      }
    }
  });
  
  // 初始加载
  await loadRateLimitStatus();
  
  // 清理定时器
  window.addEventListener('beforeunload', () => {
    if (window.countdownInterval) {
      clearInterval(window.countdownInterval);
    }
  });
});
