// Claude Rate Limit Monitor - 控制台注入版本
// 复制这段代码到浏览器控制台中运行

// 检查是否已经注入
if (window.RateLimitMonitorInjected) {
  console.log('⚠️ Rate Limit Monitor 已经在运行中');
} else {
  console.log('🚀 开始注入 Rate Limit Monitor...');
  
  // 标记已注入
  window.RateLimitMonitorInjected = true;
  
  (function() {
    'use strict';
    
    console.log('🚫 Claude Rate Limit Monitor - 控制台版本已加载');
    
    // 配置 - 请修改为你的后端地址
    const CONFIG = {
      BACKEND_URL: 'http://localhost:8787/api/rate-limit', // 修改这里！
      DEBUG: true,
      RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
    };
    
    // 显示配置
    console.log('📋 当前配置:', CONFIG);
    console.log('💡 要修改配置，请运行: window.RateLimitMonitor.updateConfig({BACKEND_URL: "新地址"})');
    
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
      const match = url.match(/\/api\/organizations\/([^\/]+)/);
      return match ? match[1] : null;
    }
    
    // 解析resetAt时间戳
    function parseResetAt(response, responseData) {
      try {
        // 方法1: FuClaude格式
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
        
        // 方法3: Claude API格式
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
          source: 'console-inject',
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
          console.log('🎉 Rate Limit数据发送成功!', payload);
          return true;
        } else {
          log('❌ 后端响应错误:', response.status, response.statusText);
          console.error('❌ 后端响应错误:', response.status, response.statusText);

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
        console.error('❌ 网络错误:', error.message);

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
        
        console.log('🚫 检测到Rate Limit!', {
          url: url,
          orgId: orgId,
          domain: domain
        });
        
        try {
          const clonedResponse = response.clone();
          let responseData = null;
          
          const contentType = clonedResponse.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            try {
              responseData = await clonedResponse.json();
              log('📋 响应数据:', responseData);
            } catch (e) {
              log('⚠️ JSON解析失败:', e.message);
            }
          }
          
          const resetAt = parseResetAt(response, responseData);
          
          if (orgId && resetAt) {
            log('🎯 准备发送到后端:', { orgId, resetAt });
            console.log('📡 发送Rate Limit数据到后端...', { orgId, resetAt });

            // 先在控制台记录数据（备用方案）
            console.log('📋 Rate Limit数据记录:', {
              orgId: orgId,
              resetAt: resetAt,
              resetTime: new Date(resetAt * 1000).toLocaleString(),
              timestamp: Date.now(),
              url: url,
              domain: domain
            });

            await sendToBackend(orgId, resetAt);
          } else {
            log('⚠️ 缺少必要数据，跳过发送:', { orgId, resetAt });
            console.warn('⚠️ 缺少必要数据，跳过发送:', { orgId, resetAt });
          }
          
        } catch (error) {
          log('❌ 处理429响应时出错:', error);
          console.error('❌ 处理429响应时出错:', error);
        }
      }
      
      return response;
    };
    
    // 导出控制接口
    window.RateLimitMonitor = {
      updateConfig: function(newConfig) {
        Object.assign(CONFIG, newConfig);
        log('⚙️ 配置已更新:', CONFIG);
        console.log('⚙️ 配置已更新:', CONFIG);
      },
      
      getConfig: function() {
        return { ...CONFIG };
      },
      
      testSend: function(orgId, resetAt) {
        console.log('🧪 开始测试发送...');
        return sendToBackend(orgId || 'test_org_123', resetAt || Math.floor(Date.now() / 1000) + 300);
      },
      
      status: function() {
        console.log('📊 Rate Limit Monitor 状态:');
        console.log('✅ 已注入并运行');
        console.log('📋 当前配置:', CONFIG);
        console.log('🌐 当前域名:', window.location.hostname);
      }
    };
    
    log('✅ Fetch拦截器已安装');
    console.log('✅ Rate Limit Monitor 注入成功!');
    console.log('💡 使用 window.RateLimitMonitor.status() 查看状态');
    console.log('💡 使用 window.RateLimitMonitor.testSend() 测试发送');
    
  })();
}

// 显示使用说明
console.log(`
🎯 Rate Limit Monitor 使用说明:

1. 📋 查看状态: window.RateLimitMonitor.status()
2. ⚙️ 修改配置: window.RateLimitMonitor.updateConfig({BACKEND_URL: "新地址"})
3. 🧪 测试发送: window.RateLimitMonitor.testSend()
4. 📊 查看配置: window.RateLimitMonitor.getConfig()

现在可以正常使用网站，当触发429错误时会自动发送数据到后端！
`);

// 返回成功状态，避免控制台显示 undefined
"✅ Rate Limit Monitor 注入完成！";
