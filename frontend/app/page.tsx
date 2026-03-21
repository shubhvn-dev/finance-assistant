import Link from 'next/link';
import { Phone, BarChart3, Users, ArrowRight, History } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-cream-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-cream-50/80 backdrop-blur-md border-b border-cream-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl text-brand-900">
            MidtownMoney
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/call-logs"
              className="text-sm font-medium text-brand-400 hover:text-brand-700 transition-colors"
            >
              Call Logs
            </Link>
            <Link
              href="/session/new"
              className="btn-primary text-sm"
            >
              Try Demo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-gradient pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center stagger-children">
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-brand-900 leading-tight mb-6">
            Master Your Cold Calls.{' '}
            <span className="text-gradient">Close More Deals.</span>
          </h1>
          <p className="text-lg md:text-xl text-brand-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Practice with AI-powered personas. Get instant feedback and personalized scorecards to sharpen your pitch.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/session/new" className="btn-primary text-base px-8 py-4">
              Try Demo
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/call-logs" className="btn-outline text-base px-8 py-4">
              <History className="w-5 h-5" />
              View Call Logs
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-cream-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl text-brand-900 mb-4">How It Works</h2>
            <p className="text-brand-400 text-lg">Three steps to becoming a better closer</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 stagger-children">
            {/* Feature 1 */}
            <div className="float-card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
                <Users className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="font-display text-xl text-brand-900 mb-3">Choose a Persona</h3>
              <p className="text-brand-400 text-sm leading-relaxed">
                Select from easy, medium, or aggressive AI personas to match your skill level.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="float-card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
                <Phone className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="font-display text-xl text-brand-900 mb-3">Practice Live</h3>
              <p className="text-brand-400 text-sm leading-relaxed">
                Have a real-time voice conversation with your AI prospect. Just like a real cold call.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="float-card p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-5">
                <BarChart3 className="w-7 h-7 text-brand-500" />
              </div>
              <h3 className="font-display text-xl text-brand-900 mb-3">Get Your Score</h3>
              <p className="text-brand-400 text-sm leading-relaxed">
                Receive an instant scorecard with detailed feedback on your opener, objections, tone, and close.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
