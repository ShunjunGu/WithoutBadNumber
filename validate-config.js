#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateConfig() {
  console.log('🔍 MCP骚扰电话查询服务配置验证\n');
  
  const projectPath = __dirname;
  const indexPath = path.join(projectPath, 'index.js');
  
  // 验证项目文件
  console.log('📁 项目文件检查:');
  const requiredFiles = ['index.js', 'package.json'];
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    const filePath = path.join(projectPath, file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${file} 存在`);
    } else {
      console.log(`  ❌ ${file} 不存在`);
      allFilesExist = false;
    }
  });
  
  // 验证Node.js可用性
  console.log('\n🟢 Node.js环境检查:');
  console.log(`  Node.js版本: ${process.version}`);
  
  // 输出配置模板
  console.log('\n📋 本地配置模板（复制到相应配置文件）:');
  console.log(JSON.stringify({
    "mcpServers": {
      "saorao-phone": {
        "command": "node",
        "args": [indexPath]
      }
    }
  }, null, 2));
  
  // 检查权限
  console.log('\n🔐 文件权限检查:');
  try {
    fs.accessSync(indexPath, fs.constants.R_OK);
    console.log('  ✅ index.js 可读');
  } catch (err) {
    console.log('  ❌ index.js 不可读');
  }
  
  console.log('\n✨ 验证完成！请将上述配置模板复制到您的LLM客户端配置文件中。');
  console.log('📖 详细配置说明请参考 README.md 文件。');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateConfig();
}