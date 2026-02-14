import Link from 'next/link';
import { Phone, History } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-50">
      <h1 className="text-4xl font-bold mb-12 text-slate-900">Finance Assistant</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link 
          href="/session/new"
          className="group flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="p-4 bg-blue-50 rounded-full mb-4 group-hover:bg-blue-100 transition-colors">
            <Phone className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Practice</h2>
          <p className="text-slate-500 text-center mt-2">Start a new roleplay session with an AI persona</p>
        </Link>

        <Link 
          href="/dashboard"
          className="group flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all"
        >
          <div className="p-4 bg-purple-50 rounded-full mb-4 group-hover:bg-purple-100 transition-colors">
            <History className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Previous Calls</h2>
          <p className="text-slate-500 text-center mt-2">Review scorecards and history</p>
        </Link>
      </div>
    </main>
  );
}