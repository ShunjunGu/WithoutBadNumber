# MCP骚扰电话查询服务

这是一个基于笒鬼鬼API的MCP服务器，用于查询中国手机号码是否为骚扰电话，提供号码归属地和各大安全软件的标记信息。

## 功能特点

- 🔍 查询中国手机号码是否为骚扰电话
- 📍 获取号码归属地信息（省份、城市、运营商）
- 🛡️ 查看各大安全软件的标记结果（360手机卫士、搜狗号码通、百度手机卫士等）
- 🛠️ 提供独立工具 `query_phone_address` 用于仅查询号码归属地
- 🌐 提供 `query_ip_location` 工具用于查询IP地址归属地
- 🚀 支持npx直接运行，无需安装

## 安装和使用

### 在Cherry Studio中配置

#### 使用npx（推荐）
1. 打开Cherry Studio设置
2. 进入"MCP服务器"配置页面
3. 点击"添加MCP服务器"
4. 填写以下信息：
   - 名称：骚扰电话查询
   - 命令：`npx -y mcp-saorao-phone`
   - 参数：留空

#### 使用本地路径（开发测试）
1. 打开Cherry Studio设置
2. 进入"MCP服务器"配置页面
3. 点击"添加MCP服务器"
4. 填写以下信息：
   - 名称：骚扰电话查询（本地）
   - 命令：`node`
   - 参数：`/Users/gushunjun/Documents/WithoutBadNumber/index.js`

### 在Claude Desktop中配置

编辑`claude_desktop_config.json`文件：

#### 使用npx（推荐）
```json
{
  "mcpServers": {
    "saorao-phone": {
      "command": "npx",
      "args": ["-y", "mcp-saorao-phone"]
    }
  }
}
```

#### 使用本地路径（开发时）
```json
{
  "mcpServers": {
    "saorao-phone": {
      "command": "node",
      "args": ["/Users/gushunjun/Documents/WithoutBadNumber/index.js"]
    }
  }
}
```

配置文件路径：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

### 在其他平台使用

任何支持MCP协议的平台都可以使用以下命令：

```bash
npx -y mcp-saorao-phone
```

## API接口说明

本服务支持两种API查询模式：

1. **骚扰电话查询**：使用笒鬼鬼API（https://api.cenguigui.cn/api/saorao/）
2. **手机号码归属地查询**：使用360手机号码归属地API（https://cx.shouji.360.cn/phonearea.php?number=手机号）
3. **IP地址归属地查询**：使用太平洋网络IP查询API（http://whois.pconline.com.cn/ipJson.jsp）

### 提供的工具

本服务提供四个MCP工具：

1. **query_phone_number**：主工具，可通过 `apiType` 参数查询骚扰电话或手机号码归属地
2. **query_phone_address**：专用工具，仅查询手机号码归属地（内部调用360 API）
3. **url_to_ip**：将网址转换为 IP 地址，使用 ping 命令解析域名
4. **query_ip_location**：查询IP地址归属地信息（省市、运营商等）

### 查询参数

#### query_phone_number 工具
- `phoneNumber`：要查询的中国手机号码（11位数字）
- `apiType`（可选）：API类型，可选值：
  - `saorao`（默认）：查询是否为骚扰电话
  - `address`：查询手机号码归属地信息

#### query_phone_address 工具
- `phoneNumber`：要查询的中国手机号码（11位数字）

#### url_to_ip 工具
- `url`：要解析的域名，例如 `www.example.com`

#### query_ip_location 工具
- `ipAddress`：要查询的IPv4地址，例如 `8.8.8.8`

### 返回结果

#### 骚扰电话查询（apiType=saorao 或默认）

```json
{
  "手机号码": "13800138000",
  "归属地": "北京 北京",
  "运营商": "中国移动",
  "安全软件标记": [
    {
      "软件名称": "360手机卫士",
      "标记结果": "骚扰电话"
    },
    {
      "软件名称": "搜狗号码通",
      "标记结果": "正常号码"
    },
    {
      "软件名称": "百度手机卫士",
      "标记结果": "骚扰电话"
    }
  ],
  "查询来源": "cenguigui.cn骚扰电话API"
}
```

#### 手机号码归属地查询（apiType=address）

```json
{
  "手机号码": "13800138000",
  "归属地": "北京 北京",
  "运营商": "中国移动",
  "查询来源": "360手机号码归属地API"
}
```

## 开发说明

### 本地开发

```bash
# 克隆项目
git clone <repository-url>
cd mcp-saorao-phone

# 安装依赖
npm install

# 运行开发模式
npm run dev
```

### 发布到npm

```bash
npm publish
```

## 注意事项

- 本服务仅支持查询中国手机号码（11位数字）
- API服务由笒鬼鬼、360及太平洋网络提供，使用时请遵守各自的服务条款
- 查询结果仅供参考，最终判断请以实际情况为准

## 配置验证和故障排除

### 快速验证配置

运行验证脚本检查本地配置：

```bash
node validate-config.js
```

### 常见配置问题

#### 1. 路径问题
确保在配置中使用绝对路径：
- macOS/Linux: `/Users/用户名/path/to/mcp-saorao-phone/index.js`
- Windows: `C:\Users\用户名\path\to\mcp-saorao-phone\index.js`

#### 2. 权限问题
如果遇到权限错误：
```bash
chmod +x index.js
```

#### 3. Node.js版本要求
确保Node.js版本 >= 18.0.0：
```bash
node --version
```

### 配置模板文件

项目提供了完整的配置示例文件：
- `mcp-config-examples.json` - 包含所有平台的配置模板
- `validate-config.js` - 自动验证配置正确性

### 手动测试

使用本地路径测试MCP服务器：

```bash
# 使用本地路径
node /Users/gushunjun/Documents/WithoutBadNumber/index.js

# 或使用npx（发布后）
npx -y mcp-saorao-phone
```

## 许可证

MIT License