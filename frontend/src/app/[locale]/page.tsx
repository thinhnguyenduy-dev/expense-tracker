'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, PieChart, Shield, Wallet, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[20%] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
              ExpenseTracker
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <Link href="#features" className="hover:text-emerald-400 transition-colors">Features</Link>
            <Link href="#testimonials" className="hover:text-emerald-400 transition-colors">Testimonials</Link>
            <Link href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</Link>
          </nav>

          <div className="flex items-center gap-4">
            {!isLoading && (
              <>
                {isAuthenticated ? (
                  <Link href="/dashboard">
                    <Button variant="default" className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20">
                      Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" className="hidden sm:block">
                      <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 border-0">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 container mx-auto px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className={`transition-all duration-700 delay-100 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <span className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
              ✨ Smart Financial Management for Everyone
            </span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              Master Your Money <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
                With Confidence
              </span>
            </h1>
          </div>
          
          <p className={`text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            Track expenses, set budgets, and visualize your financial growth with our 
            intelligent, secure, and beautiful dashboard.
          </p>

          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <Link href="/register">
              <Button size="lg" className="h-14 px-8 text-lg bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/20 transition-transform hover:scale-105">
                Start Tracking Free
              </Button>
            </Link>
            <Link href="#demo">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-full backdrop-blur-sm">
                View Live Demo
              </Button>
            </Link>
          </div>
        </div>

        {/* Hero Image / Mockup */}
        <div className={`mt-20 relative mx-auto max-w-5xl transition-all duration-1000 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl blur opacity-30" />
          <div className="relative rounded-2xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden aspect-[16/9] flex items-center justify-center group">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
            
            {/* Abstract Dashboard UI Representation */}
            <div className="relative z-10 grid grid-cols-3 gap-6 p-8 w-full h-full opacity-80 group-hover:opacity-100 transition-opacity">
              <div className="col-span-1 space-y-6">
                <div className="h-32 rounded-xl bg-white/5 border border-white/5" />
                <div className="h-64 rounded-xl bg-white/5 border border-white/5" />
              </div>
              <div className="col-span-2 space-y-6">
                 <div className="h-24 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center p-6">
                   <div className="w-12 h-12 rounded-full bg-emerald-500/20" />
                   <div className="ml-4 space-y-2">
                     <div className="h-4 w-32 bg-white/20 rounded" />
                     <div className="h-3 w-48 bg-white/10 rounded" />
                   </div>
                 </div>
                 <div className="h-80 rounded-xl bg-white/5 border border-white/5 grid grid-cols-2 gap-4 p-4">
                    <div className="bg-white/5 rounded-lg" />
                    <div className="bg-white/5 rounded-lg" />
                 </div>
              </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
               <span className="px-6 py-3 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-slate-300 font-medium tracking-wide">
                 Interactive Dashboard Preview
               </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-950 relative">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold">Everything you need to grow</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Powerful features to help you track, save, and manage your finances effectively.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<PieChart className="h-8 w-8 text-purple-400" />}
              title="Visual Analytics"
              description="See exactly where your money goes with beautiful, interactive charts and graphs."
              color="purple"
            />
            <FeatureCard 
              icon={<Zap className="h-8 w-8 text-amber-400" />}
              title="Real-time Tracking"
              description="Log expenses instantly and see your budget update in real-time."
              color="amber"
            />
            <FeatureCard 
              icon={<Shield className="h-8 w-8 text-blue-400" />}
              title="Bank-Grade Security"
              description="Your data is encrypted and secure. We prioritize your privacy above all."
              color="blue"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-900/10" />
        <div className="container mx-auto px-6 relative text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Ready to take control?
          </h2>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto">
            Join thousands of users who are mastering their financial future today.
          </p>
          <div className="flex justify-center gap-4">
             <Link href="/register">
              <Button size="lg" className="h-14 px-10 text-lg bg-white text-emerald-900 hover:bg-slate-100 rounded-full font-bold">
                Get Started Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-slate-950">
        <div className="container mx-auto px-6 text-center text-slate-500">
           <p>© {new Date().getFullYear()} Expense Tracker. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) {
  const colorClasses = {
    purple: "group-hover:border-purple-500/50 group-hover:shadow-purple-500/10",
    amber: "group-hover:border-amber-500/50 group-hover:shadow-amber-500/10",
    blue: "group-hover:border-blue-500/50 group-hover:shadow-blue-500/10",
  }[color];

  return (
    <div className={`
      p-8 rounded-2xl bg-white/5 border border-white/10 
      backdrop-blur-sm transition-all duration-300
      hover:bg-white/10 hover:-translate-y-2
      group cursor-default
      ${colorClasses}
    `}>
      <div className="mb-6 w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
