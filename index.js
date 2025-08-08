#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

class SaoraoPhoneServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-saorao-phone',
        version: '1.6.0',
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
        },
        {
          name: 'url_to_ip',
          description: '将网址(URL)转换为IP地址，使用ping命令解析域名',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: '要转换的网址，例如 www.example.com'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'query_ip_location',
          description: '查询IP地址归属地信息（省、市、运营商等）',
          inputSchema: {
            type: 'object',
            properties: {
              ipAddress: {
                type: 'string',
                description: '要查询的IPv4地址，例如 8.8.8.8'
              }
            },
            required: ['ipAddress']
          }
        },
        {
          name: 'query_id_card',
          description: '根据中国身份证号码查询年龄、性别、出生地等信息',
          inputSchema: {
            type: 'object',
            properties: {
              idCard: {
                type: 'string',
                description: '18位中国居民身份证号码，例如 110101199003070018'
              },
              appKey: {
                type: 'string',
                description: 'NowAPI提供的appkey，可选，默认为演示key 10003',
                default: '10003'
              },
              sign: {
                type: 'string',
                description: 'NowAPI提供的sign，可选，默认为演示sign b59bc3ef6191eb9f747dd4e83c99f2a4',
                default: 'b59bc3ef6191eb9f747dd4e83c99f2a4'
              }
            },
            required: ['idCard']
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      if (toolName === 'query_ip_location') {
        const { ipAddress } = request.params.arguments;
        if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ipAddress)) {
          throw new Error('请提供有效的IPv4地址');
        }
        try {
          const response = await fetch(`http://whois.pconline.com.cn/ipJson.jsp?json=true&ip=${ipAddress}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'mcp-saorao-phone/1.0.0',
            },
          });
          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
          }
          const data = await response.json();
          if (!data || !data.pro) {
            throw new Error('查询失败');
          }
          const result = {
            IP地址: data.ip,
            归属地: `${data.pro} ${data.city}`,
            运营商: data.addr,
            查询来源: 'whois.pconline.com.cn IP归属地API'
          };
          return {
            content: [
              {
                type: 'text',
                text: `IP归属地查询结果：\n\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          throw new Error(`查询失败: ${error.message}`);
        }
      }

      if (toolName === 'query_id_card') {
        const { idCard, appKey = '10003', sign = 'b59bc3ef6191eb9f747dd4e83c99f2a4' } = request.params.arguments;
        if (!/^\d{17}[0-9Xx]$/.test(idCard)) {
          throw new Error('请提供有效的18位身份证号码');
        }
        try {
          const url = `https://sapi.k780.com/?app=idcard.get&idcard=${idCard}&appkey=${appKey}&sign=${sign}&format=json`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'mcp-saorao-phone/1.0.0',
            },
          });
          if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
          }

          const data = await response.json();
          if (data.success !== '1') {
            throw new Error(data.msg || '查询失败');
          }
          const result = {
            查询号码: idCard,
            查询状态: data.result.status,
            出生日期: data.result.born,
            性别: data.result.sex,
            归属地: data.result.att,
            邮编: data.result.postno,
            区号: data.result.areano,
            查询来源: 'NowAPI 身份证信息查询'
          };
          return {
            content: [
              {
                type: 'text',
                text: `身份证信息查询结果：\n\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          throw new Error(`查询失败: ${error.message}`);
        }
      }

      if (toolName === 'url_to_ip') {
        const { url } = request.params.arguments;
        if (!url) {
          throw new Error('请提供有效的网址');
        }
        
        // 清理URL，移除协议前缀和路径
        let host = url.replace(/^(https?:\/\/)?/, '').split('/')[0];
        
        try {
          let pingCommand;
          if (process.platform === 'win32') {
            pingCommand = `ping -n 1 ${host}`;
          } else {
            pingCommand = `ping -c 1 ${host}`;
          }
          
          const { stdout } = await execPromise(pingCommand);
          
          // 从ping输出中提取IP地址
          const ipMatch = stdout.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
          if (!ipMatch) {
            throw new Error(`无法解析域名 ${host} 的IP地址`);
          }
          
          const ipAddress = ipMatch[0];
          const result = {
            域名: host,
            IP地址: ipAddress,
            解析方式: 'ping命令'
          };
          
          return {
            content: [
              {
                type: 'text',
                text: `域名解析结果：\n\n${JSON.stringify(result, null, 2)}`,
              },
            ],
          };
        } catch (error) {
          throw new Error(`域名解析失败: ${error.message}`);
        }
      }
      
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