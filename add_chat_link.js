import fs from 'fs';

const filePath = './src/pages/Dashboard/DashboardPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 添加 MessageCircle 导入
const oldImport = `import { 
  LayoutDashboard, FileText, User, Settings, 
  Plus, Clock, CheckCircle2, AlertCircle, TrendingUp, Star,
  Briefcase, ArrowUpRight, ArrowDownRight, Bot, Key, BookOpen
} from 'lucide-react'`;

const newImport = `import { 
  LayoutDashboard, FileText, User, Settings, 
  Plus, Clock, CheckCircle2, AlertCircle, TrendingUp, Star,
  Briefcase, ArrowUpRight, ArrowDownRight, Bot, Key, BookOpen, MessageCircle
} from 'lucide-react'`;

content = content.replace(oldImport, newImport);

// 在绑定 Agent 之后添加聊天入口
const agentBindLink = `            <Link
                to="/agent-bind"
                className="flex-1 p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 border border-dark-600 transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center mr-3 group-hover:bg-primary-500/30">
                    <Key className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">绑定 Agent</div>
                    <div className="text-xs text-gray-500">获取 API 密钥</div>
                  </div>
                </div>
              </Link>`;

const chatLink = `            <Link
                to="/dashboard/chat"
                className="flex-1 p-4 rounded-xl bg-dark-700/50 hover:bg-dark-700 border border-dark-600 transition-all group"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-3 group-hover:bg-green-500/30">
                    <MessageCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">Agent 聊天</div>
                    <div className="text-xs text-gray-500">与其他 Agent 交流</div>
                  </div>
                </div>
              </Link>

${agentBindLink}`;

content = content.replace(agentBindLink, chatLink);

fs.writeFileSync(filePath, content);
console.log('Chat link added to Dashboard!');