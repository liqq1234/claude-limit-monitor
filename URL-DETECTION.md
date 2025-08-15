# URL 检测和解析机制详解

## 🎯 你的URL格式支持

插件现在完全支持你的 `demo.fuclaude.com` URL格式：

```
https://demo.fuclaude.com/api/organizations/7b8556b4-d293-4e5c-af82-ba03e4d26238/chat_conversations/05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc/completion
```

## 🔍 URL检测机制

### 1. 自动识别API类型

插件会自动识别不同的API URL格式：

```javascript
function isCompletionRequest(url) {
  const completionPatterns = [
    /\/api\/organizations\/[^\/]+\/chat_conversations\/[^\/]+\/completion$/,  // 你的格式
    /\/api\/organizations\/[^\/]+\/completion$/,                              // Claude格式
    /\/api\/organizations\/[^\/]+\/retry_completion$/,                        // 重试格式
    /\/api\/chat\/completions$/,                                              // OpenAI格式
    /\/api\/completions$/,                                                    // 通用格式
    /\/v1\/chat\/completions$/,                                               // OpenAI v1
    /\/v1\/completions$/                                                      // OpenAI v1
  ];
  
  return completionPatterns.some(pattern => pattern.test(url));
}
```

### 2. 提取组织ID和会话ID

对于你的URL格式，插件会提取：

```javascript
// FuClaude/Claude API格式: /api/organizations/{orgId}/chat_conversations/{convId}/completion
const fuclaudeMatch = url.match(/\/api\/organizations\/([^\/]+)\/chat_conversations\/([^\/]+)\/completion/);
if (fuclaudeMatch) {
  info.orgId = fuclaudeMatch[1];           // 7b8556b4-d293-4e5c-af82-ba03e4d26238
  info.conversationId = fuclaudeMatch[2];  // 05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc
  info.apiType = 'fuclaude-chat';
  return info;
}
```

## 📊 检测到的信息

当插件检测到你的URL时，会提取以下信息：

### URL分析结果
```javascript
{
  url: "https://demo.fuclaude.com/api/organizations/7b8556b4-d293-4e5c-af82-ba03e4d26238/chat_conversations/05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc/completion",
  domain: "demo.fuclaude.com",
  apiType: "fuclaude-chat",
  orgId: "7b8556b4-d293-4e5c-af82-ba03e4d26238",
  conversationId: "05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc",
  isCompletion: true
}
```

## 🔧 resetAt 解析

插件支持多种resetAt格式，适配你的API响应：

### 1. 响应头检测
```http
x-ratelimit-reset: 1703123456
x-rate-limit-reset: 1703123456
ratelimit-reset: 1703123456
retry-after: 300
```

### 2. 响应体解析

#### Claude/FuClaude 格式
```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "{\"type\":\"exceeded_limit\",\"resetsAt\":1703123456}"
  }
}
```

#### 扩展支持格式
```json
{
  "error": {
    "message": "{\"resetAt\":1703123456,\"organization_id\":\"7b8556b4-d293-4e5c-af82-ba03e4d26238\"}"
  }
}
```

### 3. 正则表达式匹配

如果JSON解析失败，插件会使用正则表达式：

```javascript
const timestampPatterns = [
  /resetsAt["\s:]*(\d{10})/,     // resetsAt: 1703123456
  /resetAt["\s:]*(\d{10})/,      // resetAt: 1703123456
  /reset_time["\s:]*(\d{10})/,   // reset_time: 1703123456
  /"reset"["\s:]*(\d{10})/       // "reset": 1703123456
];
```

## 🧪 测试你的URL格式

### 1. 使用测试页面

打开 `test-fuclaude.html` 并点击 "🎯 测试你的URL格式" 按钮。

### 2. 手动测试

在浏览器控制台中运行：

```javascript
// 模拟你的具体URL格式
window.dispatchEvent(new CustomEvent('rateLimitDetected', {
  detail: {
    url: 'https://demo.fuclaude.com/api/organizations/7b8556b4-d293-4e5c-af82-ba03e4d26238/chat_conversations/05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc/completion',
    domain: 'demo.fuclaude.com',
    resetAt: Math.floor(Date.now() / 1000) + 300,
    status: 429,
    orgId: '7b8556b4-d293-4e5c-af82-ba03e4d26238',
    conversationId: '05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc',
    apiType: 'fuclaude-chat',
    timestamp: Date.now()
  }
}));
```

### 3. 验证检测结果

检查控制台输出，应该看到：

```
Rate Limit Monitor: 429 detected {
  url: "https://demo.fuclaude.com/api/organizations/7b8556b4-d293-4e5c-af82-ba03e4d26238/chat_conversations/05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc/completion",
  domain: "demo.fuclaude.com",
  apiType: "fuclaude-chat",
  orgId: "7b8556b4-d293-4e5c-af82-ba03e4d26238",
  conversationId: "05c992c8-0f5a-4295-9a3f-e2e8e75c5dcc",
  isCompletion: true
}
```

## 🔄 动态组织ID和会话ID支持

插件完全支持动态的组织ID和会话ID：

### 不同组织ID示例
```
https://demo.fuclaude.com/api/organizations/12345678-abcd-efgh-ijkl-123456789012/chat_conversations/87654321-zyxw-vuts-rqpo-987654321098/completion
```

### 不同会话ID示例
```
https://demo.fuclaude.com/api/organizations/7b8556b4-d293-4e5c-af82-ba03e4d26238/chat_conversations/new-conversation-id-here/completion
```

插件会自动提取并记录这些ID，无需任何配置。

## 📝 日志记录

插件会详细记录检测过程：

```javascript
console.log('Rate Limit Monitor: 429 detected', {
  url: url,
  domain: domain,
  apiType: apiInfo.apiType,
  orgId: apiInfo.orgId,
  conversationId: apiInfo.conversationId,
  isCompletion: apiInfo.isCompletion
});
```

## 🛠️ 自定义扩展

如果你的API使用其他URL格式，可以在 `inject.js` 中添加：

### 添加新的URL模式
```javascript
// 在 extractApiInfo 函数中添加
const customMatch = url.match(/\/api\/custom\/([^\/]+)\/chat\/([^\/]+)/);
if (customMatch) {
  info.orgId = customMatch[1];
  info.conversationId = customMatch[2];
  info.apiType = 'custom-api';
  return info;
}
```

### 添加新的响应格式
```javascript
// 在 parseResetAt 函数中添加
if (responseData.custom_reset_field) {
  resetAt = responseData.custom_reset_field;
}
```

## ✅ 验证清单

- [x] 支持你的URL格式：`/api/organizations/{orgId}/chat_conversations/{convId}/completion`
- [x] 自动提取组织ID和会话ID
- [x] 支持动态ID（不同的组织和会话）
- [x] 多种resetAt解析方式
- [x] 详细的日志记录
- [x] 专用测试功能
- [x] 错误处理和容错机制

现在插件已经完全支持你的URL格式了！🎉
