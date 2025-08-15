// Rate Limit Monitor - Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  const statusContainer = document.getElementById('status-container');
  const refreshBtn = document.getElementById('refresh-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');
  const backendUrlInput = document.getElementById('backend-url');
  const backendEnabledCheckbox = document.getElementById('backend-enabled');
  const saveConfigBtn = document.getElementById('save-config-btn');
  
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
                url: value.url,
                orgId: value.orgId
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
    card.className = 'status-card status-active';
    card.innerHTML = `
      <div class="domain-name">${domain}</div>
      <div class="countdown" data-reset-time="${data.resetTime}">
        ${formatRemainingTime(data.remainingMs)}
      </div>
      <div class="reset-time">
        重置时间: ${formatTime(data.resetTime)}<br>
        检测时间: ${formatTime(data.detectedAt)}
        ${data.url ? `<br>URL: ${data.url}` : ''}
        ${data.orgId ? `<br>组织ID: ${data.orgId}` : ''}
      </div>
      <button type="button" class="clear-btn" onclick="clearSingleRateLimit('${domain}')">清除</button>
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

      statusContainer.innerHTML = '';

      if (domains.length === 0) {
        statusContainer.innerHTML = '<div class="no-limits">No active rate limits detected</div>';
      } else {
        domains.forEach(domain => {
          const card = createRateLimitCard(domain, rateLimits[domain]);
          statusContainer.appendChild(card);
        });

        // 开始倒计时更新
        if (window.countdownInterval) {
          clearInterval(window.countdownInterval);
        }
        window.countdownInterval = setInterval(updateCountdowns, 1000);
      }

    } catch (error) {
      console.error('Error loading rate limit status:', error);
      statusContainer.innerHTML = `
        <div class="status-card">
          <div class="domain-name">❌ 加载失败</div>
          <div class="reset-time">${error.message}</div>
        </div>
      `;
    }
  }
  
  // 清除所有rate limit
  async function clearAllRateLimits() {
    try {
      // 通知background script
      chrome.runtime.sendMessage({
        type: 'CLEAR_ALL_RATE_LIMITS'
      });

      // 刷新显示
      await loadRateLimitStatus();

    } catch (error) {
      console.error('Error clearing rate limits:', error);
    }
  }

  // 清除单个rate limit
  window.clearSingleRateLimit = async function(domain) {
    try {
      chrome.runtime.sendMessage({
        type: 'CLEAR_RATE_LIMIT',
        domain: domain
      });

      // 刷新显示
      await loadRateLimitStatus();

    } catch (error) {
      console.error('Error clearing rate limit:', error);
    }
  }

  // 加载后端配置
  async function loadBackendConfig() {
    try {
      chrome.runtime.sendMessage({
        type: 'GET_BACKEND_CONFIG'
      }, (response) => {
        if (response && response.config) {
          backendUrlInput.value = response.config.url || '';
          backendEnabledCheckbox.checked = response.config.enabled || false;
        }
      });
    } catch (error) {
      console.error('Error loading backend config:', error);
    }
  }

  // 保存后端配置
  async function saveBackendConfig() {
    try {
      const config = {
        url: backendUrlInput.value.trim(),
        enabled: backendEnabledCheckbox.checked
      };

      chrome.runtime.sendMessage({
        type: 'SET_BACKEND_CONFIG',
        config: config
      }, (response) => {
        if (response && response.success) {
          // 显示保存成功提示
          const originalText = saveConfigBtn.textContent;
          saveConfigBtn.textContent = '✓ 已保存';
          saveConfigBtn.style.background = '#28a745';

          setTimeout(() => {
            saveConfigBtn.textContent = originalText;
            saveConfigBtn.style.background = '';
          }, 2000);
        }
      });
    } catch (error) {
      console.error('Error saving backend config:', error);
    }
  }
  
  // 事件监听
  refreshBtn.addEventListener('click', loadRateLimitStatus);
  clearAllBtn.addEventListener('click', clearAllRateLimits);
  saveConfigBtn.addEventListener('click', saveBackendConfig);
  
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
  await loadBackendConfig();
  await loadRateLimitStatus();
  
  // 清理定时器
  window.addEventListener('beforeunload', () => {
    if (window.countdownInterval) {
      clearInterval(window.countdownInterval);
    }
  });
});
