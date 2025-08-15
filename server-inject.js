// Claude Rate Limit Monitor - 服务端注入脚本
// 用于在 claude.lqqmail.xzy 服务器上自动检测429错误并发送到后端
(function() {
  'use strict';
  
  console.log('🚫 Claude Rate Limit Monitor - 服务端版本已加载');
  
  // 配置
  const CONFIG = {
    // 后端API地址 - 修改为你的实际后端地址
    BACKEND_URL: 'http://localhost:8787/api/rate-limit',
    
    // 是否启用调试日志
    DEBUG: true,
    
    // 重试配置
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 毫秒
  };
  
  // 日志函数
  function log(message, data = null) {
    if (CONFIG.DEBUG) {
      console.log(`[Rate Limit Monitor] ${message}`, data || '');
    }
  }
  
  // 保存原始fetch函数
  const originalFetch = window.fetch;
  
  // 获取域名
  function getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url, window.location.origin);
      return urlObj.hostname;
    } catch (e) {
      return window.location.hostname;
    }
  }

  // 检查是否是completion API请求
  function isCompletionRequest(url) {
    const completionPatterns = [
      /\/api\/organizations\/[^\/]+\/chat_conversations\/[^\/]+\/completion$/,
      /\/api\/organizations\/[^\/]+\/completion$/,
      /\/api\/organizations\/[^\/]+\/retry_completion$/,
      /\/api\/chat\/completions$/,
      /\/api\/completions$/,
      /\/v1\/chat\/completions$/,
      /\/v1\/completions$/
    ];

    return completionPatterns.some(pattern => pattern.test(url));
  }

  // 提取组织ID
  function extractOrgId(url) {
    // FuClaude/Claude API格式: /api/organizations/{orgId}/...
    const match = url.match(/\/api\/organizations\/([^\/]+)/);
    return match ? match[1] : null;
  }
  
  // 解析resetAt时间戳 - 优化版本
  function parseResetAt(response, responseData) {
    try {
      // 方法1: FuClaude格式 - 直接从响应体顶级字段获取
      if (responseData && responseData.resetsAt) {
        log('✅ FuClaude格式成功 - resetsAt:', responseData.resetsAt);
        return responseData.resetsAt;
      }
      
      // 方法2: 从响应头获取
      const retryAfter = response.headers.get('retry-after');
      const rateLimitReset = response.headers.get('x-ratelimit-reset') || 
                            response.headers.get('x-rate-limit-reset') ||
                            response.headers.get('ratelimit-reset');
      
      if (rateLimitReset) {
        const resetValue = parseInt(rateLimitReset);
        if (resetValue > 1000000000) {
          log('✅ 响应头Unix时间戳成功:', resetValue);
          return resetValue;
        } else {
          const calculatedReset = Math.floor(Date.now() / 1000) + resetValue;
          log('✅ 响应头相对秒数成功:', calculatedReset);
          return calculatedReset;
        }
      }
      
      if (retryAfter) {
        const retrySeconds = parseInt(retryAfter);
        if (!isNaN(retrySeconds)) {
          const calculatedReset = Math.floor(Date.now() / 1000) + retrySeconds;
          log('✅ Retry-After成功:', calculatedReset);
          return calculatedReset;
        }
      }
      
      // 方法3: Claude API格式 (嵌套在error.message中)
      if (responseData && responseData.error && responseData.error.message) {
        try {
          const errorMessage = JSON.parse(responseData.error.message);
          if (errorMessage.resetsAt) {
            log('✅ Claude error.message.resetsAt成功:', errorMessage.resetsAt);
            return errorMessage.resetsAt;
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
      
      log('❌ 所有解析方法都失败');
      return null;
      
    } catch (error) {
      log('❌ 解析resetAt时发生错误:', error);
      return null;
    }
  }
  
  // 发送数据到后端
  async function sendToBackend(orgId, resetAt, retryCount = 0) {
    try {
      const payload = {
        orgId: orgId,
        resetAt: resetAt,
        timestamp: Date.now(),
        source: 'server-inject', // 标识来源
        domain: window.location.hostname
      };

      log('📡 发送数据到后端:', payload);

      const response = await fetch(CONFIG.BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        log('✅ 后端发送成功:', result);
        return true;
      } else {
        log('❌ 后端响应错误:', response.status, response.statusText);
        
        // 如果是5xx错误且还有重试次数，则重试
        if (response.status >= 500 && retryCount < CONFIG.RETRY_ATTEMPTS) {
          log(`🔄 ${CONFIG.RETRY_DELAY}ms后重试 (${retryCount + 1}/${CONFIG.RETRY_ATTEMPTS})`);
          setTimeout(() => {
            sendToBackend(orgId, resetAt, retryCount + 1);
          }, CONFIG.RETRY_DELAY);
        }
        
        return false;
      }
    } catch (error) {
      log('❌ 网络错误:', error.message);
      
      // 网络错误也可以重试
      if (retryCount < CONFIG.RETRY_ATTEMPTS) {
        log(`🔄 ${CONFIG.RETRY_DELAY}ms后重试 (${retryCount + 1}/${CONFIG.RETRY_ATTEMPTS})`);
        setTimeout(() => {
          sendToBackend(orgId, resetAt, retryCount + 1);
        }, CONFIG.RETRY_DELAY);
      }
      
      return false;
    }
  }
  
  // 重写fetch函数
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // 检查是否是429状态码
    if (response.status === 429) {
      const url = args[0];
      const domain = getDomainFromUrl(url);
      const orgId = extractOrgId(url);
      const isCompletion = isCompletionRequest(url);

      log('🚫 检测到429错误:', {
        url: url,
        domain: domain,
        orgId: orgId,
        isCompletion: isCompletion
      });
      
      try {
        // 克隆响应以避免消费原始流
        const clonedResponse = response.clone();
        let responseData = null;
        
        // 尝试解析响应体
        const contentType = clonedResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            responseData = await clonedResponse.json();
            log('📋 响应数据:', responseData);
          } catch (e) {
            log('⚠️ JSON解析失败:', e.message);
          }
        }
        
        // 解析resetAt时间戳
        const resetAt = parseResetAt(response, responseData);
        
        // 如果成功获取到orgId和resetAt，发送到后端
        if (orgId && resetAt) {
          log('🎯 准备发送到后端:', { orgId, resetAt });
          await sendToBackend(orgId, resetAt);
        } else {
          log('⚠️ 缺少必要数据，跳过发送:', { orgId, resetAt });
        }
        
      } catch (error) {
        log('❌ 处理429响应时出错:', error);
      }
    }
    
    return response;
  };
  
  // 也监控XMLHttpRequest (如果有使用的话)
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._rateLimitMonitor = { method, url };
    return originalXHROpen.call(this, method, url, ...args);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    const xhr = this;
    
    const originalOnReadyStateChange = xhr.onreadystatechange;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 429) {
        log('🚫 XHR检测到429错误:', xhr._rateLimitMonitor?.url);
        
        const url = xhr._rateLimitMonitor?.url || '';
        const orgId = extractOrgId(url);
        
        if (orgId) {
          let responseData = null;
          try {
            responseData = JSON.parse(xhr.responseText);
          } catch (e) {
            responseData = { text: xhr.responseText };
          }
          
          // 创建模拟Response对象
          const mockResponse = {
            headers: {
              get: (name) => xhr.getResponseHeader(name)
            }
          };
          
          const resetAt = parseResetAt(mockResponse, responseData);
          
          if (resetAt) {
            sendToBackend(orgId, resetAt);
          }
        }
      }
      
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.call(this);
      }
    };
    
    return originalXHRSend.call(this, ...args);
  };
  
  log('✅ Fetch和XHR拦截器已安装');
  
  // 导出配置修改函数（可选）
  window.RateLimitMonitor = {
    updateConfig: function(newConfig) {
      Object.assign(CONFIG, newConfig);
      log('⚙️ 配置已更新:', CONFIG);
    },
    
    getConfig: function() {
      return { ...CONFIG };
    },
    
    // 手动发送测试
    testSend: function(orgId, resetAt) {
      return sendToBackend(orgId || 'test_org_123', resetAt || Math.floor(Date.now() / 1000) + 300);
    }
  };
  
})();

console.log('🚀 Claude Rate Limit Monitor 服务端注入脚本加载完成');
