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
    <main className="min-h-screen bg-cream-50 p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center text-brand-400 hover:text-brand-700 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        <div className="text-center mb-12">
          <h1 className="font-display text-4xl text-brand-900 mb-3">Choose Your Persona</h1>
          <p className="text-brand-400 text-lg">Select a difficulty level to start your practice session</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 stagger-children">
          {PERSONAS.map((persona) => {
            const Icon = getDifficultyIcon(persona.difficulty);
            return (
              <Link
                key={persona.id}
                href={`/session/${persona.id}`}
                className="block group"
              >
                <div className={clsx(
                  "h-full bg-white p-8 rounded-2xl shadow-md border border-cream-200 border-l-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-brand-300",
                  persona.difficulty === 'Easy' && "border-l-green-500",
                  persona.difficulty === 'Medium' && "border-l-amber-500",
                  persona.difficulty === 'Aggressive' && "border-l-red-500",
                )}>
                  {/* Icon at top */}
                  <div className={clsx(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110",
                    persona.difficulty === 'Easy' && "bg-green-50",
                    persona.difficulty === 'Medium' && "bg-amber-50",
                    persona.difficulty === 'Aggressive' && "bg-red-50",
                  )}>
                    <Icon className={clsx(
                      "w-8 h-8",
                      persona.difficulty === 'Easy' && "text-green-600",
                      persona.difficulty === 'Medium' && "text-amber-600",
                      persona.difficulty === 'Aggressive' && "text-red-600",
                    )} />
                  </div>

                  {/* Name */}
                  <h3 className="font-display text-2xl text-brand-900 mb-2">
                    {persona.name}
                  </h3>

                  {/* Difficulty badge */}
                  <div className="mb-4">
                    <span className={clsx(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
                      persona.difficulty === 'Easy' && "bg-green-50 text-green-700 border-green-200",
                      persona.difficulty === 'Medium' && "bg-amber-50 text-amber-700 border-amber-200",
                      persona.difficulty === 'Aggressive' && "bg-red-50 text-red-700 border-red-200",
                    )}>
                      {persona.difficulty} Level
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-brand-400 text-sm leading-relaxed">
                    {persona.description}
                  </p>

                  {/* Hover indicator */}
                  <div className="mt-6 flex items-center text-brand-500 font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
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
