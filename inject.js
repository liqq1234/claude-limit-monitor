// Rate Limit Monitor - Fetch Interceptor
(function() {
  'use strict';
  
  console.log('Rate Limit Monitor: Inject script loaded');
  
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

  // 提取组织ID和会话ID（如果存在）
  function extractApiInfo(url) {
    const info = {
      isCompletion: isCompletionRequest(url),
      orgId: null,
      conversationId: null,
      apiType: 'unknown'
    };

    // FuClaude/Claude API格式: /api/organizations/{orgId}/chat_conversations/{convId}/completion
    const fuclaudeMatch = url.match(/\/api\/organizations\/([^\/]+)\/chat_conversations\/([^\/]+)\/completion/);
    if (fuclaudeMatch) {
      info.orgId = fuclaudeMatch[1];
      info.conversationId = fuclaudeMatch[2];
      info.apiType = 'fuclaude-chat';
      return info;
    }

    // Claude API格式: /api/organizations/{orgId}/completion
    const claudeMatch = url.match(/\/api\/organizations\/([^\/]+)\/completion/);
    if (claudeMatch) {
      info.orgId = claudeMatch[1];
      info.apiType = 'claude-completion';
      return info;
    }

    // OpenAI API格式
    if (url.includes('/chat/completions')) {
      info.apiType = 'openai-chat';
    } else if (url.includes('/completions')) {
      info.apiType = 'openai-completion';
    }

    return info;
  }
  
  // 解析resetAt时间戳
  function parseResetAt(response, responseData) {
    let resetAt = null;
    
    try {
      // 方法1: 从响应头获取
      const retryAfter = response.headers.get('retry-after');
      const rateLimitReset = response.headers.get('x-ratelimit-reset') || 
                            response.headers.get('x-rate-limit-reset') ||
                            response.headers.get('ratelimit-reset');
      
      if (rateLimitReset) {
        // 可能是Unix时间戳或相对秒数
        const resetValue = parseInt(rateLimitReset);
        if (resetValue > 1000000000) {
          // 看起来像Unix时间戳
          resetAt = resetValue;
        } else {
          // 相对秒数
          resetAt = Math.floor(Date.now() / 1000) + resetValue;
        }
      } else if (retryAfter) {
        // Retry-After头，通常是秒数
        const retrySeconds = parseInt(retryAfter);
        if (!isNaN(retrySeconds)) {
          resetAt = Math.floor(Date.now() / 1000) + retrySeconds;
        }
      }
      
      // 方法2: 从响应体解析
      if (!resetAt && responseData) {
        // Claude API格式 (包括FuClaude)
        if (responseData.error && responseData.error.message) {
          try {
            const errorMessage = JSON.parse(responseData.error.message);
            if (errorMessage.resetsAt) {
              resetAt = errorMessage.resetsAt;
            }
            // 检查其他可能的字段名
            if (errorMessage.resetAt) {
              resetAt = errorMessage.resetAt;
            }
            if (errorMessage.reset_time) {
              resetAt = errorMessage.reset_time;
            }
          } catch (e) {
            // 尝试正则匹配时间戳
            const timestampPatterns = [
              /resetsAt["\s:]*(\d{10})/,
              /resetAt["\s:]*(\d{10})/,
              /reset_time["\s:]*(\d{10})/,
              /"reset"["\s:]*(\d{10})/
            ];

            for (const pattern of timestampPatterns) {
              const match = responseData.error.message.match(pattern);
              if (match) {
                resetAt = parseInt(match[1]);
                break;
              }
            }
          }
        }
        
        // OpenAI API格式
        if (responseData.error && responseData.error.reset_time) {
          resetAt = responseData.error.reset_time;
        }
        
        // 通用格式检查
        if (responseData.reset_time) {
          resetAt = responseData.reset_time;
        }
        if (responseData.resetAt) {
          resetAt = responseData.resetAt;
        }
        if (responseData.resetsAt) {
          resetAt = responseData.resetsAt;
        }
        
        // 检查嵌套对象
        if (responseData.message_limit && responseData.message_limit.resetsAt) {
          resetAt = responseData.message_limit.resetsAt;
        }
      }
      
    } catch (error) {
      console.error('Error parsing resetAt:', error);
    }
    
    return resetAt;
  }
  
  // 重写fetch函数
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    // 检查是否是429状态码
    if (response.status === 429) {
      const url = args[0];
      const domain = getDomainFromUrl(url);
      const apiInfo = extractApiInfo(url);

      console.log('Rate Limit Monitor: 429 detected', {
        url: url,
        domain: domain,
        apiType: apiInfo.apiType,
        orgId: apiInfo.orgId,
        conversationId: apiInfo.conversationId,
        isCompletion: apiInfo.isCompletion
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
          } catch (e) {
            console.warn('Failed to parse JSON response:', e);
          }
        } else if (contentType.includes('text/')) {
          try {
            const text = await clonedResponse.text();
            // 尝试解析为JSON
            try {
              responseData = JSON.parse(text);
            } catch (e) {
              responseData = { text: text };
            }
          } catch (e) {
            console.warn('Failed to parse text response:', e);
          }
        }
        
        // 解析resetAt时间戳
        const resetAt = parseResetAt(response, responseData);
        
        // 发送自定义事件
        const eventData = {
          url: url,
          domain: domain,
          resetAt: resetAt,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          responseData: responseData,
          timestamp: Date.now(),
          // 添加API信息
          apiInfo: apiInfo,
          // 添加FuClaude特定信息
          orgId: apiInfo.orgId,
          conversationId: apiInfo.conversationId,
          apiType: apiInfo.apiType
        };
        
        console.log('Rate Limit Monitor: Dispatching event', eventData);
        
        window.dispatchEvent(new CustomEvent('rateLimitDetected', {
          detail: eventData
        }));
        
      } catch (error) {
        console.error('Rate Limit Monitor: Error processing 429 response:', error);
        
        // 即使解析失败也发送基本事件
        window.dispatchEvent(new CustomEvent('rateLimitDetected', {
          detail: {
            url: url,
            domain: domain,
            resetAt: null,
            status: response.status,
            timestamp: Date.now(),
            error: error.message
          }
        }));
      }
    }
    
    return response;
  };
  
  // 也监控XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._rateLimitMonitor = { method, url };
    return originalXHROpen.call(this, method, url, ...args);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    const xhr = this;
    
    // 添加状态变化监听
    const originalOnReadyStateChange = xhr.onreadystatechange;
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 429) {
        console.log('Rate Limit Monitor: XHR 429 detected', xhr._rateLimitMonitor?.url);
        
        const url = xhr._rateLimitMonitor?.url || '';
        const domain = getDomainFromUrl(url);
        
        let responseData = null;
        try {
          responseData = JSON.parse(xhr.responseText);
        } catch (e) {
          responseData = { text: xhr.responseText };
        }
        
        // 创建模拟Response对象来复用解析逻辑
        const mockResponse = {
          headers: {
            get: (name) => xhr.getResponseHeader(name)
          }
        };
        
        const resetAt = parseResetAt(mockResponse, responseData);
        
        window.dispatchEvent(new CustomEvent('rateLimitDetected', {
          detail: {
            url: url,
            domain: domain,
            resetAt: resetAt,
            status: xhr.status,
            responseData: responseData,
            timestamp: Date.now(),
            source: 'XMLHttpRequest'
          }
        }));
      }
      
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.call(this);
      }
    };
    
    return originalXHRSend.call(this, ...args);
  };
  
  console.log('Rate Limit Monitor: Fetch and XHR interceptors installed');
  
})();
