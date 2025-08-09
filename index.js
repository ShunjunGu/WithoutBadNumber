#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { exec } from 'child_process';

// 简易省份代码映射
const provinceMap = {
  11: '北京', 12: '天津', 13: '河北', 14: '山西', 15: '内蒙古',
  21: '辽宁', 22: '吉林', 23: '黑龙江',
  31: '上海', 32: '江苏', 33: '浙江', 34: '安徽', 35: '福建', 36: '江西', 37: '山东',
  41: '河南', 42: '湖北', 43: '湖南',
  44: '广东', 45: '广西', 46: '海南',
  50: '重庆', 51: '四川', 52: '贵州', 53: '云南', 54: '西藏',
  61: '陕西', 62: '甘肃', 63: '青海', 64: '宁夏', 65: '新疆'
};

// 校验身份证号合法性
export function validateIdCard(id) {
  if (!/^\d{17}[\dXx]$/.test(id)) {
    return { valid: false, message: '格式错误' };
  }
  // 校验出生日期
  const birth = id.substring(6, 14);
  const year = parseInt(birth.substring(0, 4));
  const month = parseInt(birth.substring(4, 6));
  const day = parseInt(birth.substring(6, 8));
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
    return { valid: false, message: '出生日期无效' };
  }
  // 校验位计算
  const weight = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCode = ['1','0','X','9','8','7','6','5','4','3','2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += parseInt(id[i]) * weight[i];
  const code = checkCode[sum % 11];
  if (code !== id[17].toUpperCase()) {
    return { valid: false, message: '校验位错误' };
  }
  return { valid: true };
}

// 解析身份证信息
export function parseIdCardInfo(id) {
  const birthStr = id.substring(6, 14);
  const birth = `${birthStr.substring(0,4)}-${birthStr.substring(4,6)}-${birthStr.substring(6,8)}`;
  const gender = parseInt(id[16]) % 2 === 0 ? '女' : '男';
  const provinceCode = id.substring(0, 2);
  const region = provinceMap[provinceCode] || '未知';
  // 年龄
  const birthDate = new Date(parseInt(birthStr.substring(0,4)), parseInt(birthStr.substring(4,6)) - 1, parseInt(birthStr.substring(6,8)));
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
  const checkBit = id[17].toUpperCase();
  return { birth, gender, region, age, checkBit };
}
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
          description: '根据中国身份证号码解析基本信息（无需外部API Key）',
          inputSchema: {
            type: 'object',
            properties: {
              idCard: {
                type: 'string',
                description: '18位中国居民身份证号码，例如 110101199003070018'
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
        const { idCard } = request.params.arguments;
        if (!/^\d{17}[0-9Xx]$/.test(idCard)) {
          throw new Error('请提供有效的18位身份证号码');
        }

        try {
          // 身份证号码基本信息解析
          // 验证身份证号码格式
          const isValid = validateIdCard(idCard);
          if (!isValid.valid) {
            throw new Error(`身份证号码无效: ${isValid.message}`);
          }

          // 从身份证号码中解析信息
          const info = parseIdCardInfo(idCard);

          const result = {
            查询号码: idCard,
            出生日期: info.birth,
            性别: info.gender,
            归属地: info.region,
            年龄: info.age,
            校验位: info.checkBit,
            查询来源: '本地身份证号码规则解析'
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