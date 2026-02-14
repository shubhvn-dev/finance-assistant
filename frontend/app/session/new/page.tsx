import Link from 'next/link';
import { PERSONAS } from '@/lib/personas';
import { ArrowLeft, User, TrendingUp, Flame } from 'lucide-react';
import { clsx } from 'clsx';

export default function NewSessionPage() {
  const getDifficultyIcon = (difficulty: string) => {
    if (difficulty === 'Easy') return User;
    if (difficulty === 'Medium') return TrendingUp;
    return Flame;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Choose Your Persona</h1>
          <p className="text-slate-600 text-lg">Select a difficulty level to start your practice session</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PERSONAS.map((persona) => {
            const Icon = getDifficultyIcon(persona.difficulty);
            return (
              <Link
                key={persona.id}
                href={`/session/${persona.id}`}
                className="block group"
              >
                <div className={clsx(
                  "h-full bg-white p-8 rounded-2xl border-2 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
                  persona.difficulty === 'Easy' && "border-green-200 hover:border-green-400 hover:bg-green-50/50",
                  persona.difficulty === 'Medium' && "border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50/50",
                  persona.difficulty === 'Aggressive' && "border-red-200 hover:border-red-400 hover:bg-red-50/50",
                )}>
                  {/* Icon at top */}
                  <div className={clsx(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                    persona.difficulty === 'Easy' && "bg-green-100",
                    persona.difficulty === 'Medium' && "bg-yellow-100",
                    persona.difficulty === 'Aggressive' && "bg-red-100",
                  )}>
                    <Icon className={clsx(
                      "w-8 h-8",
                      persona.difficulty === 'Easy' && "text-green-600",
                      persona.difficulty === 'Medium' && "text-yellow-600",
                      persona.difficulty === 'Aggressive' && "text-red-600",
                    )} />
                  </div>

                  {/* Name */}
                  <h3 className="text-2xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {persona.name}
                  </h3>

                  {/* Difficulty badge */}
                  <div className="mb-4">
                    <span className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
                      persona.difficulty === 'Easy' && "bg-green-100 text-green-700",
                      persona.difficulty === 'Medium' && "bg-yellow-100 text-yellow-700",
                      persona.difficulty === 'Aggressive' && "bg-red-100 text-red-700",
                    )}>
                      {persona.difficulty} Level
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {persona.description}
                  </p>

                  {/* Hover indicator */}
                  <div className="mt-6 flex items-center text-blue-600 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    Start Session
                    <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}