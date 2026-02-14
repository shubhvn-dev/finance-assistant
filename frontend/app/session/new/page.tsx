import Link from 'next/link';
import { PERSONAS } from '@/lib/personas';
import { ArrowLeft, Zap } from 'lucide-react';
import { clsx } from 'clsx';

export default function NewSessionPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Choose a Persona</h1>
        <p className="text-slate-500 mb-8">Select a difficulty level to start your practice session.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PERSONAS.map((persona) => (
            <Link 
              key={persona.id} 
              href={`/session/${persona.id}`}
              className="block group"
            >
              <div className="h-full bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <span className={clsx(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    persona.difficulty === 'Easy' && "bg-green-100 text-green-700",
                    persona.difficulty === 'Medium' && "bg-yellow-100 text-yellow-700",
                    persona.difficulty === 'Aggressive' && "bg-red-100 text-red-700",
                  )}>
                    {persona.difficulty}
                  </span>
                  <Zap className={clsx(
                    "w-5 h-5",
                    persona.difficulty === 'Easy' && "text-green-500",
                    persona.difficulty === 'Medium' && "text-yellow-500",
                    persona.difficulty === 'Aggressive' && "text-red-500",
                  )} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{persona.name}</h3>
                <p className="text-slate-500 text-sm">{persona.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}