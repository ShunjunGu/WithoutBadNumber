#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

class SaoraoPhoneServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-saorao-phone',
        version: '1.2.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query_phone_number',
          description: '查询中国手机号码是否为骚扰电话，返回号码归属地和各大安全软件的标记信息',
          inputSchema: {
            type: 'object',
            properties: {
              phoneNumber: {
                type: 'string',
                description: '要查询的中国手机号码（11位数字）',
              },
              apiType: {
                type: 'string',
                description: 'API类型：saorao(骚扰电话查询) 或 address(归属地查询)，默认为saorao',
                enum: ['saorao', 'address'],
                default: 'saorao'
              }
            },
            required: ['phoneNumber'],
          },
        },
        {
          name: 'query_phone_address',
          description: '查询中国手机号码归属地（省、市、运营商）',
          inputSchema: {
            type: 'object',
            properties: {
              phoneNumber: {
                type: 'string',
                description: '要查询的中国手机号码（11位数字）'
              }
            },
            required: ['phoneNumber']
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      if (toolName !== 'query_phone_number' && toolName !== 'query_phone_address') {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      let { phoneNumber, apiType = 'saorao' } = request.params.arguments;
      if (toolName === 'query_phone_address') {
        apiType = 'address';
      }

      if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
        throw new Error('请输入有效的11位中国手机号码');
      }

      try {
        let result;

        if (apiType === 'address') {
          // 使用360手机号码归属地API
          const response = await fetch(`https://cx.shouji.360.cn/phonearea.php?number=${phoneNumber}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'mcp-saorao-phone/1.0.0',
            },
          });

          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
          }

          const data = await response.json();
          
          if (data.code !== 0) {
            throw new Error(data.msg || '查询失败');
          }

          result = {
            手机号码: phoneNumber,
            归属地: `${data.data.province} ${data.data.city}`,
            运营商: data.data.sp,
            查询来源: '360手机号码归属地API'
          };
        } else {
          // 使用原有的骚扰电话查询API
          const response = await fetch(`https://api.cenguigui.cn/api/saorao/?tel=${phoneNumber}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'mcp-saorao-phone/1.0.0',
            },
          });

          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
          }

          const data = await response.json();
          
          if (!data.success) {
            throw new Error('查询失败，请稍后重试');
          }

          result = {
            手机号码: data.tel,
            归属地: `${data.info.province} ${data.info.city}`,
            运营商: data.info.operator,
            安全软件标记: data.data.map(item => ({
              软件名称: item.name,
              标记结果: item.msg
            })),
            查询来源: 'cenguigui.cn骚扰电话API'
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `${apiType === 'address' ? '手机号码归属地' : '骚扰电话'}查询结果：\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        throw new Error(`查询失败: ${error.message}`);
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP骚扰电话查询服务器已启动');
  }
}

const server = new SaoraoPhoneServer();
server.run().catch(console.error);