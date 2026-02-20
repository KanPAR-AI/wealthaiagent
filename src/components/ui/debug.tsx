// src/components/debug/DebugPanel.tsx
import { BarChart3, Code, Database, MessageSquare } from 'lucide-react';

interface DebugMessage {
  id: string;
  title: string;
  message: string;
  description: string;
  category: 'charts' | 'data' | 'code' | 'general';
}

interface DebugPanelProps {
  onDebugMessage: (message: string) => void;
  disabled?: boolean;
  isVisible: boolean;
}

const debugMessages: DebugMessage[] = [
  // Chart/Graph messages
  {
    id: 'sales-chart',
    title: 'Sales Chart',
    message: 'Create a bar chart showing monthly sales data for the last 6 months with values: Jan: $12000, Feb: $15000, Mar: $18000, Apr: $14000, May: $20000, Jun: $22000',
    description: 'Test bar chart generation',
    category: 'charts'
  },
  {
    id: 'user-growth',
    title: 'User Growth Line Chart',
    message: 'Show me a line chart of user growth over time with data points: Week 1: 100 users, Week 2: 150 users, Week 3: 220 users, Week 4: 280 users, Week 5: 350 users',
    description: 'Test line chart with growth data',
    category: 'charts'
  },
  {
    id: 'pie-chart',
    title: 'Revenue Pie Chart',
    message: 'Create a pie chart showing revenue by product category: Software 45%, Hardware 30%, Services 15%, Training 10%',
    description: 'Test pie chart visualization',
    category: 'charts'
  },
  
  // Data analysis messages
  {
    id: 'user-demographics',
    title: 'User Demographics',
    message: 'Analyze user demographics data: Age groups (18-25: 35%, 26-35: 40%, 36-45: 20%, 46+: 5%), Gender (Male: 52%, Female: 45%, Other: 3%), Location (US: 60%, Europe: 25%, Asia: 15%)',
    description: 'Test demographic analysis',
    category: 'data'
  },
  {
    id: 'product-performance',
    title: 'Product Performance',
    message: 'Show product performance metrics: Product A (Revenue: $50k, Units: 500, Rating: 4.5), Product B (Revenue: $35k, Units: 350, Rating: 4.2), Product C (Revenue: $28k, Units: 280, Rating: 4.0)',
    description: 'Test product data analysis',
    category: 'data'
  },
  {
    id: 'table-data',
    title: 'Table Data',
    message: 'Create a table showing employee data: Name | Department | Salary | Years - John Smith | Engineering | $85000 | 3 - Jane Doe | Marketing | $75000 | 2 - Bob Johnson | Sales | $70000 | 5',
    description: 'Test table generation',
    category: 'data'
  },
  
  // Code-related messages
  {
    id: 'code-review',
    title: 'Code Review',
    message: 'Review this React component for best practices: ```jsx\nfunction UserCard({ user }) {\n  return (\n    <div className="card">\n      <h2>{user.name}</h2>\n      <p>{user.email}</p>\n    </div>\n  );\n}\n```',
    description: 'Test code review functionality',
    category: 'code'
  },
  {
    id: 'debug-help',
    title: 'Debug Help',
    message: 'Help me debug this JavaScript error: "Cannot read property \'map\' of undefined" when trying to render a list of items',
    description: 'Test debugging assistance',
    category: 'code'
  },
  {
    id: 'code-generation',
    title: 'Code Generation',
    message: 'Generate a TypeScript function that validates an email address and returns true/false',
    description: 'Test code generation',
    category: 'code'
  },
  
  // General messages
  {
    id: 'long-response',
    title: 'Long Response Test',
    message: 'Explain the concept of machine learning, including supervised learning, unsupervised learning, deep learning, and provide examples of real-world applications in detail',
    description: 'Test lengthy response handling',
    category: 'general'
  },
  {
    id: 'formatting-test',
    title: 'Rich Formatting',
    message: 'Create a formatted response with **bold text**, *italic text*, `code snippets`, and a bulleted list of key points about web development best practices',
    description: 'Test rich text formatting',
    category: 'general'
  },
  {
    id: 'step-by-step',
    title: 'Step-by-Step Guide',
    message: 'Provide a step-by-step guide on how to set up a React project with TypeScript and Tailwind CSS',
    description: 'Test structured responses',
    category: 'general'
  }
];

const categoryIcons = {
  charts: BarChart3,
  data: Database,
  code: Code,
  general: MessageSquare
};

const categoryColors = {
  charts: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
  data: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
  code: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30',
  general: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30'
};

export function DebugPanel({ onDebugMessage, disabled = false, isVisible }: DebugPanelProps) {
  if (!isVisible) return null;

  const handleMessageClick = (message: string) => {
    onDebugMessage(message);
  };

  const groupedMessages = debugMessages.reduce((acc, msg) => {
    if (!acc[msg.category]) acc[msg.category] = [];
    acc[msg.category].push(msg);
    return acc;
  }, {} as Record<string, DebugMessage[]>);

  return (
    <div className="bg-background dark:bg-zinc-900 border-t border-border p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <h3 className="text-sm font-medium text-foreground">Debug Mode Active</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(groupedMessages).map(([category, messages]) => {
            const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
            const colorClasses = categoryColors[category as keyof typeof categoryColors];
            
            return (
              <div key={category} className="space-y-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClasses.split(' ').slice(2).join(' ')}`}>
                  <IconComponent size={14} className={colorClasses.split(' ').slice(0, 2).join(' ')} />
                  <span className={`text-sm font-medium capitalize ${colorClasses.split(' ').slice(0, 2).join(' ')}`}>
                    {category}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => handleMessageClick(msg.message)}
                      disabled={disabled}
                      className="w-full text-left p-3 bg-background dark:bg-zinc-800 hover:bg-muted dark:hover:bg-zinc-700 rounded-lg border border-border transition-all disabled:opacity-50 disabled:pointer-events-none group"
                    >
                      <div className="font-medium text-sm text-foreground dark:text-zinc-200 group-hover:text-primary">
                        {msg.title}
                      </div>
                      <div className="text-xs text-muted-foreground dark:text-zinc-400 mt-1 line-clamp-2">
                        {msg.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}