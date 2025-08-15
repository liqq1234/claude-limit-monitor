# Rate Limit Monitor 安装和使用指南

## 📦 安装步骤

### 1. 下载插件文件
确保你有以下文件：
```
claude-limit-monitor/
├── manifest.json
├── background.js
├── content.js
├── inject.js
├── popup.html
├── popup.js
├── styles.css
├── test.html
└── README.md
```

### 2. 安装到Chrome浏览器

1. **打开Chrome扩展管理页面**
   - 在地址栏输入 `chrome://extensions/`
   - 或者点击 Chrome菜单 → 更多工具 → 扩展程序

2. **启用开发者模式**
   - 在页面右上角找到"开发者模式"开关
   - 点击开启开发者模式

3. **加载扩展**
   - 点击"加载已解压的扩展程序"按钮
   - 选择 `claude-limit-monitor` 文件夹
   - 点击"选择文件夹"

4. **确认安装**
   - 扩展应该出现在扩展列表中
   - 确保扩展已启用（开关为蓝色）

## 🚀 使用方法

### 基本使用

1. **访问支持的网站**
   - Claude AI: https://claude.ai
   - ChatGPT: https://chatgpt.com
   - 或任何可能返回429错误的API网站

2. **自动监控**
   - 插件会自动监控所有HTTP请求
   - 当遇到429状态码时，会自动显示倒计时

3. **查看状态**
   - 点击浏览器工具栏中的插件图标
   - 查看所有域名的限制状态
   - 实时倒计时显示

### 功能说明

#### 🚫 自动检测
- 监控 `fetch()` 请求
- 监控 `XMLHttpRequest` 请求
- 自动解析429响应中的resetAt时间戳

#### ⏰ 倒计时显示
- 页面右上角显示倒计时
- 支持小时、分钟、秒格式
- 自动隐藏过期的限制

#### 💾 数据持久化
- 限制信息保存在本地存储
- 页面刷新后数据不丢失
- 自动清理过期数据

#### 🎨 用户界面
- 现代化设计
- 响应式布局
- 支持暗色主题

## 🧪 测试功能

### 使用测试页面

1. **打开测试页面**
   - 在浏览器中打开 `test.html` 文件
   - 或者创建一个本地服务器

2. **检查插件状态**
   - 点击"重新检查"按钮
   - 确认扩展环境正常

3. **模拟429错误**
   - 点击不同的模拟按钮
   - 观察插件的响应和UI显示

4. **查看日志**
   - 监控控制台输出
   - 查看页面上的日志信息

### 手动测试

```javascript
// 在浏览器控制台中执行
window.dispatchEvent(new CustomEvent('rateLimitDetected', {
  detail: {
    url: 'https://api.example.com/test',
    domain: 'api.example.com',
    resetAt: Math.floor(Date.now() / 1000) + 300, // 5分钟后
    status: 429,
    timestamp: Date.now()
  }
}));
```

## 🔧 故障排除

### 常见问题

#### 1. 插件不工作
**症状**: 没有检测到429错误
**解决方案**:
- 检查扩展是否已启用
- 刷新页面重新加载content script
- 查看浏览器控制台是否有错误

#### 2. UI不显示
**症状**: 检测到429但没有显示倒计时
**解决方案**:
- 检查页面是否有CSS冲突
- 确认content script已正确注入
- 查看元素是否被其他样式覆盖

#### 3. 时间戳解析失败
**症状**: 显示"Reset time unknown"
**解决方案**:
- 检查API响应格式
- 查看控制台日志了解解析过程
- 可能需要添加新的解析规则

#### 4. 数据不持久化
**症状**: 刷新页面后数据丢失
**解决方案**:
- 检查Chrome存储权限
- 确认background script正常运行
- 查看chrome://extensions/页面是否有错误

### 调试技巧

#### 1. 查看控制台日志
```javascript
// 开启详细日志
localStorage.setItem('rateLimitDebug', 'true');
```

#### 2. 检查存储数据
```javascript
// 查看存储的限制数据
chrome.storage.local.get(null, console.log);
```

#### 3. 手动清除数据
```javascript
// 清除所有限制数据
chrome.storage.local.clear();
```

## 📝 配置选项

### 自定义域名匹配
在 `manifest.json` 中修改 `matches` 数组：
```json
"matches": [
  "https://your-api.com/*",
  "https://another-api.com/*"
]
```

### 修改UI样式
编辑 `styles.css` 文件来自定义外观：
- 位置: 修改 `top`, `right` 属性
- 颜色: 修改 `background`, `color` 属性
- 大小: 修改 `padding`, `font-size` 属性

### 添加新的解析规则
在 `inject.js` 的 `parseResetAt` 函数中添加新的解析逻辑。

## 🔒 隐私说明

- 插件只在本地处理数据
- 不会向外部服务器发送任何信息
- 所有数据存储在浏览器本地
- 不收集用户个人信息

## 📞 支持

如果遇到问题或有建议，请：
1. 查看控制台错误信息
2. 尝试重新安装插件
3. 使用测试页面验证功能
4. 提交详细的错误报告

## 🔄 更新

要更新插件：
1. 下载新版本文件
2. 在扩展管理页面点击"重新加载"按钮
3. 或者重新加载整个扩展文件夹
