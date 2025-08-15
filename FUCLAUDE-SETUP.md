# FuClaude Demo 监控设置指南

## 🎯 专为 demo.fuclaude.com 配置

这个指南将帮你快速设置Rate Limit Monitor来监控 `demo.fuclaude.com` 的429错误。

## ✅ 已完成的配置

插件已经预配置支持 `demo.fuclaude.com`，包括：

### 1. Manifest 配置
```json
{
  "content_scripts": [
    {
      "matches": [
        "https://claude.ai/*",
        "https://api.anthropic.com/*",
        "https://chatgpt.com/*",
        "https://api.openai.com/*",
        "https://demo.fuclaude.com/*",  // ✅ 已添加
        "*://*/*"
      ]
    }
  ]
}
```

### 2. Background Script 配置
- ✅ Tab查询逻辑已包含 `demo.fuclaude.com`
- ✅ 消息传递机制已支持该域名
- ✅ 存储和清理逻辑已适配

### 3. 专用测试页面
- ✅ 创建了 `test-fuclaude.html` 专用测试页面
- ✅ 包含FuClaude特定的API模拟
- ✅ 支持多种429错误场景测试

## 🚀 快速开始

### 步骤1: 安装插件
```bash
1. 打开 chrome://extensions/
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 claude-limit-monitor 文件夹
```

### 步骤2: 验证配置
1. **检查扩展状态**
   - 确认插件在扩展列表中显示为已启用
   - 查看是否有任何错误信息

2. **测试域名支持**
   - 在浏览器中打开 `test-fuclaude.html`
   - 点击"检查域名支持"按钮
   - 确认显示域名匹配信息

### 步骤3: 功能测试
使用专用测试页面验证功能：

```javascript
// 在 demo.fuclaude.com 页面的控制台中运行
window.dispatchEvent(new CustomEvent('rateLimitDetected', {
  detail: {
    url: 'https://demo.fuclaude.com/api/chat',
    domain: 'demo.fuclaude.com',
    resetAt: Math.floor(Date.now() / 1000) + 300, // 5分钟后
    status: 429,
    timestamp: Date.now()
  }
}));
```

## 🧪 FuClaude 特定测试

### 1. Chat API 限制测试
```javascript
// 模拟聊天API限制
function testFuClaudeChatLimit() {
  window.dispatchEvent(new CustomEvent('rateLimitDetected', {
    detail: {
      url: 'https://demo.fuclaude.com/api/chat/completions',
      domain: 'demo.fuclaude.com',
      resetAt: Math.floor(Date.now() / 1000) + 300,
      status: 429,
      responseData: {
        error: {
          type: 'rate_limit_error',
          message: 'Chat API rate limit exceeded'
        }
      }
    }
  }));
}
```

### 2. Completion API 限制测试
```javascript
// 模拟补全API限制
function testFuClaudeCompletionLimit() {
  window.dispatchEvent(new CustomEvent('rateLimitDetected', {
    detail: {
      url: 'https://demo.fuclaude.com/api/completions',
      domain: 'demo.fuclaude.com',
      resetAt: Math.floor(Date.now() / 1000) + 600,
      status: 429,
      headers: {
        'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 600,
        'x-ratelimit-remaining': '0'
      }
    }
  }));
}
```

## 🔧 自定义配置

### 添加更多FuClaude子域名
如果需要监控更多FuClaude相关域名，编辑 `manifest.json`：

```json
"matches": [
  "https://demo.fuclaude.com/*",
  "https://api.fuclaude.com/*",      // 添加API域名
  "https://beta.fuclaude.com/*",     // 添加测试域名
  "https://*.fuclaude.com/*"         // 通配符匹配所有子域名
]
```

### 自定义解析规则
如果FuClaude使用特殊的429响应格式，在 `inject.js` 中添加解析规则：

```javascript
// 在 parseResetAt 函数中添加
if (responseData && responseData.fuclaude_reset_time) {
  resetAt = responseData.fuclaude_reset_time;
}

// 或者检查特定的错误格式
if (responseData && responseData.error && responseData.error.fuclaude_data) {
  const fuclaudeData = responseData.error.fuclaude_data;
  if (fuclaudeData.reset_timestamp) {
    resetAt = fuclaudeData.reset_timestamp;
  }
}
```

## 📊 监控验证

### 1. 实时监控
访问 `https://demo.fuclaude.com` 并：
- 发送API请求直到触发429限制
- 观察插件是否自动显示倒计时
- 检查倒计时是否准确

### 2. 存储验证
在浏览器控制台中检查存储：
```javascript
chrome.storage.local.get(null, (result) => {
  console.log('存储的限制数据:', result);
  
  // 查找FuClaude相关的限制
  Object.keys(result).forEach(key => {
    if (key.includes('fuclaude')) {
      console.log(`FuClaude限制: ${key}`, result[key]);
    }
  });
});
```

### 3. UI验证
- ✅ 倒计时显示在页面右上角
- ✅ 显示正确的域名 "demo.fuclaude.com"
- ✅ 时间格式正确（小时:分钟:秒）
- ✅ 限制解除后自动隐藏

## 🐛 故障排除

### 常见问题

#### 1. 插件不检测FuClaude的429错误
**可能原因**:
- FuClaude使用了特殊的响应格式
- 请求被其他拦截器处理

**解决方案**:
```javascript
// 在FuClaude页面控制台中检查fetch是否被拦截
console.log('Fetch function:', window.fetch.toString());
// 应该包含 'originalFetch' 字符串

// 手动触发测试
window.dispatchEvent(new CustomEvent('rateLimitDetected', {
  detail: {
    url: window.location.href,
    domain: 'demo.fuclaude.com',
    resetAt: Math.floor(Date.now() / 1000) + 60,
    status: 429
  }
}));
```

#### 2. 时间戳解析失败
**检查FuClaude的响应格式**:
```javascript
// 在网络面板中查看429响应
// 或者在控制台中模拟
fetch('/api/test').then(response => {
  if (response.status === 429) {
    console.log('Headers:', [...response.headers.entries()]);
    return response.json();
  }
}).then(data => {
  console.log('Response body:', data);
});
```

#### 3. UI不显示
**检查CSS冲突**:
```javascript
// 检查元素是否存在
const ui = document.getElementById('rate-limit-monitor-ui');
console.log('UI element:', ui);

// 检查样式
if (ui) {
  console.log('UI styles:', window.getComputedStyle(ui));
}
```

## 📞 支持

如果在配置FuClaude监控时遇到问题：

1. **检查控制台错误**
   - 打开开发者工具
   - 查看Console面板的错误信息

2. **使用测试页面**
   - 打开 `test-fuclaude.html`
   - 运行所有测试功能
   - 查看日志输出

3. **验证网络请求**
   - 在Network面板中查看429响应
   - 确认响应格式和头部信息

4. **手动测试**
   - 使用提供的JavaScript代码片段
   - 在FuClaude页面控制台中测试

## 🔄 更新配置

如果FuClaude更改了API格式或域名：

1. **更新manifest.json**中的matches数组
2. **修改inject.js**中的解析逻辑
3. **更新background.js**中的域名检查
4. **重新加载扩展**

记住：每次修改后都要在扩展管理页面点击"重新加载"按钮！
