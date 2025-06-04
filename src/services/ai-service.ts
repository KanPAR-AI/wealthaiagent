import { AiTableContent, AiGraphContent, Message, MessageFile } from '@/types/chat';

export const generateAiResponse = async (
  userText: string,
  files: MessageFile[]
): Promise<Omit<Message, 'id' | 'timestamp'>> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  let responseText = `Okay, I received: "${userText}". `;
  if (files.length > 0) {
    responseText += `And ${files.length} file(s): ${files.map(f => f.name).join(', ')}. `;
  }

  let structuredContent: AiGraphContent | AiTableContent | undefined;

  if (userText.toLowerCase().includes("sales data")) {
    responseText += "Here's a sample of sales data:";
    structuredContent = {
      contentType: 'graph',
      graphType: 'bar',
      title: "Quarterly Sales (USD)",
      data: [
        { quarter: 'Q1', sales: 12000, expenses: 8000 },
        { quarter: 'Q2', sales: 18000, expenses: 9500 },
        { quarter: 'Q3', sales: 15000, expenses: 9000 },
        { quarter: 'Q4', sales: 21000, expenses: 11000 },
      ],
      options: {
        categoryKey: 'quarter',
        dataKeys: ['sales', 'expenses'],
        colors: ['#82ca9d', '#FA8072'],
        xAxisLabel: 'Fiscal Quarter',
        yAxisLabel: 'Amount (USD)',
      },
      description: "This bar chart shows sales and expenses per quarter. Q4 shows highest sales."
    };
  } 
  else if (userText.toLowerCase().includes("user demographics")) {
    responseText += "Here is a breakdown of user demographics by region:";
    structuredContent = {
      contentType: "graph",
      graphType: "pie",
      title: "User Demographics by Region",
      data: [
        { region: "North America", users: 4500 },
        { region: "Europe", users: 3200 },
        { region: "Asia", users: 2800 },
        { region: "South America", users: 1500 },
        { region: "Other", users: 800 },
      ],
      options: {
        categoryKey: "region",
        dataKeys: ["users"],
        colors: ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA00FF"],
      },
      description: "North America has the largest user base.",
    };
  } else if (userText.toLowerCase().includes("product list")) {
    responseText += "Here is our current product list:";
    structuredContent = {
      contentType: "table",
      title: "Product Inventory",
      data: [
        {
          id: "P1001",
          name: "Laptop Pro X",
          category: "Electronics",
          price: 1299.99,
          stock: 50,
        },
        {
          id: "P1002",
          name: "Wireless Mouse G5",
          category: "Accessories",
          price: 49.99,
          stock: 250,
        },
        {
          id: "P1003",
          name: "Mechanical Keyboard K7",
          category: "Accessories",
          price: 119.5,
          stock: 120,
        },
        {
          id: "P1004",
          name: "4K Monitor U27",
          category: "Electronics",
          price: 399.0,
          stock: 75,
        },
      ],
      columns: [
        { accessorKey: "id", header: "Product ID" },
        { accessorKey: "name", header: "Product Name" },
        { accessorKey: "category", header: "Category" },
        { accessorKey: "price", header: "Price (USD)" },
        { accessorKey: "stock", header: "In Stock" },
      ],
      description: "Prices and stock levels are subject to change.",
    };
  } else {
    responseText += "How can I assist you further?";
  }

  return {
    message: responseText,
    sender: "bot",
    structuredContent
  };
};