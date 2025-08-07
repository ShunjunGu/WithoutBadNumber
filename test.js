#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function testMcpServer() {
  console.log('正在测试MCP骚扰电话查询服务...\n');
  
  const child = spawn('node', [path.join(__dirname, 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // 模拟MCP初始化消息
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  // 模拟工具列表请求
  const listToolsMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };

  child.stdin.write(JSON.stringify(initMessage) + '\n');
  child.stdin.write(JSON.stringify(listToolsMessage) + '\n');

  child.stdout.on('data', (data) => {
    console.log('服务器响应:', data.toString());
  });

  child.stderr.on('data', (data) => {
    console.error('错误:', data.toString());
  });

  child.on('close', (code) => {
    console.log(`\n测试完成，退出码: ${code}`);
  });

  // 5秒后结束测试
  setTimeout(() => {
    child.kill();
  }, 5000);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testMcpServer();
}