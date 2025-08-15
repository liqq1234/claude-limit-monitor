// Rate Limit Monitor Background Script
console.log('Rate Limit Monitor: Background script loaded');

// 存储rate limit信息
let rateLimitData = new Map();

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.type) {
    case 'RATE_LIMIT_DETECTED':
      handleRateLimitDetected(message.data, sender.tab.id);
      sendResponse({ success: true });
      break;
      
    case 'GET_RATE_LIMIT_STATUS':
      const status = getRateLimitStatus(message.domain || 'default');
      sendResponse({ status });
      break;
      
    case 'CLEAR_RATE_LIMIT':
      clearRateLimit(message.domain || 'default');
      sendResponse({ success: true });
      break;

    case 'CLEAR_ALL_RATE_LIMITS':
      clearAllRateLimits();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
  
  return true; // 保持消息通道开放
});

// 处理检测到的rate limit
async function handleRateLimitDetected(data, tabId) {
  console.log('Rate limit detected:', data);
  
  const domain = data.domain || 'default';
  const resetAt = data.resetAt;
  
  if (resetAt) {
    // 存储rate limit信息
    rateLimitData.set(domain, {
      resetAt: resetAt,
      detectedAt: Date.now(),
      tabId: tabId,
      url: data.url
    });
    
    // 保存到chrome storage
    await chrome.storage.local.set({
      [`rateLimit_${domain}`]: {
        resetAt: resetAt,
        detectedAt: Date.now(),
        url: data.url
      }
    });
    
    // 通知所有相关tab更新状态
    notifyTabsOfRateLimitUpdate(domain);
    
    console.log(`Rate limit stored for ${domain}, resets at:`, new Date(resetAt * 1000));
  }
}

// 获取rate limit状态
function getRateLimitStatus(domain) {
  const data = rateLimitData.get(domain);
  if (!data) return null;
  
  const now = Date.now();
  const resetTime = data.resetAt * 1000; // 转换为毫秒
  
  if (now >= resetTime) {
    // 已经过期，清除数据
    rateLimitData.delete(domain);
    chrome.storage.local.remove(`rateLimit_${domain}`);
    return null;
  }
  
  return {
    resetAt: data.resetAt,
    resetTime: resetTime,
    remainingMs: resetTime - now,
    detectedAt: data.detectedAt,
    url: data.url
  };
}

// 清除rate limit
function clearRateLimit(domain) {
  rateLimitData.delete(domain);
  chrome.storage.local.remove(`rateLimit_${domain}`);
  notifyTabsOfRateLimitUpdate(domain);
}

// 清除所有rate limit
async function clearAllRateLimits() {
  try {
    const result = await chrome.storage.local.get();
    const keysToRemove = [];

    for (const key of Object.keys(result)) {
      if (key.startsWith('rateLimit_')) {
        keysToRemove.push(key);
        const domain = key.replace('rateLimit_', '');
        rateLimitData.delete(domain);
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);

      // 通知所有tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && (tab.url.includes('claude.ai') || tab.url.includes('chatgpt.com') || tab.url.includes('api.') || tab.url.includes('demo.fuclaude.com'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'RATE_LIMIT_CLEARED_ALL'
          }).catch(() => {
            // 忽略无法发送消息的tab
          });
        }
      }
    }

    console.log('All rate limits cleared');
  } catch (error) {
    console.error('Error clearing all rate limits:', error);
  }
}

// 通知tabs更新
async function notifyTabsOfRateLimitUpdate(domain) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && (tab.url.includes('claude.ai') || tab.url.includes('chatgpt.com') || tab.url.includes('api.') || tab.url.includes('demo.fuclaude.com'))) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'RATE_LIMIT_UPDATE',
          domain: domain,
          status: getRateLimitStatus(domain)
        }).catch(() => {
          // 忽略无法发送消息的tab
        });
      }
    }
  } catch (error) {
    console.error('Error notifying tabs:', error);
  }
}

// 启动时从storage恢复数据
chrome.runtime.onStartup.addListener(async () => {
  await restoreRateLimitData();
});

chrome.runtime.onInstalled.addListener(async () => {
  await restoreRateLimitData();
});

// 从storage恢复rate limit数据
async function restoreRateLimitData() {
  try {
    const result = await chrome.storage.local.get();
    const now = Date.now();
    
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('rateLimit_')) {
        const domain = key.replace('rateLimit_', '');
        const resetTime = value.resetAt * 1000;
        
        if (now < resetTime) {
          // 还未过期，恢复数据
          rateLimitData.set(domain, {
            resetAt: value.resetAt,
            detectedAt: value.detectedAt,
            url: value.url
          });
        } else {
          // 已过期，清除
          chrome.storage.local.remove(key);
        }
      }
    }
    
    console.log('Rate limit data restored:', rateLimitData);
  } catch (error) {
    console.error('Error restoring rate limit data:', error);
  }
}

// 定期清理过期数据
setInterval(() => {
  const now = Date.now();
  for (const [domain, data] of rateLimitData.entries()) {
    if (now >= data.resetAt * 1000) {
      rateLimitData.delete(domain);
      chrome.storage.local.remove(`rateLimit_${domain}`);
    }
  }
}, 60000); // 每分钟检查一次
