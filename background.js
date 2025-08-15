// Rate Limit Monitor Background Script
console.log('Rate Limit Monitor: Background script loaded');

// 存储rate limit信息
let rateLimitData = new Map();

// 后端配置
let backendConfig = {
  url: '', // 后端地址，稍后设置
  enabled: false
};

// 测试通知功能
console.log('Testing notification API availability...');
if (chrome.notifications) {
  console.log('✅ chrome.notifications API is available');
} else {
  console.error('❌ chrome.notifications API is NOT available');
}

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

    case 'SET_BACKEND_CONFIG':
      setBackendConfig(message.config);
      sendResponse({ success: true });
      break;

    case 'GET_BACKEND_CONFIG':
      sendResponse({ config: backendConfig });
      break;

    case 'TEST_NOTIFICATION':
      console.log('Received test notification request:', message);
      showNotification(message.notificationType || 'test', {
        title: message.title || '🧪 测试通知',
        message: message.message || '这是一个测试通知'
      });
      sendResponse({ success: true, message: 'Test notification sent' });
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
  const orgId = data.orgId;

  if (resetAt) {
    // 存储rate limit信息
    rateLimitData.set(domain, {
      resetAt: resetAt,
      detectedAt: Date.now(),
      tabId: tabId,
      url: data.url,
      orgId: orgId
    });

    // 保存到chrome storage
    await chrome.storage.local.set({
      [`rateLimit_${domain}`]: {
        resetAt: resetAt,
        detectedAt: Date.now(),
        url: data.url,
        orgId: orgId
      }
    });

    // 显示rate limit检测通知
    showNotification('info', {
      title: '🚫 检测到Rate Limit',
      message: `域名: ${domain}${orgId ? `\n组织ID: ${orgId}` : ''}\n重置时间: ${new Date(resetAt * 1000).toLocaleTimeString()}`
    });

    // 发送到后端
    if (backendConfig.enabled && backendConfig.url && orgId && resetAt) {
      await sendToBackend(orgId, resetAt);
    }

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
  await restoreBackendConfig();
  await restoreRateLimitData();
});

chrome.runtime.onInstalled.addListener(async () => {
  await restoreBackendConfig();
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

// 发送数据到后端
async function sendToBackend(orgId, resetAt) {
  if (!backendConfig.url || !backendConfig.enabled) {
    console.log('Backend not configured or disabled');
    return;
  }

  try {
    const payload = {
      orgId: orgId,
      resetAt: resetAt,
      timestamp: Date.now()
    };

    console.log('Sending to backend:', payload);

    // 显示发送中通知
    showNotification('sending', {
      title: '📡 正在发送数据',
      message: `组织ID: ${orgId}\n正在发送到后端...`
    });

    const response = await fetch(backendConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('Successfully sent to backend');

      // 显示成功通知
      showNotification('success', {
        title: '✅ 发送成功',
        message: `组织ID: ${orgId}\n重置时间: ${new Date(resetAt * 1000).toLocaleTimeString()}\n已成功发送到后端`
      });
    } else {
      console.error('Backend response error:', response.status, response.statusText);

      // 显示错误通知
      showNotification('error', {
        title: '❌ 发送失败',
        message: `组织ID: ${orgId}\n错误: ${response.status} ${response.statusText}`
      });
    }
  } catch (error) {
    console.error('Error sending to backend:', error);

    // 显示网络错误通知
    showNotification('error', {
      title: '❌ 网络错误',
      message: `组织ID: ${orgId}\n错误: ${error.message}`
    });
  }
}

// 显示通知
function showNotification(type, options) {
  try {
    const notificationId = `rate-limit-${type}-${Date.now()}`;

    console.log('Creating notification:', { type, options, notificationId });

    let iconUrl = 'icon48.png';
    if (type === 'success') {
      iconUrl = 'icon48.png'; // 可以换成绿色图标
    } else if (type === 'error') {
      iconUrl = 'icon48.png'; // 可以换成红色图标
    }

    const notificationOptions = {
      type: 'basic',
      iconUrl: iconUrl,
      title: options.title,
      message: options.message,
      priority: type === 'error' ? 2 : 1 // 错误通知优先级更高
    };

    console.log('Notification options:', notificationOptions);

    chrome.notifications.create(notificationId, notificationOptions, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.error('Notification creation error:', chrome.runtime.lastError);
      } else {
        console.log('Notification created successfully:', notificationId);
      }
    });

    // 自动清除通知 - 延长显示时间
    setTimeout(() => {
      chrome.notifications.clear(notificationId, (wasCleared) => {
        console.log('Notification cleared:', notificationId, wasCleared);
      });
    }, type === 'sending' ? 5000 : 10000); // 发送中通知5秒后消失，其他10秒后消失

  } catch (error) {
    console.error('Error in showNotification:', error);
  }
}

// 设置后端配置
async function setBackendConfig(config) {
  backendConfig = { ...backendConfig, ...config };

  // 保存到storage
  await chrome.storage.local.set({ backendConfig });

  console.log('Backend config updated:', backendConfig);

  // 显示配置更新通知
  if (config.enabled && config.url) {
    showNotification('success', {
      title: '⚙️ 后端配置已更新',
      message: `后端地址: ${config.url}\n状态: 已启用`
    });
  } else if (config.enabled === false) {
    showNotification('info', {
      title: '⚙️ 后端配置已更新',
      message: '后端发送已禁用'
    });
  }
}

// 从storage恢复后端配置
async function restoreBackendConfig() {
  try {
    const result = await chrome.storage.local.get('backendConfig');
    if (result.backendConfig) {
      backendConfig = { ...backendConfig, ...result.backendConfig };
      console.log('Backend config restored:', backendConfig);
    }
  } catch (error) {
    console.error('Error restoring backend config:', error);
  }
}

// 处理通知点击事件
chrome.notifications.onClicked.addListener((notificationId) => {
  // 清除通知
  chrome.notifications.clear(notificationId);

  // 如果是rate limit相关通知，可以打开popup或相关页面
  if (notificationId.includes('rate-limit')) {
    // 这里可以添加打开popup的逻辑，但由于API限制，我们只能在控制台记录
    console.log('Rate limit notification clicked');
  }
});

// 处理通知关闭事件
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
  if (byUser) {
    console.log('Notification closed by user:', notificationId);
  }
});

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
