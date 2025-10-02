import { Link } from 'react-router-dom';
import Logo from '@/components/ui/logo'; // Adjust path if needed

function Index() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 w-full">
       <header className="absolute top-4 right-4">
         <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
             <span className="text-xs font-medium">U</span>
           </div>
         </div>
       </header>

       <div className="text-center">
           <Logo /> {/* Larger logo */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                Welcome to AI Chat
            </h1>
            <p className="text-lg text-gray-600 mb-8">
                Your intelligent conversation partner.
            </p>
            <Link
                to="/new" // Link directly to start a new chat
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-300"
            >
                Start New Chat
            </Link>
       </div>

        <footer className="absolute bottom-4 text-gray-500 text-sm">
            © {new Date().getFullYear()} Your Company Name. All rights reserved.
        </footer>
    </div>
  );
}

export default Index;